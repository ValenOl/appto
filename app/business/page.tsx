export const preferredRegion = 'iad1'; // Washington DC — failover after gru1 block

import { redirect } from "next/navigation";
import { supabase, getSupabaseAdmin } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
import { getOrFetchProfile } from "@/lib/services/dataFetcher";
import { signOut } from "@/app/actions/auth";
import { saveNote } from "@/app/actions/business";
import { ReviewForm } from "@/app/business/ReviewForm";
import { PrintButton } from "@/app/business/PrintButton";
import { generateAnalystVerdict } from "@/lib/utils/scoring";
import type { TrendDirection } from "@/lib/utils/scoring";
import { fetchAfipData, afipIngresoMensualMax } from "@/lib/services/afipService";
import type { AfipResult } from "@/lib/services/afipService";
import type {
  Company,
  Profile,
  Note,
  DebtEntry,
  ReviewWithCompany,
  GuarantorLinkWithProfile,
  SituacionPoint,
} from "@/types/database";

// ─────────────────────────────────────────────
// Billing — credit consumption
//
// Run once in the Supabase SQL Editor:
//
//   CREATE OR REPLACE FUNCTION consume_credit(p_company_id uuid)
//   RETURNS SETOF companies
//   LANGUAGE sql AS $$
//     UPDATE companies
//     SET queries_used = queries_used + 1
//     WHERE id = p_company_id
//       AND queries_used < monthly_quota
//     RETURNING *;
//   $$;
//
// ─────────────────────────────────────────────


async function linkProfiles(primaryId: string, linkedId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: existing } = await (admin as any)
    .from("guarantor_links")
    .select("id")
    .eq("primary_profile_id", primaryId)
    .eq("linked_profile_id", linkedId)
    .maybeSingle();
  if (existing) return;
  await (admin as any).from("guarantor_links").insert({
    primary_profile_id: primaryId,
    linked_profile_id:  linkedId,
    relation_type:      "GARANTE",
  });
}

async function consumeCredit(companyId: string): Promise<Company | null> {
  const { data, error } = await (supabase as any).rpc("consume_credit", {
    p_company_id: companyId,
  });
  if (error || !data || data.length === 0) return null;
  return data[0];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatIncome(amount: number): string {
  return new Intl.NumberFormat("es-AR").format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("es-AR", { month: "short", year: "numeric" })
    .toUpperCase();
}

function formatFullDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

// ─────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────

interface ProfileData {
  profile: Profile;
  reviews: ReviewWithCompany[];
  links: GuarantorLinkWithProfile[];
}

interface ResultsProps extends ProfileData {
  companyId:      string;
  company:        Company;
  priorNote:      Note | null;
  internalNotes:  Note[];
  declaredIncome: number;
  afipData:       AfipResult | null;
}

async function getProfileContext(
  profile: Profile,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
): Promise<ProfileData> {
  const [{ data: reviews }, { data: links }] = await Promise.all([
    client
      .from("reviews")
      .select("*, company:companies(*)")
      .eq("profile_id", profile.id),
    client
      .from("guarantor_links")
      .select("*, guarantor:profiles!linked_profile_id(*)")
      .eq("primary_profile_id", profile.id),
  ]);

  return {
    profile,
    reviews: (reviews ?? []) as ReviewWithCompany[],
    links:   (links   ?? []) as GuarantorLinkWithProfile[],
  };
}

// ─────────────────────────────────────────────
// Page (Server Component)
// ─────────────────────────────────────────────

export default async function BusinessDashboard(props: {
  searchParams: Promise<{ cuit?: string; income?: string; garante?: string }>;
}) {
  // ── Auth & Subscription Gate ──────────────────
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const { data: companyData } = await authClient
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const company = companyData as Company | null;

  if (!company) redirect("/login");

  if (company.subscription_status === "pending") {
    return <PendingGate company={company} />;
  }
  // ─────────────────────────────────────────────

  const searchParams   = await props.searchParams;
  const rawCuit        = searchParams.cuit?.replace(/\D/g, '')    || undefined;
  const rawGarante     = searchParams.garante?.replace(/\D/g, '') || undefined;
  const declaredIncome = parseInt(searchParams.income?.replace(/\D/g, '') ?? '0', 10) || 0;

  let quotaExhausted = false;
  let exhaustedPlanTier = "";
  let result: ProfileData | null = null;
  let afipData: AfipResult | null = null;
  let noRecords = false;   // Estado A: CUIT/CUIL truly absent from all BCRA endpoints
  let zeroDebt  = false;   // Estado B: found in BCRA but zero active debt (has historical activity)
  let apiError  = false;   // BCRA API down / network failure — do not treat as Estado A
  let priorNote: Note | null = null;
  let internalNotes: Note[] = [];
  let garanteProfile: Profile | null = null;
  let garanteNoRecords = false;

  if (rawCuit) {
    let fetchOutcome: Awaited<ReturnType<typeof getOrFetchProfile>>;
    try {
      fetchOutcome = await getOrFetchProfile(rawCuit, company.id);
    } catch {
      // Network/timeout error from BCRA — surface to the user rather than
      // caching a false "sin historial".
      apiError = true;
      fetchOutcome = null;
    }

    if (apiError) {
      // Handled below in render — no credit consumed.
    } else if (fetchOutcome === null) {
      // Estado A — all BCRA endpoints returned nothing, no credit consumed
      noRecords = true;
    } else {
      if (fetchOutcome.isNew) {
        // Rule C — first successful BCRA fetch, consume credit
        const consumed = await consumeCredit(company.id);
        if (!consumed) {
          quotaExhausted = true;
          exhaustedPlanTier = company.plan_tier;
        }
      }
      // Rule A — isNew === false means cache hit, credit is NOT consumed (falls through)

      if (!quotaExhausted) {
        // Estado B: person was found in BCRA but currently carries no active debt.
        // Only flag this when hasHistoricalActivity is true; if it's false the
        // API responded but with fully empty arrays (treat as Estado A).
        if (
          fetchOutcome.hasHistoricalActivity &&
          (fetchOutcome.profile.debt_detail?.length ?? 0) === 0
        ) {
          zeroDebt = true;
        }

        // ── Garante fetch + link ───────────────────────────────────────────
        // Runs BEFORE getProfileContext so the link is already in DB when
        // GroupEvaluationSection queries guarantor_links.
        if (rawGarante) {
          try {
            const garanteOutcome = await getOrFetchProfile(rawGarante, company.id);
            if (garanteOutcome === null) {
              garanteNoRecords = true;
            } else {
              if (garanteOutcome.isNew) {
                await consumeCredit(company.id); // best-effort, ignore if quota edge
              }
              garanteProfile = garanteOutcome.profile;
              await linkProfiles(fetchOutcome.profile.id, garanteOutcome.profile.id);
            }
          } catch {
            // garante fetch error — show titular results regardless
          }
        }
        // ──────────────────────────────────────────────────────────────────

        const [profileCtx, afipFetch, { data: notesData }] = await Promise.all([
          getProfileContext(fetchOutcome.profile, authClient),
          fetchAfipData(fetchOutcome.profile.cuit),
          authClient
            .from("notes")
            .select("*")
            .eq("company_id", company.id)
            .eq("profile_id", fetchOutcome.profile.id)
            .order("created_at", { ascending: false }),
        ]);

        result    = profileCtx;
        afipData  = afipFetch;
        internalNotes = (notesData ?? []) as Note[];
        priorNote = internalNotes.length > 0 ? internalNotes[0] : null;
      }
    }
  }

  return (
    <div
      className="bg-slate-50"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          @page { margin: 2cm; size: A4 portrait; }

          body { background: white !important; }
          * { box-shadow: none !important; }
          *, *::before, *::after { background-color: white !important; }
          [class*="border"] { border-color: #d1d5db !important; }
          * { color: #000 !important; }
          * { border-radius: 0 !important; }

          #search-form, #page-footer, button { display: none !important; }
          #print-header { display: flex !important; }
          #analyst-verdict {
            border-left: 4px solid #000 !important;
            padding-left: 20px !important;
          }
          #debt-table    { page-break-inside: avoid; }
          #dictamen-formal { page-break-inside: avoid; border: 2px solid #000 !important; }
        }
      `}</style>

      <main className="max-w-5xl mx-auto px-8 py-10 flex flex-col gap-8">

        {/* ── PRINT HEADER (hidden on screen) ── */}
        <div
          id="print-header"
          className="hidden flex-col gap-3 pb-6 mb-2"
          style={{ borderBottom: "2px solid #000" }}
        >
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span
                className="text-4xl font-black tracking-tight"
                style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
              >
                ΛPPTO
              </span>
              <span className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">
                ANÁLISIS CREDITICIO OFICIAL
              </span>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="text-xs font-light text-slate-500">
                Generado el {new Date().toLocaleDateString("es-AR", {
                  day: "2-digit", month: "long", year: "numeric"
                })}
              </span>
              {rawCuit && (
                <span
                  className="text-xs tracking-widest text-slate-400"
                  style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                  IDENTIFICACIÓN: {rawCuit}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── BUSCADOR ── */}
        {/*
          Native form with method="get" — no JS required.
          On submit, navigates to /business?cuit=... and the Server Component
          re-renders with the new searchParams.
        */}
        <form
          id="search-form"
          method="get"
          action="/business"
          className="bg-white border border-slate-200 rounded-2xl px-8 py-7 flex flex-col gap-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="cuit-input"
                className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase"
              >
                TITULAR
              </label>
              <input
                id="cuit-input"
                type="text"
                name="cuit"
                defaultValue={searchParams.cuit ?? ""}
                placeholder="DNI o CUIL sin guiones"
                className="
                  w-full text-2xl font-light text-slate-800 bg-transparent
                  border-0 border-b-2 border-slate-200
                  py-3 px-0
                  placeholder:text-slate-300
                  focus:outline-none focus:border-slate-700
                  transition-colors
                "
              />
              <p className="text-xs font-light text-slate-400 tracking-wide">
                DNI o CUIL sin guiones.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="garante-input"
                className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase"
              >
                GARANTE <span className="font-light normal-case tracking-normal">(opcional)</span>
              </label>
              <input
                id="garante-input"
                type="text"
                name="garante"
                defaultValue={searchParams.garante ?? ""}
                placeholder="DNI o CUIL sin guiones"
                className="
                  w-full text-2xl font-light text-slate-800 bg-transparent
                  border-0 border-b-2 border-slate-200
                  py-3 px-0
                  placeholder:text-slate-300
                  focus:outline-none focus:border-slate-700
                  transition-colors
                "
              />
              <p className="text-xs font-light text-slate-400 tracking-wide">
                Co-firmante o avalista de la operación.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="income-input"
                className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase"
              >
                INGRESO MENSUAL <span className="font-light normal-case tracking-normal">(opcional)</span>
              </label>
              <input
                id="income-input"
                type="number"
                name="income"
                min="0"
                defaultValue={searchParams.income ?? ""}
                placeholder="ARS"
                className="
                  w-full text-2xl font-light text-slate-800 bg-transparent
                  border-0 border-b-2 border-slate-200
                  py-3 px-0
                  placeholder:text-slate-300
                  focus:outline-none focus:border-slate-700
                  transition-colors
                "
              />
              <p className="text-xs font-light text-slate-400 tracking-wide">
                Para calcular ratio deuda / ingreso.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="
                px-10 py-4 rounded-xl
                text-[11px] font-black tracking-[0.25em] text-white
                hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer
              "
              style={{ backgroundColor: "var(--color-secondary)" }}
            >
              CONSULTAR
            </button>
          </div>
        </form>

        {/* ── VEREDICTO CONJUNTO (solo cuando hay garante) ── */}
        {result && garanteProfile && (
          <OperacionVeredicto titular={result.profile} garante={garanteProfile} />
        )}
        {rawGarante && result && garanteNoRecords && (
          <div className="bg-white border border-amber-200 rounded-2xl px-10 py-8 flex flex-col gap-2"
               style={{ borderLeft: "4px solid #d97706" }}>
            <span className="text-[10px] font-black tracking-[0.35em] text-amber-600 uppercase">
              Garante no encontrado
            </span>
            <p className="text-sm font-light text-slate-500">
              El garante{" "}
              <span className="font-bold tracking-widest" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
                {rawGarante}
              </span>{" "}
              no registra actividad en el BCRA. Se muestra solo el perfil del titular.
            </p>
          </div>
        )}

        {/* ── ESTADOS ── */}
        {!rawCuit ? (
          <IdleState />
        ) : apiError ? (
          <ApiError cuit={rawCuit} />
        ) : quotaExhausted ? (
          <QuotaExhausted planTier={exhaustedPlanTier} />
        ) : noRecords ? (
          <NoRecords cuit={rawCuit} />
        ) : zeroDebt && result ? (
          <ZeroDebt cuit={rawCuit} denominacion={result.profile.full_name} />
        ) : !result ? (
          <div className="bg-white border border-slate-200 rounded-2xl px-10 py-16 flex flex-col gap-4">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
              SIN RESULTADOS
            </span>
            <p className="text-3xl font-black text-slate-900 tracking-tight">
              IDENTIFICACIÓN NO ENCONTRADA
            </p>
            <p className="text-sm font-light text-slate-500 max-w-sm leading-relaxed">
              No existe un perfil asociado a{" "}
              <span
                className="font-bold tracking-widest"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {rawCuit}
              </span>{" "}
              en ninguna fuente disponible.
            </p>
          </div>
        ) : (
          <Results
            {...result}
            companyId={company.id}
            company={company}
            priorNote={priorNote}
            internalNotes={internalNotes}
            declaredIncome={declaredIncome}
            afipData={afipData}
          />
        )}

      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
// Idle state — no search submitted yet
// ─────────────────────────────────────────────

function IdleState() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-10 py-20 flex flex-col gap-6">
      <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
        MOTOR DE CONSULTAS
      </span>
      <h2 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none">
        INGRESAR CUIT
        <br />
        <span className="font-light text-slate-300">PARA INICIAR</span>
        <br />
        AUDITORÍA
      </h2>
      <p className="text-sm font-light text-slate-400 max-w-sm leading-relaxed">
        Cada consulta descuenta un crédito de tu ciclo activo. Ingresá el CUIT
        o CUIL del sujeto a evaluar en el buscador de arriba.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// API Error — network failure reaching BCRA
// ─────────────────────────────────────────────

function ApiError({ cuit }: { cuit: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-10 py-16 flex flex-col gap-4">
      <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
        ERROR DE CONEXIÓN
      </span>
      <p className="text-3xl font-black text-slate-900 tracking-tight">
        API DEL BCRA NO DISPONIBLE
      </p>
      <p className="text-sm font-light text-slate-500 max-w-sm leading-relaxed">
        No se pudo conectar con la Central de Deudores del BCRA al consultar{" "}
        <span
          className="font-bold tracking-widest"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          {cuit}
        </span>.
        El servicio puede estar temporalmente saturado o en mantenimiento.
        No se descontó ningún crédito de tu cuota.
      </p>
      <p className="text-xs font-light text-slate-400 border-l-2 border-slate-200 pl-4 mt-2">
        Reintentá en unos minutos. Si el error persiste, consultá el estado de la API del BCRA.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Estado A — CUIT truly absent from all BCRA endpoints
// ─────────────────────────────────────────────

function NoRecords({ cuit }: { cuit: string }) {
  return (
    <div className="bg-white border border-amber-200 rounded-2xl px-10 py-16 flex flex-col gap-4"
         style={{ borderLeft: "4px solid #d97706" }}>
      <span className="text-[10px] font-black tracking-[0.35em] text-amber-600 uppercase">
        Sin actividad financiera formal
      </span>
      <p className="text-3xl font-black text-slate-900 tracking-tight">
        PERFIL SIN ACTIVIDAD FINANCIERA FORMAL
      </p>
      <p className="text-sm font-light text-slate-500 max-w-lg leading-relaxed">
        El identificador{" "}
        <span
          className="font-bold tracking-widest text-slate-700"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          {cuit}
        </span>{" "}
        no posee registros de deuda, tarjetas o préstamos informados al BCRA en los últimos 24 meses.
      </p>
      <p className="text-xs text-slate-400 border-l-2 border-amber-200 pl-4 leading-relaxed">
        Verifique si el número es correcto o si se trata de un perfil que opera
        exclusivamente fuera del sistema bancario.
      </p>
      <p className="text-xs font-light text-slate-300 mt-1">
        Esta consulta no fue descontada de tu cuota mensual.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Estado B — found in BCRA but zero active debt
// ─────────────────────────────────────────────

function ZeroDebt({ cuit, denominacion }: { cuit: string; denominacion: string }) {
  return (
    <div className="bg-white border border-green-100 rounded-2xl px-10 py-16 flex flex-col gap-4">
      <span className="text-[10px] font-black tracking-[0.35em] text-green-600 uppercase">
        HISTORIAL VERIFICADO — SIN DEUDA ACTIVA
      </span>
      <p className="text-3xl font-black text-slate-900 tracking-tight">
        SITUACIÓN 1 — SIN DEUDA ACTIVA ACTUALMENTE
      </p>
      <p className="text-lg font-light text-slate-600">
        {denominacion}
      </p>
      <p className="text-sm font-light text-slate-500 max-w-sm leading-relaxed">
        El identificador{" "}
        <span
          className="font-bold tracking-widest"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          {cuit}
        </span>{" "}
        registra historial crediticio en el BCRA pero no presenta deudas vigentes en el período
        más reciente. La persona operó en el sistema financiero y se encuentra al día.
      </p>
      <div className="flex items-center gap-3 mt-2">
        <span
          className="text-[10px] font-black tracking-[0.2em] px-4 py-2 rounded-lg"
          style={{ color: "var(--color-secondary)", backgroundColor: "rgba(0,120,80,0.06)", border: "1px solid var(--color-secondary)" }}
        >
          SITUACIÓN 1 (NORMAL)
        </span>
        <span className="text-[10px] font-black tracking-[0.2em] text-green-700 px-4 py-2 rounded-lg bg-green-50 border border-green-100">
          APTO PARA CRÉDITO
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pending subscription gate
// ─────────────────────────────────────────────

function PendingGate({ company }: { company: Company }) {
  return (
    <div
      className="min-h-screen bg-slate-50 flex items-center justify-center px-6"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      <div className="max-w-lg w-full flex flex-col gap-10">

        <span className="text-sm font-black tracking-tight text-slate-300">
          ΛPPTO{" "}
          <span className="font-light tracking-widest text-xs">[ BUSINESS ]</span>
        </span>

        <div className="flex flex-col gap-4">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
            ACCESO RESTRINGIDO
          </span>
          <h1 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none">
            CUENTA EN
            <br />
            REVISIÓN
          </h1>
          <p className="text-xl font-light text-slate-500 max-w-lg leading-relaxed">
            Estamos aguardando la confirmación de tu pago para habilitar el
            motor de consultas.
          </p>
        </div>

        <div
          className="border border-slate-200 rounded-xl bg-white px-6 py-4"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          <p className="text-sm text-slate-400 tracking-[0.08em]">
            EMPRESA: {company.company_name} | CUIT: {company.cuit} | PLAN:{" "}
            {company.plan_tier}
          </p>
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="
              text-[11px] font-black tracking-[0.25em] text-slate-500
              border border-slate-200 hover:border-slate-700 hover:text-slate-900
              rounded-xl px-8 py-4 transition-colors cursor-pointer
            "
          >
            [ CERRAR SESIÓN ]
          </button>
        </form>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Quota exhausted screen
// ─────────────────────────────────────────────

function QuotaExhausted({ planTier }: { planTier: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-10 py-20 flex flex-col gap-6">
      <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
        LÍMITE DE CICLO ALCANZADO
      </span>
      <h2 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none">
        CRÉDITOS
        <br />
        AGOTADOS
      </h2>
      <p className="text-sm font-light text-slate-500 max-w-sm leading-relaxed">
        El plan{" "}
        <span
          className="font-black text-slate-800 tracking-widest"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          {planTier}
        </span>{" "}
        agotó todas las consultas disponibles para el ciclo activo. Actualizá
        tu plan para continuar.
      </p>
      <div className="pt-2">
        <a
          href="#"
          className="
            inline-block px-10 py-4 rounded-xl
            text-[11px] font-black tracking-[0.25em] text-white
            bg-slate-900 hover:bg-slate-700 active:bg-black
            transition-colors
          "
        >
          [ ACTUALIZAR PLAN ]
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Operacion veredicto — joint titular + garante
// ─────────────────────────────────────────────

type OperacionStatus = 'viable' | 'con_condiciones' | 'no_recomendada';

function getOperacionStatus(
  titularBcra: number, titularScore: number,
  garanteBcra: number, garanteScore: number,
): OperacionStatus {
  const worstBcra = Math.max(titularBcra, garanteBcra);
  const minScore  = Math.min(titularScore, garanteScore);
  if (worstBcra === 1 && minScore >= 700) return 'viable';
  if (worstBcra <= 3 && minScore >= 400)  return 'con_condiciones';
  return 'no_recomendada';
}

function generateOperacionText(
  titular: Profile, garante: Profile, status: OperacionStatus,
): string {
  const t = titular.bcra_score === 1
    ? `El titular figura en Situación Normal con score ${titular.appto_score ?? 0}/1000.`
    : `El titular registra Situación ${titular.bcra_score} en el BCRA con score ${titular.appto_score ?? 0}/1000.`;
  const g = garante.bcra_score === 1
    ? `El garante figura en Situación Normal con score ${garante.appto_score ?? 0}/1000.`
    : `El garante registra Situación ${garante.bcra_score} con score ${garante.appto_score ?? 0}/1000.`;

  if (status === 'viable')
    return `${t} ${g} Ambos perfiles califican. La operación es viable sin observaciones adicionales.`;
  if (status === 'con_condiciones')
    return `${t} ${g} La operación puede avanzar con el garante como co-firmante, sujeta a condiciones comerciales adicionales.`;
  return `${t} ${g} El riesgo combinado supera los umbrales recomendados. La operación no es recomendada en las condiciones actuales.`;
}

const OPERACION_CONFIG: Record<OperacionStatus, { label: string; color: string; bg: string; border: string }> = {
  viable:          { label: 'OPERACIÓN VIABLE',          color: '#16a34a', bg: 'rgba(22,163,74,0.04)',   border: '#16a34a' },
  con_condiciones: { label: 'VIABLE CON GARANTE',         color: '#d97706', bg: 'rgba(217,119,6,0.04)',   border: '#d97706' },
  no_recomendada:  { label: 'OPERACIÓN NO RECOMENDADA',   color: '#dc2626', bg: 'rgba(220,38,38,0.04)',   border: '#dc2626' },
};

function OperacionVeredicto({ titular, garante }: { titular: Profile; garante: Profile }) {
  const status = getOperacionStatus(
    titular.bcra_score, titular.appto_score ?? 0,
    garante.bcra_score, garante.appto_score ?? 0,
  );
  const cfg  = OPERACION_CONFIG[status];
  const text = generateOperacionText(titular, garante, status);

  return (
    <div
      className="bg-white border rounded-2xl overflow-hidden"
      style={{ borderColor: cfg.border, borderLeft: `4px solid ${cfg.border}` }}
    >
      {/* Header */}
      <div className="px-10 py-6 border-b border-slate-100">
        <span className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">
          EVALUACIÓN DE OPERACIÓN
        </span>
      </div>

      {/* Perfiles lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        {[
          { label: 'TITULAR',  p: titular },
          { label: 'GARANTE',  p: garante },
        ].map(({ label, p }) => (
          <div key={label} className="px-10 py-7 flex flex-col gap-2">
            <span className="text-[9px] font-black tracking-[0.4em] text-slate-400 uppercase">
              {label}
            </span>
            <span className="text-lg font-black text-slate-900 leading-tight">
              {p.full_name}
            </span>
            <span
              className="text-xs font-light text-slate-400 tracking-widest"
              style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
            >
              {p.cuit}
            </span>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-black tracking-[0.15em] px-3 py-1.5 bg-slate-100 text-slate-600">
                ΛPPTO {p.appto_score ?? 0} / 1000
              </span>
              <span
                className="text-[10px] font-black tracking-[0.15em] px-3 py-1.5"
                style={
                  p.bcra_score === 1
                    ? { backgroundColor: 'rgba(22,163,74,0.06)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.2)' }
                    : { backgroundColor: 'rgba(220,38,38,0.06)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }
                }
              >
                BCRA SIT. {p.bcra_score}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Veredicto */}
      <div className="px-10 py-8 border-t border-slate-100" style={{ backgroundColor: cfg.bg }}>
        <span
          className="text-2xl md:text-3xl font-black tracking-tight"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        <p className="text-sm font-light text-slate-600 leading-relaxed max-w-3xl mt-3">
          {text}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Dictamen formal — printable verdict stamp
// ─────────────────────────────────────────────

type DictamenVerdict = 'aprobado' | 'requiere_garante' | 'no_aprobado';

function getDictamenVerdict(bcraScore: number, apptoScore: number): DictamenVerdict {
  if (bcraScore >= 4) return 'no_aprobado';
  if (bcraScore >= 2 || apptoScore < 700) return 'requiere_garante';
  return 'aprobado';
}

const DICTAMEN_CONFIG: Record<DictamenVerdict, { label: string; color: string }> = {
  aprobado:         { label: 'APROBADO',        color: '#16a34a' },
  requiere_garante: { label: 'REQUIERE GARANTE', color: '#d97706' },
  no_aprobado:      { label: 'NO APROBADO',      color: '#dc2626' },
};

function DictamenSello({ profile, issuerName }: { profile: Profile; issuerName?: string | null }) {
  const apptoScore = profile.appto_score ?? 0;
  const verdict    = getDictamenVerdict(profile.bcra_score, apptoScore);
  const cfg        = DICTAMEN_CONFIG[verdict];
  const ref        = profile.id.slice(-8).toUpperCase();
  const bcraLabel  = profile.bcra_score === 1
    ? 'Situación 1 — Normal'
    : `Situación ${profile.bcra_score} — Riesgo`;
  const dateLabel  = new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  }).toUpperCase();

  return (
    <div
      id="dictamen-formal"
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
            Dictamen Formal
          </h2>
          <p className="text-xs font-light text-slate-400">
            Documento para adjuntar a la carpeta del cliente.
          </p>
        </div>
        <PrintButton />
      </div>

      {/* Body */}
      <div className="px-10 py-10 flex flex-col items-center gap-8">

        {/* Sello */}
        <div
          className="w-full max-w-lg flex flex-col items-center justify-center py-10 px-8"
          style={{ border: `4px solid ${cfg.color}` }}
        >
          <span
            className="text-[9px] font-black tracking-[0.5em] uppercase mb-6"
            style={{ color: cfg.color, fontFamily: 'var(--font-geist-mono), monospace' }}
          >
            DICTAMEN CREDITICIO ΛPPTO
          </span>
          <span
            className="text-5xl md:text-6xl font-black tracking-tight text-center leading-none"
            style={{ color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span
            className="text-[9px] font-light tracking-[0.3em] uppercase mt-6"
            style={{ color: cfg.color, fontFamily: 'var(--font-geist-mono), monospace' }}
          >
            REF: {ref} · {dateLabel}
          </span>
        </div>

        {/* Data rows */}
        <div
          className="w-full max-w-lg border border-slate-200 divide-y divide-slate-100"
          style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
        >
          {[
            { label: 'IDENTIFICACIÓN', value: profile.cuit },
            { label: 'DENOMINACIÓN',   value: profile.full_name },
            { label: 'SCORE ΛPPTO',    value: `${apptoScore} / 1000` },
            { label: 'SITUACIÓN BCRA', value: bcraLabel },
            ...(issuerName ? [{ label: 'EMITIDO POR', value: issuerName }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center px-6 py-3 gap-4">
              <span className="text-[9px] font-black tracking-[0.3em] text-slate-400 uppercase w-40 shrink-0">
                {label}
              </span>
              <span className="text-sm font-light text-slate-800">{value}</span>
            </div>
          ))}
        </div>

        {/* Legal */}
        <p
          className="text-[9px] font-light text-slate-400 text-center max-w-lg leading-relaxed tracking-wide"
          style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
        >
          DICTAMEN EMITIDO POR ΛPPTO EL {dateLabel}. LOS DATOS PROVIENEN DE FUENTES PÚBLICAS.
          ESTE DOCUMENTO ES DE CARÁCTER ESTRICTAMENTE INFORMATIVO Y NO CONSTITUYE UNA DECISIÓN CREDITICIA VINCULANTE.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Results — extracted to keep the page readable
// ─────────────────────────────────────────────

function Results({ profile, reviews, links, companyId, company, priorNote, internalNotes, declaredIncome, afipData }: ResultsProps) {
  const isApto = profile.bcra_score === 1
  const bcraLabel =
    profile.bcra_score === 1
      ? "Situación 1 (Normal)"
      : `Situación ${profile.bcra_score} (Riesgo)`
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null

  return (
    <>
      {/* ── BANNER AUDITORÍA PREVIA ── */}
      {priorNote && (
        <div className="bg-slate-50 border border-slate-200 px-8 py-5 flex flex-col gap-1">
          <span className="text-[9px] font-black tracking-[0.4em] text-slate-400 uppercase">
            AUDITORÍA PREVIA
          </span>
          <p className="text-sm font-light text-slate-600">
            Este perfil fue consultado por última vez el{" "}
            <span className="font-black text-slate-900">{formatFullDate(priorNote.created_at)}</span>.
          </p>
        </div>
      )}

      {/* ── TARJETA DE RESULTADOS ── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

        {/* Cabecera */}
        <div className="px-10 pt-10 pb-8 border-b border-slate-100">
          <h1 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-none">
            {profile.full_name}
          </h1>
          <span
            className="mt-3 block text-sm tracking-[0.15em] text-slate-400"
            style={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            CUIT: {profile.cuit}
          </span>
        </div>

        {/* Veredicto */}
        <div
          id="verdict-banner"
          className={`mx-10 mt-8 mb-2 rounded-2xl border px-8 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
            isApto
              ? "bg-green-50 border-green-100"
              : "bg-red-50 border-red-100"
          }`}
        >
          <div className="flex flex-col gap-1">
            <span
              className={`text-[10px] font-black tracking-[0.35em] uppercase opacity-70 ${
                isApto ? "text-green-700" : "text-red-700"
              }`}
            >
              DICTAMEN APPTO
            </span>
            <span
              className="text-3xl md:text-4xl font-black tracking-tight"
              style={
                isApto
                  ? { color: "var(--color-secondary)" }
                  : { color: "#991b1b" }
              }
            >
              {isApto ? "APTO PARA CRÉDITO" : "NO RECOMENDADO"}
            </span>
          </div>
          <span
            className="self-start md:self-center text-[10px] font-black tracking-[0.2em] border rounded-lg px-4 py-2 whitespace-nowrap"
            style={
              isApto
                ? {
                    color: "var(--color-secondary)",
                    borderColor: "var(--color-secondary)",
                  }
                : { color: "#991b1b", borderColor: "#991b1b" }
            }
          >
            REF: {profile.id.slice(-5).toUpperCase()}
          </span>
        </div>

        {/* Cuatro columnas de datos */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 px-10 py-8">
          <div className="flex flex-col gap-2 pb-6 md:pb-0 md:pr-10">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
              SCORE ΛPPTO
            </span>
            <span className="text-2xl font-extrabold text-slate-900 leading-tight">
              {profile.appto_score ?? 0} / 1000
            </span>
            <span className="text-sm font-light text-slate-500">
              Índice crediticio ΛPPTO
            </span>
          </div>

          <div className="flex flex-col gap-2 py-6 md:py-0 md:px-10">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
              SCORE BCRA
            </span>
            <span className="text-2xl font-extrabold text-slate-900 leading-tight">
              {bcraLabel}
            </span>
          </div>

          <div className="flex flex-col gap-2 py-6 md:py-0 md:px-10">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
              SCORE SOCIAL
            </span>
            <span className="text-2xl font-extrabold text-slate-900 leading-tight">
              {avgRating !== null ? `${avgRating.toFixed(1)} / 5` : "—"}
            </span>
            <span className="text-sm font-light text-slate-500">
              {reviews.length > 0
                ? `${reviews.length} evaluación${reviews.length !== 1 ? "es" : ""} de empresas`
                : "Sin evaluaciones aún"}
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-6 md:pt-0 md:pl-10">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
              TENDENCIA 24M
            </span>
            <TrendBadge trend={profile.trend as TrendDirection | null} />
            <span className="text-sm font-light text-slate-500">
              Evolución situación BCRA
            </span>
          </div>
        </div>

        {/* ── SPARKLINE ── */}
        {profile.situacion_history && (profile.situacion_history as SituacionPoint[]).length > 1 && (
          <div className="px-10 py-7 border-t border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-black tracking-[0.4em] text-slate-400 uppercase">
                Evolución situación BCRA — últimos 24 meses
              </span>
              <span
                className="text-[9px] font-light text-slate-300"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {(profile.situacion_history as SituacionPoint[])[0].periodo}
                {" → "}
                {(profile.situacion_history as SituacionPoint[]).slice(-1)[0].periodo}
              </span>
            </div>
            <SituacionSparkline
              history={profile.situacion_history as SituacionPoint[]}
              trend={(profile.trend as TrendDirection) ?? 'estable'}
            />
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-4 border-t border-slate-300" />
                <span className="text-[9px] font-light text-slate-400">SIT. 1 · NORMAL</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 border-t-2 border-red-300" />
                <span className="text-[9px] font-light text-slate-400">SIT. 6 · IRRECUPERABLE</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── DICTAMEN FORMAL ── */}
      <DictamenSello profile={profile} issuerName={company.dictamen_issuer ?? null} />

      {/* ── ESTADO FISCAL AFIP ── */}
      {afipData && <AfipSection afipData={afipData} />}

      {/* ── RED COLABORATIVA ── */}
      <ReviewsSection
        reviews={reviews}
        profileId={profile.id}
        companyId={companyId}
      />

      {/* ── DICTAMEN DEL ANALISTA IA ── */}
      <AnalystVerdict
        bcraScore={profile.bcra_score}
        apptoScore={profile.appto_score ?? 0}
        debtDetail={(profile.debt_detail ?? []) as DebtEntry[]}
      />

      {/* ── ANÁLISIS DE CAPACIDAD ── */}
      {declaredIncome > 0 && (
        <CapacityAnalysis
          declaredIncome={declaredIncome}
          debtDetail={(profile.debt_detail ?? []) as DebtEntry[]}
        />
      )}

      {/* ── COMPOSICIÓN DE DEUDA ── */}
      {profile.debt_detail && (profile.debt_detail as DebtEntry[]).length > 0 && (
        <div id="debt-table" className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-10 py-6 border-b border-slate-100">
            <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
              COMPOSICIÓN DE DEUDA
            </h2>
            <p className="text-xs font-light text-slate-400 mt-1">
              Entidades informantes en el último período disponible del BCRA.
            </p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-10 py-4 text-left text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase">
                  Entidad
                </th>
                <th className="px-6 py-4 text-left text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase">
                  Situación
                </th>
                <th className="px-10 py-4 text-right text-[9px] font-black tracking-[0.35em] text-slate-400 uppercase">
                  Monto Estimado
                </th>
              </tr>
            </thead>
            <tbody>
              {(profile.debt_detail as DebtEntry[]).map((entry, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-10 py-4 text-sm font-light text-slate-700">
                    {entry.descripcion || entry.entidad
                      ? <>{entry.descripcion || String(entry.entidad)}</>
                      : <span className="text-slate-300">—</span>
                    }
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[10px] font-black tracking-[0.15em] px-3 py-1 ${
                        entry.situacion === 1
                          ? "bg-slate-100 text-slate-500"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      SIT. {entry.situacion}
                    </span>
                  </td>
                  <td
                    className="px-10 py-4 text-sm font-light text-slate-700 text-right tabular-nums"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                  >
                    $ {formatIncome(entry.monto * 1000)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── RED DE VÍNCULOS ── */}
      <GroupEvaluationSection mainProfile={profile} links={links} />

      {/* ── NOTAS INTERNAS ── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

        <div className="px-10 py-7 border-b border-slate-100">
          <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
            NOTAS INTERNAS
          </h2>
          <p className="text-xs font-light text-slate-400 mt-1">
            Visibles solo para tu empresa. No se comparten con la red ΛPPTO.
          </p>
        </div>

        {/* Formulario */}
        <div className="px-10 py-7 border-b border-slate-100">
          <form action={saveNote} className="flex flex-col gap-4">
            <input type="hidden" name="profile_id" value={profile.id} />
            <input type="hidden" name="company_id" value={companyId} />
            <textarea
              name="content"
              required
              rows={3}
              placeholder="Agregá una nota sobre este perfil..."
              className="
                w-full bg-transparent border border-slate-200
                px-4 py-3 text-sm font-light text-slate-700
                placeholder:text-slate-300
                focus:outline-none focus:border-slate-500
                resize-none transition-colors
              "
            />
            <button
              type="submit"
              className="
                self-start px-8 py-3
                text-[11px] font-black tracking-[0.2em] text-white
                hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer
              "
              style={{ backgroundColor: "var(--color-secondary)" }}
            >
              GUARDAR NOTA
            </button>
          </form>
        </div>

        {/* Listado de notas */}
        {internalNotes.length === 0 ? (
          <div className="px-10 py-8">
            <p className="text-sm font-light text-slate-400">Sin notas previas para este perfil.</p>
          </div>
        ) : (
          internalNotes.map((note) => (
            <div
              key={note.id}
              className="px-10 py-6 border-b border-slate-100 last:border-0 flex flex-col gap-2"
            >
              <span
                className="text-[9px] font-black tracking-[0.35em] text-slate-300 uppercase"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {formatFullDate(note.created_at)}
              </span>
              <p className="text-sm font-light text-slate-600 leading-relaxed">
                {note.content}
              </p>
            </div>
          ))
        )}
      </div>

      {/* ── AVISO LEGAL ── */}
      <div id="page-footer" className="px-1 pb-6 mt-2">
        <p className="text-xs text-neutral-500 uppercase tracking-wide leading-relaxed">
          LOS DATOS EXHIBIDOS PROVIENEN DE CONSULTAS AUTOMATIZADAS A FUENTES DE ACCESO PÚBLICO. ΛPPTO NO ALTERA, VALIDA NI GARANTIZA LA ACTUALIZACIÓN EN TIEMPO REAL DE DICHOS REGISTROS. ESTE REPORTE ES DE CARÁCTER ESTRICTAMENTE INFORMATIVO.
        </p>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Analyst Verdict — rule-based IA recommendation
// ─────────────────────────────────────────────

function AnalystVerdict({
  bcraScore,
  apptoScore,
  debtDetail,
}: {
  bcraScore:  number;
  apptoScore: number;
  debtDetail: DebtEntry[];
}) {
  const verdict = generateAnalystVerdict(bcraScore, apptoScore, debtDetail);
  const isAlert = bcraScore >= 2 || debtDetail.length > 4;

  return (
    <div
      id="analyst-verdict"
      className="bg-white border border-slate-200 rounded-2xl px-10 py-8 flex flex-col gap-4"
      style={{ borderLeft: `4px solid ${isAlert ? "#1e293b" : "#94a3b8"}` }}
    >
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">
          DICTAMEN DEL ANALISTA IA
        </span>
        <span className="text-[9px] font-light tracking-[0.2em] text-slate-300 uppercase">
          Análisis automatizado basado en datos BCRA
        </span>
      </div>
      <p
        className="text-xl font-light text-slate-800 leading-relaxed max-w-3xl"
        style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
      >
        {verdict}
      </p>
      <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
        <span
          className="text-[9px] font-black tracking-[0.3em] text-slate-400 uppercase"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          SCORE ΛPPTO: {apptoScore} / 1000
        </span>
        <span className="text-slate-200">|</span>
        <span
          className="text-[9px] font-black tracking-[0.3em] text-slate-400 uppercase"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          BCRA: SITUACIÓN {bcraScore}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Trend badge — directional indicator
// ─────────────────────────────────────────────

function TrendBadge({ trend }: { trend: TrendDirection | null }) {
  if (!trend) {
    return (
      <span className="text-2xl font-extrabold text-slate-200">—</span>
    );
  }

  const config: Record<TrendDirection, { label: string; color: string; bg: string; border: string }> = {
    mejorando:  { label: 'EN MEJORA',    color: '#16a34a', bg: 'rgba(22,163,74,0.06)',   border: 'rgba(22,163,74,0.25)'   },
    estable:    { label: 'ESTABLE',      color: '#64748b', bg: 'rgba(100,116,139,0.06)', border: 'rgba(100,116,139,0.25)' },
    empeorando: { label: 'EN DETERIORO', color: '#dc2626', bg: 'rgba(220,38,38,0.06)',   border: 'rgba(220,38,38,0.25)'   },
  };

  const { label, color, bg, border } = config[trend];

  return (
    <span
      className="self-start text-[10px] font-black tracking-[0.2em] px-3 py-1.5 rounded-lg"
      style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Situacion sparkline — 24-month BCRA arc
// ─────────────────────────────────────────────
//
// Risk convention: sit=1 (good) = bottom, sit=6 (bad) = top.
// Area fills upward from the sit=1 baseline to the line —
// more fill = more risk above the clean baseline.

function SituacionSparkline({ history, trend }: { history: SituacionPoint[]; trend: TrendDirection }) {
  if (history.length < 2) return null;

  const W = 500, H = 72, PAD_X = 4, PAD_Y = 10;
  const n = history.length;

  const trendColor =
    trend === 'mejorando'  ? '#16a34a' :
    trend === 'empeorando' ? '#dc2626' :
    '#94a3b8';

  const baselineY = H - PAD_Y;

  // sit=1 → bottom (baselineY), sit=6 → top (PAD_Y)
  const toX = (i: number)   => PAD_X + (i / (n - 1)) * (W - PAD_X * 2);
  const toY = (sit: number) => baselineY - ((sit - 1) / 5) * (H - PAD_Y * 2);

  const polylinePoints = history
    .map((p, i) => `${toX(i).toFixed(1)},${toY(p.situacion).toFixed(1)}`)
    .join(' ');

  // Area: from baseline up to the polyline and back down
  const areaD = [
    `M ${toX(0).toFixed(1)},${baselineY}`,
    `L ${toX(0).toFixed(1)},${toY(history[0].situacion).toFixed(1)}`,
    ...history.slice(1).map((p, i) =>
      `L ${toX(i + 1).toFixed(1)},${toY(p.situacion).toFixed(1)}`
    ),
    `L ${toX(n - 1).toFixed(1)},${baselineY}`,
    'Z',
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: '64px' }}
      aria-hidden="true"
    >
      {/* Baseline: sit=1 (clean) */}
      <line
        x1={PAD_X} y1={baselineY}
        x2={W - PAD_X} y2={baselineY}
        stroke="#e2e8f0" strokeWidth="1"
      />
      {/* Area fill */}
      <path d={areaD} fill={trendColor} fillOpacity="0.08" />
      {/* Sparkline */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={trendColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* First and last dots */}
      <circle cx={toX(0)}     cy={toY(history[0].situacion)}     r="3" fill={trendColor} fillOpacity="0.5" />
      <circle cx={toX(n - 1)} cy={toY(history[n - 1].situacion)} r="3" fill={trendColor} />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Capacity analysis — debt vs declared income
// ─────────────────────────────────────────────
//
// Only rendered when the analyst provides a declared income at search time.
// Calculates: total debt in ARS, months of income to cancel, estimated
// installment at 48 periods vs 30% income cap.

function CapacityAnalysis({
  declaredIncome,
  debtDetail,
}: {
  declaredIncome: number;
  debtDetail: DebtEntry[];
}) {
  const totalDebtArs     = debtDetail.reduce((s, e) => s + e.monto, 0) * 1_000
  const annualIncome     = declaredIncome * 12
  const monthsToCancel   = totalDebtArs > 0 ? totalDebtArs / declaredIncome : 0
  const installment48    = totalDebtArs > 0 ? Math.round(totalDebtArs / 48)  : 0
  const cap30pct         = Math.round(declaredIncome * 0.30)
  const installmentRatio = cap30pct > 0 ? installment48 / cap30pct : 0
  const debtToIncome     = annualIncome > 0 ? (totalDebtArs / annualIncome) * 100 : 0

  const status =
    debtToIncome === 0        ? 'sin_deuda' :
    debtToIncome < 30         ? 'baja'      :
    debtToIncome < 100        ? 'moderada'  :
    debtToIncome < 300        ? 'elevada'   :
    'critica'

  const statusLabel: Record<string, string> = {
    sin_deuda: 'SIN DEUDA ACTIVA',
    baja:      'CAPACIDAD CONFIRMADA',
    moderada:  'CAPACIDAD LIMITADA',
    elevada:   'CAPACIDAD COMPROMETIDA',
    critica:   'CAPACIDAD INSUFICIENTE',
  }
  const statusColor: Record<string, string> = {
    sin_deuda: '#16a34a',
    baja:      '#16a34a',
    moderada:  '#d97706',
    elevada:   '#dc2626',
    critica:   '#991b1b',
  }

  const color = statusColor[status]

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="px-10 py-7 border-b border-slate-100 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
            Análisis de Capacidad
          </h2>
          <p className="text-xs font-light text-slate-400 mt-1">
            Basado en ingreso mensual declarado. No validado por ΛPPTO.
          </p>
        </div>
        <span
          className="self-start text-[10px] font-black tracking-[0.2em] px-4 py-2 rounded-lg"
          style={{ color, backgroundColor: `${color}10`, border: `1px solid ${color}40` }}
        >
          {statusLabel[status]}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100 px-10 py-8">
        <div className="flex flex-col gap-2 pb-6 md:pb-0 md:pr-10">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
            Ingreso Mensual
          </span>
          <span className="text-xl font-extrabold text-slate-900 tabular-nums leading-tight">
            $ {formatIncome(declaredIncome)}
          </span>
          <span className="text-xs font-light text-slate-400">declarado por la empresa</span>
        </div>

        <div className="flex flex-col gap-2 py-6 md:py-0 md:px-10">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
            Deuda / Ingreso Anual
          </span>
          <span className="text-xl font-extrabold tabular-nums leading-tight" style={{ color }}>
            {totalDebtArs === 0 ? "0%" : `${debtToIncome.toFixed(0)}%`}
          </span>
          <span className="text-xs font-light text-slate-400">
            {debtToIncome < 30 ? "dentro del rango" : "fuera del rango recomendado"}
          </span>
        </div>

        <div className="flex flex-col gap-2 py-6 md:py-0 md:px-10">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
            Meses para Cancelar
          </span>
          <span className="text-xl font-extrabold text-slate-900 tabular-nums leading-tight">
            {totalDebtArs === 0 ? "—" : `${monthsToCancel.toFixed(1)} m`}
          </span>
          <span className="text-xs font-light text-slate-400">a ingreso total destinado</span>
        </div>

        <div className="flex flex-col gap-2 pt-6 md:pt-0 md:pl-10">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
            Cuota Est. 48 Meses
          </span>
          <span
            className="text-xl font-extrabold tabular-nums leading-tight"
            style={{ color: installmentRatio > 1 ? '#dc2626' : '#16a34a' }}
          >
            {totalDebtArs === 0 ? "—" : `$ ${formatIncome(installment48)}`}
          </span>
          <span className="text-xs font-light text-slate-400">
            cap. 30%: $ {formatIncome(cap30pct)} / mes
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Rating stars — visual display only
// ─────────────────────────────────────────────

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= rating ? "text-amber-400" : "text-slate-200"}>
          ★
        </span>
      ))}
      <span className="text-[10px] font-black text-slate-400 ml-2 tabular-nums">
        {rating} / 5
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Reviews section — red colaborativa ΛPPTO
// ─────────────────────────────────────────────

function ReviewsSection({
  reviews,
  profileId,
  companyId,
}: {
  reviews: ReviewWithCompany[];
  profileId: string;
  companyId: string;
}) {
  const hasAlreadyReviewed = reviews.some((r) => r.company_id === companyId);
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

      {/* Header */}
      <div className="px-10 py-7 border-b border-slate-100 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
            Red Colaborativa ΛPPTO
          </h2>
          <p className="text-xs font-light text-slate-400 mt-1 max-w-md leading-relaxed">
            Evaluaciones de empresas de la red — datos exclusivos que no existen en el BCRA ni en ninguna otra fuente.
          </p>
        </div>
        {avgRating !== null && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-4xl font-black text-slate-900 tabular-nums leading-none">
              {avgRating.toFixed(1)}
              <span className="text-xl font-light text-slate-300"> / 5</span>
            </span>
            <span className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mt-1">
              {reviews.length} EVALUACIÓN{reviews.length !== 1 ? "ES" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Rating breakdown */}
      {reviews.length > 0 && (
        <div className="px-10 py-6 border-b border-slate-100">
          <div className="flex flex-col gap-2.5 max-w-xs">
            {dist.map(({ star, count }) => {
              const pct = (count / reviews.length) * 100;
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-500 w-3 text-right tabular-nums">
                    {star}
                  </span>
                  <span className="text-amber-400 text-xs leading-none">★</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-light text-slate-400 w-4 tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews list */}
      {reviews.map((review) => (
        <div
          key={review.id}
          className="px-10 py-8 border-b border-slate-100 flex flex-col gap-4"
        >
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-black text-slate-900">
                {review.company.company_name}
              </span>
              <span
                className="text-xs tracking-widest text-slate-400"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                CUIT: {review.company.cuit} · {formatDate(review.created_at)}
              </span>
            </div>
            <RatingStars rating={review.rating} />
          </div>
          {review.comment && (
            <p className="text-sm font-light text-slate-600 leading-relaxed max-w-2xl">
              {review.comment}
            </p>
          )}
        </div>
      ))}

      {/* Empty state */}
      {reviews.length === 0 && (
        <div className="px-10 py-8 border-b border-slate-100">
          <p className="text-sm font-light text-slate-400 leading-relaxed">
            Este perfil aún no tiene evaluaciones en la red. Tu empresa puede ser la primera en aportar datos — esa información no existe en ninguna otra fuente.
          </p>
        </div>
      )}

      {/* Add review form */}
      {!hasAlreadyReviewed ? (
        <ReviewForm profileId={profileId} companyId={companyId} />
      ) : (
        <div className="px-10 py-6 border-t border-slate-100">
          <p className="text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase">
            Tu empresa ya evaluó este perfil — tu aporte está en la red.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Group evaluation — consolidated risk across linked profiles
// ─────────────────────────────────────────────

function GroupEvaluationSection({
  mainProfile,
  links,
}: {
  mainProfile: Profile;
  links: GuarantorLinkWithProfile[];
}) {
  if (links.length === 0) return null;

  const allProfiles = [mainProfile, ...links.map((l) => l.guarantor)];
  const groupWorstBcra = Math.max(...allProfiles.map((p) => p.bcra_score));
  const groupMinAppto  = Math.min(...allProfiles.map((p) => p.appto_score ?? 0));

  const groupStatus =
    groupWorstBcra >= 4 ? 'alto'   :
    groupWorstBcra >= 2 ? 'medio'  :
    'limpio';

  const groupLabel =
    groupStatus === 'alto'   ? 'RIESGO GRUPAL ELEVADO'            :
    groupStatus === 'medio'  ? 'ATENCIÓN — ANTECEDENTES EN LA RED' :
    'GRUPO SIN ANTECEDENTES NEGATIVOS';

  const groupColor =
    groupStatus === 'alto'   ? '#dc2626' :
    groupStatus === 'medio'  ? '#d97706' :
    '#16a34a';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

      {/* Header + group verdict */}
      <div className="px-10 py-7 border-b border-slate-100 flex flex-col md:flex-row md:items-start md:justify-between gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
            Red de Vínculos — Evaluación Grupal
          </h2>
          <p className="text-xs font-light text-slate-400 mt-1">
            Análisis consolidado de todos los perfiles vinculados al expediente.
          </p>
        </div>
        <div
          className="flex flex-col gap-1 shrink-0 pl-5 border-l-4"
          style={{ borderColor: groupColor }}
        >
          <span
            className="text-[10px] font-black tracking-[0.2em] uppercase"
            style={{ color: groupColor }}
          >
            {groupLabel}
          </span>
          <span className="text-[9px] font-light text-slate-400 leading-relaxed">
            {allProfiles.length} perfiles · BCRA máx. Sit. {groupWorstBcra} · Score mín. {groupMinAppto} / 1000
          </span>
        </div>
      </div>

      {/* Linked profile mini-cards */}
      {links.map((link) => {
        const g         = link.guarantor;
        const isRisk    = g.bcra_score > 1;
        const totalDebt = (g.debt_detail ?? []).reduce((s, d) => s + d.monto, 0);

        return (
          <div
            key={link.id}
            className="px-10 py-7 border-b border-slate-100 last:border-0 flex flex-col gap-4"
          >
            {/* Identity row */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-black text-slate-900">{g.full_name}</span>
                <span
                  className="text-xs tracking-widest text-slate-400"
                  style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                  CUIT: {g.cuit}
                </span>
              </div>
              <span className="self-start text-[10px] font-black tracking-[0.15em] text-slate-500 border border-slate-200 rounded-lg px-3 py-1.5 whitespace-nowrap">
                {link.relation_type}
              </span>
            </div>

            {/* Metrics chips */}
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-black tracking-[0.15em] px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600">
                ΛPPTO {g.appto_score ?? "—"} / 1000
              </span>
              <span
                className="text-[10px] font-black tracking-[0.15em] px-3 py-1.5 rounded-lg"
                style={
                  isRisk
                    ? { backgroundColor: "rgba(220,38,38,0.06)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }
                    : { backgroundColor: "rgba(22,163,74,0.06)",  color: "#16a34a", border: "1px solid rgba(22,163,74,0.2)"  }
                }
              >
                BCRA SIT. {g.bcra_score}
              </span>
              {g.trend && <TrendBadge trend={g.trend as TrendDirection | null} />}
              {totalDebt > 0 && (
                <span className="text-[10px] font-black tracking-[0.15em] px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600">
                  DEUDA $ {formatIncome(totalDebt * 1000)}
                </span>
              )}
            </div>

            {/* Link to full profile */}
            <a
              href={`/business?cuit=${g.cuit}`}
              className="self-start text-[10px] font-black tracking-[0.15em] text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg px-4 py-2.5 transition-colors whitespace-nowrap"
            >
              [ VER PERFIL COMPLETO ]
            </a>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// AFIP section — fiscal identity verification
// ─────────────────────────────────────────────
//
// Calls the public AFIP Padrón API using the resolved CUIT (works whether
// the user searched by CUIT or DNI — the DNI→CUIT resolution already happened
// in bcraService before we reach this component).

function AfipSection({ afipData }: { afipData: AfipResult }) {
  const mensualMax = afipIngresoMensualMax(afipData);

  // Build registration chips
  const chips: { label: string; color: string; bg: string; border: string }[] = [];

  if (afipData.esMonotributista && afipData.categoria) {
    chips.push({
      label:  `Monotributo Cat. ${afipData.categoria}`,
      color:  "#1d4ed8",
      bg:     "rgba(29,78,216,0.06)",
      border: "rgba(29,78,216,0.2)",
    });
  } else if (afipData.esMonotributista) {
    chips.push({
      label:  "Monotributo",
      color:  "#1d4ed8",
      bg:     "rgba(29,78,216,0.06)",
      border: "rgba(29,78,216,0.2)",
    });
  }

  if (afipData.esAutonomo) {
    chips.push({
      label:  "Autónomo",
      color:  "#7c3aed",
      bg:     "rgba(124,58,237,0.06)",
      border: "rgba(124,58,237,0.2)",
    });
  }

  if (afipData.esRespInscripto) {
    chips.push({
      label:  "IVA Resp. Inscripto",
      color:  "#0369a1",
      bg:     "rgba(3,105,161,0.06)",
      border: "rgba(3,105,161,0.2)",
    });
  }

  if (chips.length === 0 && afipData.estadoActivo) {
    chips.push({
      label:  "Registrado en AFIP",
      color:  "#64748b",
      bg:     "rgba(100,116,139,0.06)",
      border: "rgba(100,116,139,0.2)",
    });
  }

  const activeColor  = afipData.estadoActivo ? "#16a34a" : "#dc2626";
  const activeBg     = afipData.estadoActivo ? "rgba(22,163,74,0.06)"  : "rgba(220,38,38,0.06)";
  const activeBorder = afipData.estadoActivo ? "rgba(22,163,74,0.25)"  : "rgba(220,38,38,0.25)";
  const activeLabel  = afipData.estadoActivo ? "ACTIVO" : "INACTIVO";

  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
      style={{ borderLeft: `4px solid ${activeColor}` }}
    >
      <div className="px-10 py-7 border-b border-slate-100 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
            Estado Fiscal · AFIP
          </h2>
          <p className="text-xs font-light text-slate-400 mt-1">
            Fuente: Padrón Único de Contribuyentes AFIP (dato público).
          </p>
        </div>
        <span
          className="self-start text-[10px] font-black tracking-[0.25em] px-4 py-2 rounded-lg"
          style={{ color: activeColor, backgroundColor: activeBg, border: `1px solid ${activeBorder}` }}
        >
          {activeLabel}
        </span>
      </div>

      <div className="px-10 py-8 flex flex-col gap-6">

        {/* Registrations */}
        {chips.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
              Inscripciones activas
            </span>
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <span
                  key={c.label}
                  className="text-[10px] font-black tracking-[0.15em] px-3 py-1.5 rounded-lg"
                  style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.border}` }}
                >
                  {c.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Income ceiling from Monotributo category */}
        {afipData.esMonotributista && mensualMax !== null && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
                Facturación máx. habilitada
              </span>
              <span className="text-xl font-extrabold text-slate-900 tabular-nums leading-tight">
                $ {formatIncome(mensualMax)} / mes
              </span>
              <span className="text-xs font-light text-slate-400">
                tope Monotributo Cat. {afipData.categoria} · aprox.
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
                Perfil tributario
              </span>
              <span className="text-sm font-light text-slate-700 leading-relaxed">
                {afipData.categoria && ["A", "B"].includes(afipData.categoria)
                  ? "Pequeño contribuyente — ingresos bajos"
                  : afipData.categoria && ["C", "D", "E"].includes(afipData.categoria)
                  ? "Contribuyente medio — ingresos moderados"
                  : "Contribuyente activo — ingresos altos para monotributo"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
                Nota
              </span>
              <span className="text-xs font-light text-slate-400 leading-relaxed">
                El tope de facturación no equivale al ingreso neto real. Actualizable
                cada cuatrimestre por AFIP.
              </span>
            </div>
          </div>
        )}

        {/* Inactive warning */}
        {!afipData.estadoActivo && (
          <div className="p-4 rounded-xl border border-red-100 bg-red-50">
            <p className="text-xs font-light text-red-700 leading-relaxed">
              La clave fiscal figura como <strong>inactiva o bloqueada</strong> en el padrón de AFIP.
              Esto puede indicar que la persona no ejerce actividad formal registrada actualmente.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}

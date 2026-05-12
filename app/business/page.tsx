export const preferredRegion = 'gru1'; // São Paulo — IPs not blocked by BCRA WAF

import { redirect } from "next/navigation";
import { supabase, getSupabaseAdmin } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
import { getOrFetchProfile } from "@/lib/services/dataFetcher";
import { signOut } from "@/app/actions/auth";
import { saveNote } from "@/app/actions/business";
import { generateAnalystVerdict } from "@/lib/utils/scoring";
import type {
  Company,
  Profile,
  Note,
  DebtEntry,
  ReviewWithCompany,
  GuarantorLinkWithProfile,
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
  companyId:     string;
  priorNote:     Note | null;
  internalNotes: Note[];
}

async function getProfileContext(profile: Profile): Promise<ProfileData> {
  const [{ data: reviews }, { data: links }] = await Promise.all([
    (supabase as any)
      .from("reviews")
      .select("*, company:companies(*)")
      .eq("profile_id", profile.id),
    (supabase as any)
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
  searchParams: Promise<{ cuit?: string }>;
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

  const searchParams = await props.searchParams;
  const rawCuit = searchParams.cuit?.replace(/\D/g, '') || undefined;

  let quotaExhausted = false;
  let exhaustedPlanTier = "";
  let result: ProfileData | null = null;
  let noRecords = false;   // Estado A: CUIT/CUIL truly absent from all BCRA endpoints
  let zeroDebt  = false;   // Estado B: found in BCRA but zero active debt (has historical activity)
  let apiError  = false;   // BCRA API down / network failure — do not treat as Estado A
  let priorNote: Note | null = null;
  let internalNotes: Note[] = [];

  if (rawCuit) {
    let fetchOutcome: Awaited<ReturnType<typeof getOrFetchProfile>>;
    try {
      fetchOutcome = await getOrFetchProfile(rawCuit);
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
        result = await getProfileContext(fetchOutcome.profile);

        // Audit log — service_role bypasses RLS so this never silently fails.
        try {
          const { error: histError } = await (getSupabaseAdmin() as any)
            .from("search_history")
            .insert({
              company_id:   company.id,
              query_target: rawCuit,
              result_score: fetchOutcome.profile.appto_score,
              status:       "success",
            });
          if (histError) {
            console.error("[DATABASE ERROR] Falló el registro del historial:", histError);
          }
        } catch (err) {
          console.error("[DATABASE ERROR] Excepción al registrar historial:", err);
        }

        // Estado B: person was found in BCRA but currently carries no active debt.
        // Only flag this when hasHistoricalActivity is true; if it's false the
        // API responded but with fully empty arrays (treat as Estado A).
        if (
          fetchOutcome.hasHistoricalActivity &&
          (fetchOutcome.profile.debt_detail?.length ?? 0) === 0
        ) {
          zeroDebt = true;
        }

        const { data } = await authClient
          .from("notes")
          .select("*")
          .eq("company_id", company.id)
          .eq("profile_id", fetchOutcome.profile.id)
          .order("created_at", { ascending: false });
        internalNotes = (data ?? []) as Note[];
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

          /* Remove screen chrome */
          body { background: white !important; }
          * { box-shadow: none !important; }

          /* Flatten all color fills — keep borders, reset them to light gray */
          *, *::before, *::after { background-color: white !important; }
          [class*="border"] { border-color: #d1d5db !important; }

          /* All text black */
          * { color: #000 !important; }

          /* Strip rounded corners for a document feel */
          * { border-radius: 0 !important; }

          /* Hide interactive and non-report elements */
          #search-form, #page-footer, button { display: none !important; }

          /* Reveal print-only header */
          #print-header { display: flex !important; }

          /* Analyst verdict — stand out with a heavy left rule */
          #analyst-verdict {
            border-left: 4px solid #000 !important;
            padding-left: 20px !important;
          }

          /* Keep debt table together */
          #debt-table { page-break-inside: avoid; }
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
          className="bg-white border border-slate-200 rounded-2xl px-8 py-7 flex flex-col md:flex-row gap-5 md:items-end"
        >
          <div className="flex-1 flex flex-col gap-2">
            <label
              htmlFor="cuit-input"
              className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase"
            >
              IDENTIFICACIÓN FISCAL
            </label>
            <input
              id="cuit-input"
              type="text"
              name="cuit"
              defaultValue={searchParams.cuit ?? ""}
              placeholder="DNI o CUIL sin guiones"
              className="
                w-full text-3xl font-light text-slate-800 bg-transparent
                border-0 border-b-2 border-slate-200
                py-3 px-0
                placeholder:text-slate-300
                focus:outline-none focus:border-slate-700
                transition-colors
              "
            />
            <p className="text-xs font-light text-slate-400 tracking-wide">
              Podés ingresar DNI o CUIL completo sin guiones. Con 11 dígitos se busca directamente.
            </p>
          </div>
          <button
            type="submit"
            className="
              px-10 py-4 rounded-xl shrink-0
              text-[11px] font-black tracking-[0.25em] text-white
              hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer
            "
            style={{ backgroundColor: "var(--color-secondary)" }}
          >
            CONSULTAR
          </button>
        </form>

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
            priorNote={priorNote}
            internalNotes={internalNotes}
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
    <div className="bg-white border border-slate-200 rounded-2xl px-10 py-16 flex flex-col gap-4">
      <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
        SIN REGISTROS EN BCRA
      </span>
      <p className="text-3xl font-black text-slate-900 tracking-tight">
        SIN REGISTROS HISTÓRICOS
      </p>
      <p className="text-sm font-light text-slate-500 max-w-sm leading-relaxed">
        El identificador{" "}
        <span
          className="font-bold tracking-widest"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          {cuit}
        </span>{" "}
        no registra actividad en ningún período de la Central de Deudores del BCRA.
        Es probable que esta persona nunca haya operado en el sistema financiero formal.
      </p>
      <p className="text-xs font-light text-slate-400 border-l-2 border-slate-200 pl-4 mt-2">
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
// Results — extracted to keep the page readable
// ─────────────────────────────────────────────

function Results({ profile, reviews, links, companyId, priorNote, internalNotes }: ResultsProps) {
  const isApto = profile.bcra_score === 1
  const bcraLabel =
    profile.bcra_score === 1
      ? "Situación 1 (Normal)"
      : `Situación ${profile.bcra_score} (Riesgo)`
  const socialScore =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 10.0

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
              {socialScore.toFixed(1)} / 10
            </span>
            <span className="text-sm font-light text-slate-500">
              Promedio de reseñas
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-6 md:pt-0 md:pl-10">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
              INGRESOS ESTIMADOS
            </span>
            <span className="text-2xl font-extrabold text-slate-900 leading-tight">
              $ {formatIncome(profile.estimated_income)}
            </span>
          </div>
        </div>
      </div>

      {/* ── DICTAMEN DEL ANALISTA IA ── */}
      <AnalystVerdict
        bcraScore={profile.bcra_score}
        apptoScore={profile.appto_score ?? 0}
        debtDetail={(profile.debt_detail ?? []) as DebtEntry[]}
      />

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
                    {entry.descripcion}
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

      {/* ── RED DE GARANTÍAS ── */}
      {links.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-10 py-7 border-b border-slate-100">
            <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
              POTENCIALES GARANTES DETECTADOS
            </h2>
            <p className="text-xs font-light text-slate-400 mt-1">
              Vínculos detectados por la red ΛPPTO — no son co-deudores confirmados
            </p>
          </div>

          {links.map((link) => (
            <div
              key={link.id}
              className="px-10 py-7 border-b border-slate-100 last:border-0 flex flex-col md:flex-row md:items-center md:justify-between gap-5"
            >
              <div className="flex flex-col gap-1">
                <span className="text-base font-black text-slate-900">
                  {link.guarantor.full_name}
                </span>
                <span
                  className="text-xs tracking-widest text-slate-400"
                  style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                  CUIT: {link.guarantor.cuit}
                </span>
                <span className="text-xs font-light text-slate-500 mt-1">
                  {link.relation_type}
                </span>
              </div>

              <button className="self-start md:self-center text-[10px] font-black tracking-[0.15em] text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg px-4 py-2.5 transition-colors whitespace-nowrap cursor-pointer">
                [ EVALUAR GARANTE ]
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── HISTORIAL DE REPUTACIÓN ── */}
      {reviews.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-10 py-7 border-b border-slate-100">
            <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
              REGISTRO COLABORATIVO DE EMPRESAS
            </h2>
            <p className="text-xs font-light text-slate-400 mt-1">
              Reseñas verificadas de empresas participantes de la red ΛPPTO
            </p>
          </div>

          {reviews.map((review) => (
            <div
              key={review.id}
              className="px-10 py-8 border-b border-slate-100 last:border-0 flex flex-col gap-4"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
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
                <span className="self-start md:self-center text-[10px] font-black tracking-[0.2em] text-slate-500 border border-slate-200 rounded-md px-3 py-1.5 whitespace-nowrap">
                  {review.rating} / 5
                </span>
              </div>
              <p className="text-sm font-light text-slate-600 leading-relaxed max-w-2xl">
                {review.comment}
              </p>
            </div>
          ))}
        </div>
      )}

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

      {/* ── DISCLAIMER ── */}
      <div id="page-footer" className="bg-slate-100 rounded-2xl px-8 py-6 mb-4">
        <p className="text-xs font-light text-slate-500 leading-relaxed">
          <span className="font-black text-slate-600">[ i ]</span>{" "}
          La información presentada es de carácter referencial y no constituye una
          recomendación financiera. Los datos provienen de fuentes públicas y
          colaborativas verificadas. ΛPPTO no se responsabiliza por decisiones
          crediticias tomadas exclusivamente en base a este reporte.
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

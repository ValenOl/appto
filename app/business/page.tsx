import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "@/app/actions/auth";
import type {
  Company,
  Profile,
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

// ─────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────

interface ProfileData {
  profile: Profile;
  reviews: ReviewWithCompany[];
  links: GuarantorLinkWithProfile[];
}

async function getProfileData(cuit: string): Promise<ProfileData | null> {
  const { data: profile, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("cuit", cuit)
    .single();

  if (profileError || !profile) return null;

  // Fetch reviews and guarantor links in parallel
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
    links: (links ?? []) as GuarantorLinkWithProfile[],
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
    .single();
  const company = companyData as Company | null;

  if (!company) redirect("/login");

  if (company.subscription_status === "pending") {
    return <PendingGate company={company} />;
  }
  // ─────────────────────────────────────────────

  const searchParams = await props.searchParams;
  const rawCuit = searchParams.cuit?.trim() || undefined;

  let quotaExhausted = false;
  let exhaustedPlanTier = "";
  let result: ProfileData | null = null;

  if (rawCuit) {
    const consumed = await consumeCredit(company.id);
    if (!consumed) {
      quotaExhausted = true;
      exhaustedPlanTier = company.plan_tier;
    } else {
      result = await getProfileData(rawCuit);
    }
  }

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      {/* ── TOPBAR ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <span className="text-sm font-black tracking-tight text-slate-900 shrink-0">
            ΛPPTO{" "}
            <span className="font-light text-slate-400 tracking-widest text-xs">
              [ BUSINESS ]
            </span>
          </span>

          <nav className="flex items-center gap-6 md:gap-8 overflow-x-auto">
            <a
              href="/"
              className="text-[11px] font-black tracking-[0.2em] text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              NUEVA CONSULTA
            </a>
            <a
              href="#"
              className="text-[11px] font-black tracking-[0.2em] text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              HISTORIAL
            </a>
            <form action={signOut}>
              <button
                type="submit"
                className="text-[11px] font-black tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap cursor-pointer"
              >
                [ CERRAR SESIÓN ]
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* ── BUSCADOR ── */}
        {/*
          Native form with method="get" — no JS required.
          On submit, navigates to /business?cuit=... and the Server Component
          re-renders with the new searchParams.
        */}
        <form
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
              placeholder="Ingresar CUIT / CUIL"
              className="
                w-full text-3xl font-light text-slate-800 bg-transparent
                border-0 border-b-2 border-slate-200
                py-3 px-0
                placeholder:text-slate-300
                focus:outline-none focus:border-slate-700
                transition-colors
              "
            />
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
        ) : quotaExhausted ? (
          <QuotaExhausted planTier={exhaustedPlanTier} />
        ) : !result ? (
          <div className="bg-white border border-slate-200 rounded-2xl px-10 py-16 flex flex-col gap-4">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
              SIN RESULTADOS
            </span>
            <p className="text-3xl font-black text-slate-900 tracking-tight">
              CUIT NO ENCONTRADO
            </p>
            <p className="text-sm font-light text-slate-500 max-w-sm leading-relaxed">
              No existe un perfil asociado al CUIT{" "}
              <span
                className="font-bold tracking-widest"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {rawCuit}
              </span>{" "}
              en la red ΛPPTO.
            </p>
          </div>
        ) : (
          <Results {...result} />
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

function Results({ profile, reviews, links }: ProfileData) {
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

        {/* Tres columnas de datos */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 px-10 py-8">
          <div className="flex flex-col gap-2 pb-6 md:pb-0 md:pr-10">
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

      {/* ── DISCLAIMER ── */}
      <div className="bg-slate-100 rounded-2xl px-8 py-6 mb-4">
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

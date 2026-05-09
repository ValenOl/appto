import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/utils/supabase/server";
import { submitReply } from "@/app/actions/reviews";
import { signOut } from "@/app/actions/auth";
import type {
  Profile,
  ReviewWithCompany,
  GuarantorLinkWithProfile,
} from "@/types/database";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

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

async function getProfileData(userId: string): Promise<ProfileData | null> {
  const { data: profileData, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  const profile = profileData as Profile | null;

  if (profileError || !profile) return null;

  const [{ data: reviewsData }, { data: linksData }] = await Promise.all([
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
    reviews: (reviewsData ?? []) as ReviewWithCompany[],
    links: (linksData ?? []) as GuarantorLinkWithProfile[],
  };
}

// ─────────────────────────────────────────────
// Diagnóstico automático — generado desde datos
// ─────────────────────────────────────────────

type InsightType = "+" | "i" | "!";

interface Insight {
  type: InsightType;
  text: string;
}

function generateInsights(
  profile: Profile,
  reviews: ReviewWithCompany[],
  socialScore: number,
  isApto: boolean
): Insight[] {
  const insights: Insight[] = [];

  if (profile.bcra_score === 1) {
    insights.push({
      type: "+",
      text: "Sin deudas registradas en el BCRA. Tu Situación 1 (Normal) es el mejor estado posible.",
    });
  } else if (profile.bcra_score <= 3) {
    insights.push({
      type: "i",
      text: `Situación BCRA ${profile.bcra_score}: tenés deudas en seguimiento. Regularizarlas mejorará tu score.`,
    });
  } else {
    insights.push({
      type: "!",
      text: `Situación BCRA ${profile.bcra_score}: deudas en mora detectadas. Contactá a tu entidad para regularizarlas.`,
    });
  }

  if (socialScore >= 9) {
    insights.push({
      type: "+",
      text: `Tu Score Social de ${socialScore.toFixed(1)} te ubica en el percentil superior de la red ΛPPTO.`,
    });
  } else if (socialScore >= 7) {
    insights.push({
      type: "i",
      text: `Score Social de ${socialScore.toFixed(1)}. Sumá más empresas verificadas para subir tu reputación.`,
    });
  }

  if (reviews.length > 0) {
    const best = reviews.reduce((prev, curr) =>
      curr.rating > prev.rating ? curr : prev
    );
    insights.push({
      type: "+",
      text: `Tu historial en ${best.company.company_name} impacta positivamente en tu reputación crediticia.`,
    });
  }

  if (profile.estimated_income >= 1_000_000) {
    insights.push({
      type: "i",
      text: "Tus ingresos estimados son suficientes para calificar a un crédito hipotecario base según los parámetros actuales.",
    });
  }

  if (isApto) {
    insights.push({
      type: "+",
      text: "Tu dictamen ΛPPTO es APTO. Las empresas adheridas pueden consultarte sin restricciones.",
    });
  }

  return insights;
}

// ─────────────────────────────────────────────
// Page (Server Component)
// ─────────────────────────────────────────────

export default async function PersonalDashboard() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect("/login");

  const result = await getProfileData(user.id);
  if (!result) redirect("/login");

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
              [ MI PERFIL ]
            </span>
          </span>

          <nav className="flex items-center gap-6 md:gap-8 overflow-x-auto">
            <a
              href="#"
              className="text-[11px] font-black tracking-[0.2em] text-slate-500 hover:text-slate-900 transition-colors whitespace-nowrap"
            >
              [ EDUCACIÓN FINANCIERA ]
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
        <Dashboard {...result} />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────
// Dashboard principal
// ─────────────────────────────────────────────

function Dashboard({ profile, reviews, links: _links }: ProfileData) {
  const isApto = profile.bcra_score === 1
  const bcraLabel =
    profile.bcra_score === 1
      ? "Situación 1 (Normal)"
      : `Situación ${profile.bcra_score} (Riesgo)`
  const socialScore =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 10.0
  const scoreIsHigh = socialScore > 7
  const insights = generateInsights(profile, reviews, socialScore, isApto);

  return (
    <>
      {/* ── HEALTH SCORE ── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">

          {/* Columna izquierda — saludo y contexto */}
          <div className="px-10 py-12 flex flex-col justify-between gap-8 border-b lg:border-b-0 lg:border-r border-slate-100">
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
                PORTAL PERSONAL
              </span>
              <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                HOLA,{" "}
                <span className="block">{profile.full_name}</span>
              </h1>
              <p className="text-sm font-light text-slate-500 leading-relaxed max-w-xs">
                Este es tu estado financiero en tiempo real dentro de la red ΛPPTO.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <span
                className="text-xs tracking-[0.15em] text-slate-400"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                ESTADO BCRA: {bcraLabel.toUpperCase()}
              </span>
              <span
                className="text-xs tracking-[0.15em] text-slate-400"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                CUIT: {profile.cuit}
              </span>
            </div>
          </div>

          {/* Columna derecha — score gigante */}
          <div className="px-10 py-12 flex flex-col items-start lg:items-end justify-center gap-4">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
              [ SCORE SOCIAL ACUMULADO ]
            </span>

            <div className="flex items-end gap-3">
              <span
                className="text-8xl lg:text-9xl font-black leading-none tracking-tighter"
                style={
                  scoreIsHigh
                    ? { color: "var(--color-secondary)" }
                    : { color: "#0f172a" }
                }
              >
                {socialScore.toFixed(1)}
              </span>
              <span className="text-2xl font-black text-slate-200 mb-3 leading-none">
                / 10
              </span>
            </div>

            <span className="text-sm font-light text-slate-500">
              Promedio de reseñas
            </span>
          </div>
        </div>
      </div>

      {/* ── DIAGNÓSTICO AUTOMATIZADO ── */}
      <div className="bg-slate-100 rounded-2xl px-8 py-8 flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase">
            DIAGNÓSTICO AUTOMATIZADO
          </span>
          <p className="text-xs font-light text-slate-500">
            Generado a partir de tus datos verificados — actualizado en tiempo real
          </p>
        </div>

        <ul className="flex flex-col gap-4">
          {insights.map((insight, i) => (
            <li key={i} className="flex gap-4 items-start">
              <span
                className="text-[10px] font-black tracking-widest shrink-0 mt-0.5 px-2 py-1 rounded border"
                style={
                  insight.type === "+"
                    ? {
                        color: "var(--color-secondary)",
                        borderColor: "var(--color-secondary)",
                        backgroundColor: "rgba(0,108,73,0.06)",
                      }
                    : insight.type === "!"
                    ? { color: "#991b1b", borderColor: "#fca5a5", backgroundColor: "#fef2f2" }
                    : { color: "#475569", borderColor: "#cbd5e1", backgroundColor: "#f8fafc" }
                }
              >
                {insight.type === "+" ? "[ + ]" : insight.type === "!" ? "[ ! ]" : "[ i ]"}
              </span>
              <span className="text-sm font-light text-slate-700 leading-relaxed">
                {insight.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── MURO DE REPUTACIÓN ── */}
      {reviews.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-10 py-7 border-b border-slate-100">
            <h2 className="text-[11px] font-black tracking-[0.3em] text-slate-900 uppercase">
              QUÉ DICEN LAS EMPRESAS DE TI
            </h2>
            <p className="text-xs font-light text-slate-400 mt-1">
              Podés ejercer tu derecho a réplica pública debajo de cada reseña
            </p>
          </div>

          {reviews.map((review) => (
            <div
              key={review.id}
              className="border-b border-slate-100 last:border-0"
            >
              {/* Review */}
              <div className="px-10 pt-8 pb-6 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-black text-slate-900">
                      {review.company.company_name}
                    </span>
                    <span
                      className="text-xs tracking-widest text-slate-400"
                      style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                    >
                      {formatDate(review.created_at)}
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

              {/* Réplica — condicional */}
              {review.reply_text ? (
                <div className="px-10 pb-8">
                  <div className="border-l-2 border-slate-200 pl-4 flex flex-col gap-1">
                    <span className="text-[10px] font-black tracking-[0.3em] text-slate-300 uppercase">
                      TU RÉPLICA
                    </span>
                    <p className="text-sm font-light text-slate-500 leading-relaxed">
                      {review.reply_text}
                    </p>
                  </div>
                </div>
              ) : (
                <form
                  action={submitReply}
                  className="px-10 pb-8 flex flex-col gap-4"
                >
                  <input type="hidden" name="review_id" value={review.id} />

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black tracking-[0.3em] text-slate-300 uppercase">
                      TU RÉPLICA
                    </label>
                    <textarea
                      name="reply"
                      rows={3}
                      placeholder="Redactar réplica pública..."
                      className="
                        w-full bg-transparent resize-none
                        border-0 border-b border-slate-200
                        py-3 px-0
                        text-sm font-light text-slate-700
                        placeholder:text-slate-300
                        focus:outline-none focus:border-slate-500
                        transition-colors leading-relaxed
                      "
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="text-[10px] font-black tracking-[0.2em] text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg px-5 py-2.5 transition-colors cursor-pointer"
                    >
                      [ ENVIAR RÉPLICA ]
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {reviews.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl px-10 py-12 flex flex-col gap-3">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
            QUÉ DICEN LAS EMPRESAS DE TI
          </span>
          <p className="text-2xl font-black text-slate-900">
            Sin reseñas todavía
          </p>
          <p className="text-sm font-light text-slate-500 leading-relaxed max-w-sm">
            Cuando una empresa adherida a ΛPPTO te evalúe, sus reseñas verificadas
            aparecerán aquí.
          </p>
        </div>
      )}
    </>
  );
}

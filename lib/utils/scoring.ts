import type {
  BcraDeudaResults,
  BcraHistorialResults,
  BcraChequesResults,
} from "@/lib/services/bcraService";
import type { DebtEntry, SituacionPoint } from "@/types/database";
import { getUvaRate } from "@/lib/utils/uvaRate";

// ── Penalty constants ─────────────────────────────────────────────────────

const PENALTY_SITUATION      = 200;  // per BCRA situation point above 1
const PENALTY_CHECKS         = 100;  // recent rejected check (last 6 months)
const PENALTY_INSTABILITY    = 50;   // situation jump > 1 between periods
const PENALTY_MULTIBANK      = 100;  // > 4 reporting entities in latest period
const PENALTY_DEBT_HIGH      = 75;   // total debt above high threshold
const PENALTY_DEBT_VERY_HIGH = 150;  // total debt above very-high threshold (replaces, not stacked)

const THRESHOLD_MULTIBANK = 4;

// Debt thresholds in UVA units — inflation-resistant.
// Equivalent to ~5M and ~20M ARS at the mid-2026 UVA baseline of 1,850.
// At runtime these are multiplied by getUvaRate() to get the current ARS equivalent.
// Update UVA_RATE in env vars to recalibrate without a code deploy.
const THRESHOLD_DEBT_HIGH_UVA      = 2_700   // ~5,000,000 ARS at baseline
const THRESHOLD_DEBT_VERY_HIGH_UVA = 10_800  // ~20,000,000 ARS at baseline

// ── Score calculator ──────────────────────────────────────────────────────
//
// Scale: 0–1000 (higher = better)
//   Base:  1000
//   -200   per BCRA situation point above 1  (Sit 3 → -400)
//   -100   recent rejected check
//   -50    historical instability (jump > 1 between periods)
//   -100   multibancarización (> 4 entities in latest period)
//   -75    total debt above high UVA threshold (~5M ARS at baseline)
//   -150   total debt above very-high UVA threshold (~20M ARS at baseline)

export function calculateApptoScore(
  deuda:    BcraDeudaResults | null,
  historial: BcraHistorialResults | null,
  cheques:  BcraChequesResults | null,
): number {
  let score = 1000;

  // Scan forward through the BCRA 24-month window for the most recent period
  // that actually carries debt entries. periodos[0] can be empty when the
  // person just paid off their last obligation (zero active debt).
  const periodWithData = deuda?.periodos?.find((p) => p.entidades.length > 0) ?? null;

  if (periodWithData) {
    // Worst-situation penalty
    const worstSit = Math.max(...periodWithData.entidades.map((e) => e.situacion));
    if (worstSit > 1) score -= (worstSit - 1) * PENALTY_SITUATION;

    // Multibancarización: too many concurrent creditors signals high leverage risk
    if (periodWithData.entidades.length > THRESHOLD_MULTIBANK) {
      score -= PENALTY_MULTIBANK;
    }

    // Absolute debt load — thresholds in miles ARS, derived from UVA to stay inflation-resistant
    const uvaRate        = getUvaRate()
    const threshHigh     = THRESHOLD_DEBT_HIGH_UVA      * uvaRate / 1_000
    const threshVeryHigh = THRESHOLD_DEBT_VERY_HIGH_UVA * uvaRate / 1_000
    const totalMonto     = periodWithData.entidades.reduce((sum, e) => sum + e.monto, 0);
    if (totalMonto > threshVeryHigh) {
      score -= PENALTY_DEBT_VERY_HIGH;
    } else if (totalMonto > threshHigh) {
      score -= PENALTY_DEBT_HIGH;
    }
  }

  // Rejected checks in the last 6 months
  if (cheques?.causales?.length) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const hasRecentRejection = cheques.causales.some(
      (c) => new Date(c.fechaRechazo) >= sixMonthsAgo
    );
    if (hasRecentRejection) score -= PENALTY_CHECKS;
  }

  // Historical instability: abrupt situation jumps suggest volatile payment behavior
  if (historial?.periodos && historial.periodos.length > 1) {
    const sits = historial.periodos.map((p) => p.situacion);
    const unstable = sits.some((s, i) => i > 0 && Math.abs(s - sits[i - 1]) > 1);
    if (unstable) score -= PENALTY_INSTABILITY;
  }

  return Math.max(0, score);
}

// ── Analyst verdict ───────────────────────────────────────────────────────
//
// Rule-based recommendation phrase for B2B display.
// Operates on persisted Profile data — no external calls.

export function generateAnalystVerdict(
  bcraScore:  number,
  apptoScore: number,
  debtDetail: DebtEntry[],
): string {
  const uvaRate        = getUvaRate()
  const threshHigh     = THRESHOLD_DEBT_HIGH_UVA      * uvaRate / 1_000
  const threshVeryHigh = THRESHOLD_DEBT_VERY_HIGH_UVA * uvaRate / 1_000

  const entityCount    = debtDetail.length;
  const totalMonto     = debtDetail.reduce((sum, e) => sum + e.monto, 0);
  const isMultibank    = entityCount > THRESHOLD_MULTIBANK;
  const isHighDebt     = totalMonto  > threshHigh;
  const isVeryHighDebt = totalMonto  > threshVeryHigh;

  // Irregular situations — ordered from worst to least severe
  if (bcraScore >= 6) {
    return "Perfil de alto riesgo. Deuda declarada irrecuperable en el BCRA. Aprobación no recomendada sin garantías reales y análisis legal previo.";
  }

  if (bcraScore >= 4) {
    return "Alerta: Deuda en situación de riesgo elevado en el BCRA. No se recomienda aprobación sin análisis exhaustivo de garantías.";
  }

  if (bcraScore >= 2) {
    return "Perfil con antecedentes de mora o situación irregular en el BCRA. Se recomienda solicitar garantías adicionales y documentación de ingresos.";
  }

  // Situación 1 — normal BCRA classification

  if (entityCount === 0) {
    if (apptoScore >= 950) {
      return "Perfil limpio sin obligaciones activas. Sin antecedentes negativos detectados. Candidato idóneo para créditos prendarios o hipotecarios.";
    }
    return "Perfil sólido con historial limpio. Comportamiento de pago normal. Recomendado para créditos prendarios.";
  }

  if (isMultibank && isVeryHighDebt) {
    return "Alerta: Alta carga de deuda distribuida en múltiples entidades financieras. Se sugiere aval adicional y evaluación detallada del flujo de ingresos.";
  }

  if (isMultibank) {
    return "Perfil activo con multibancarización detectada. Verificar capacidad de repago adicional antes de sumar nuevas obligaciones crediticias.";
  }

  if (isVeryHighDebt) {
    return "Deuda total elevada registrada en el sistema financiero. Se recomienda evaluar relación deuda/ingreso antes de aprobar nuevas operaciones.";
  }

  if (isHighDebt) {
    return "Deuda total significativa. Situación normal en el BCRA, pero se sugiere analizar la relación deuda/ingreso del solicitante.";
  }

  if (apptoScore >= 850) {
    return "Perfil sólido con historial limpio. Comportamiento de pago normal. Recomendado para créditos prendarios.";
  }

  return "Perfil con historial crediticio regular. Se recomienda evaluar antecedentes de pago antes de aprobar nuevas operaciones.";
}

// ── Trend analysis ────────────────────────────────────────────────────────
//
// Compares average situacion of the last 3 months vs the 3 months before that.
// Requires at least 4 data points to be meaningful.
// situacion: lower = better (1=normal, 6=irrecuperable), so a negative delta means improvement.

export type TrendDirection = 'mejorando' | 'estable' | 'empeorando';

export function calculateTrend(history: SituacionPoint[]): TrendDirection {
  if (history.length < 4) return 'estable';

  // history is chronological (oldest first)
  const recent   = history.slice(-3);
  const previous = history.slice(-6, -3);

  if (previous.length === 0) return 'estable';

  const recentAvg   = recent.reduce((s, p) => s + p.situacion, 0) / recent.length;
  const previousAvg = previous.reduce((s, p) => s + p.situacion, 0) / previous.length;

  const delta = recentAvg - previousAvg;

  if (delta < -0.25) return 'mejorando';   // situacion bajó = mejor
  if (delta > 0.25)  return 'empeorando';  // situacion subió = peor
  return 'estable';
}

import type {
  BcraDeudaResults,
  BcraHistorialResults,
  BcraChequesResults,
} from "@/lib/services/bcraService";
import type { DebtEntry } from "@/types/database";

// ── Penalty constants ─────────────────────────────────────────────────────

const PENALTY_SITUATION      = 200;  // per BCRA situation point above 1
const PENALTY_CHECKS         = 100;  // recent rejected check (last 6 months)
const PENALTY_INSTABILITY    = 50;   // situation jump > 1 between periods
const PENALTY_MULTIBANK      = 100;  // > 4 reporting entities in latest period
const PENALTY_DEBT_HIGH      = 75;   // total debt > 5,000 units (= 5,000,000 ARS)
const PENALTY_DEBT_VERY_HIGH = 150;  // total debt > 20,000 units (= 20,000,000 ARS)

const THRESHOLD_MULTIBANK       = 4;
const THRESHOLD_DEBT_HIGH       = 5_000;   // miles ARS
const THRESHOLD_DEBT_VERY_HIGH  = 20_000;  // miles ARS

// ── Score calculator ──────────────────────────────────────────────────────
//
// Scale: 0–1000 (higher = better)
//   Base:  1000
//   -200   per BCRA situation point above 1  (Sit 3 → -400)
//   -100   recent rejected check
//   -50    historical instability (jump > 1 between periods)
//   -100   multibancarización (> 4 entities in latest period)
//   -75    total debt > 5 M ARS
//   -150   total debt > 20 M ARS (replaces -75, not stacked)

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

    // Absolute debt load
    const totalMonto = periodWithData.entidades.reduce((sum, e) => sum + e.monto, 0);
    if (totalMonto > THRESHOLD_DEBT_VERY_HIGH) {
      score -= PENALTY_DEBT_VERY_HIGH;
    } else if (totalMonto > THRESHOLD_DEBT_HIGH) {
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
  const entityCount    = debtDetail.length;
  const totalMonto     = debtDetail.reduce((sum, e) => sum + e.monto, 0);
  const isMultibank    = entityCount > THRESHOLD_MULTIBANK;
  const isHighDebt     = totalMonto  > THRESHOLD_DEBT_HIGH;
  const isVeryHighDebt = totalMonto  > THRESHOLD_DEBT_VERY_HIGH;

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

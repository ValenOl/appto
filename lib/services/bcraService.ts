import { supabase } from "@/lib/supabase";
import type { Profile, DebtEntry } from "@/types/database";

const BCRA_BASE = "https://api.bcra.gob.ar/centraldedeudores/v1.0";

// ── BCRA API response types ───────────────────────────────────────────────
// Documented at: https://www.bcra.gob.ar/BCRAyVos/Sistemas_Financieros.asp

export interface BcraEntidad {
  entidad:              number;
  descripcion:          string;
  situacion:            number;   // 1 (normal) → 6 (irrecuperable)
  fechaSit1:            string;
  monto:                number;   // miles de ARS
  diasAtrasoPago:       number;
  refinanciaciones:     boolean;
  recategorizacionOblig: boolean;
  situacionJuridica:    boolean;
  irrecuperable:        boolean;
  enRevision:           boolean;
  procesoJud:           boolean;
}

export interface BcraPeriodo {
  periodo:   string;       // "YYYY-MM"
  entidades: BcraEntidad[];
}

export interface BcraDeudaResults {
  identificacion: number;
  denominacion:   string;
  periodos:       BcraPeriodo[];
}

export interface BcraHistorialPeriodo {
  periodo:   string;
  situacion: number;
}

export interface BcraHistorialResults {
  identificacion: number;
  denominacion:   string;
  periodos:       BcraHistorialPeriodo[];
}

export interface BcraCheque {
  entidad:      number;
  descripcion:  string;
  nroCheque:    string;
  fechaRechazo: string;
  monto:        number;
  fechaPago:    string | null;
  estado:       string;
}

export interface BcraChequesResults {
  identificacion: number;
  denominacion:   string;
  causales:       BcraCheque[];
}

interface BcraApiResponse<T> {
  status:  number;
  results: T;
}

// ── HTTP helper ───────────────────────────────────────────────────────────

async function bcraFetch<T>(path: string): Promise<T | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Optional: BCRA_API_TOKEN for environments requiring auth
  const token = process.env.BCRA_API_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${BCRA_BASE}${path}`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json: BcraApiResponse<T> = await res.json();
    if (json.status !== 200) return null;
    return json.results;
  } catch {
    return null;
  }
}

// ── ΛPPTO Score Calculator ────────────────────────────────────────────────
//
// Scale: 0–1000 (higher = better)
//   Base:  1000
//   -200   per BCRA situation point above 1 (e.g. Sit 3 → -400)
//   -100   if rejected checks in the last 6 months
//   -50    if history shows instability (situation jumps > 1 between periods)

export function calculateApptoScore(
  deuda:    BcraDeudaResults | null,
  historial: BcraHistorialResults | null,
  cheques:  BcraChequesResults | null
): number {
  let score = 1000;

  // Worst situation from the latest period
  if (deuda?.periodos?.length) {
    const latestPeriodo = deuda.periodos[0];
    const worstSit = Math.max(...latestPeriodo.entidades.map((e) => e.situacion));
    if (worstSit > 1) score -= (worstSit - 1) * 200;
  }

  // Rejected checks in the last 6 months
  if (cheques?.causales?.length) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const hasRecentRejection = cheques.causales.some(
      (c) => new Date(c.fechaRechazo) >= sixMonthsAgo
    );
    if (hasRecentRejection) score -= 100;
  }

  // Historial instability: situation jump larger than 1 between any two periods
  if (historial?.periodos && historial.periodos.length > 1) {
    const sits = historial.periodos.map((p) => p.situacion);
    const unstable = sits.some((s, i) => i > 0 && Math.abs(s - sits[i - 1]) > 1);
    if (unstable) score -= 50;
  }

  return Math.max(0, score);
}

// ── Public API ────────────────────────────────────────────────────────────

export async function fetchFullBcraReport(cuit: string): Promise<Profile | null> {
  const [deuda, historial, cheques] = await Promise.all([
    bcraFetch<BcraDeudaResults>(`/Deudas/${cuit}`),
    bcraFetch<BcraHistorialResults>(`/Historial/${cuit}`),
    bcraFetch<BcraChequesResults>(`/Cheques/${cuit}`),
  ]);

  // No data at all → CUIT not found in BCRA
  if (!deuda && !historial && !cheques) return null;

  const denominacion =
    deuda?.denominacion ??
    historial?.denominacion ??
    cheques?.denominacion ??
    "SIN DENOMINACIÓN";

  // Worst BCRA situation (default 1 if no debts — clean record)
  let worstSituacion = 1;
  if (deuda?.periodos?.length) {
    const latest = deuda.periodos[0];
    worstSituacion = Math.max(...latest.entidades.map((e) => e.situacion));
  }

  const apptoScore = calculateApptoScore(deuda, historial, cheques);

  const debtDetail: DebtEntry[] = (deuda?.periodos?.[0]?.entidades ?? []).map((e) => ({
    descripcion: e.descripcion,
    situacion:   e.situacion,
    monto:       e.monto,
  }));

  const payload = {
    cuit,
    full_name:        denominacion,
    bcra_score:       worstSituacion,
    appto_score:      apptoScore,
    estimated_income: 0,
    debt_detail:      debtDetail,
    created_at:       new Date().toISOString(),
  };

  const { data, error } = await (supabase as any)
    .from("profiles")
    .upsert(payload, { onConflict: "cuit" })
    .select()
    .single();

  if (error) {
    // Upsert failed (likely RLS) — return un-persisted data so the query works;
    // next request will re-fetch from BCRA since there's nothing cached.
    return { id: crypto.randomUUID(), user_id: null, ...payload } as Profile;
  }

  return data as Profile;
}

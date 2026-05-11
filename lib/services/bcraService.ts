import { supabase } from "@/lib/supabase";
import type { Profile, DebtEntry } from "@/types/database";
import { calculateApptoScore } from "@/lib/utils/scoring";
import { DNI_PREFIXES, buildCuil } from "@/lib/utils/cuitHelper";

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

    console.log(`[BCRA] GET ${path} → HTTP ${res.status}`);

    if (!res.ok) return null;

    const json: BcraApiResponse<T> = await res.json();

    console.log(`[BCRA] GET ${path} → API status ${json.status}`);

    if (json.status !== 200) return null;
    return json.results;
  } catch (err) {
    console.log(`[BCRA] GET ${path} → ERROR ${(err as Error).message}`);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * hasHistoricalActivity distinguishes two "clean" outcomes:
 *   false → Estado A: CUIT truly never appeared in any BCRA endpoint (no records at all)
 *   true  → Estado B: CUIT has past periods on record but zero active debt today
 */
export interface BcraProfileResult {
  profile:               Profile;
  hasHistoricalActivity: boolean;
}

export async function fetchFullBcraReport(cuit: string): Promise<BcraProfileResult | null> {
  const [deuda, historial, cheques] = await Promise.all([
    bcraFetch<BcraDeudaResults>(`/Deudas/${cuit}`),
    bcraFetch<BcraHistorialResults>(`/Historial/${cuit}`),
    bcraFetch<BcraChequesResults>(`/Cheques/${cuit}`),
  ]);

  // All three null → CUIT truly not in BCRA (Estado A)
  if (!deuda && !historial && !cheques) return null;

  const denominacion =
    deuda?.denominacion ??
    historial?.denominacion ??
    cheques?.denominacion ??
    "SIN DENOMINACIÓN";

  // Person has historical activity if any endpoint has at least one period/record,
  // even when the most recent deuda period has empty entidades (zero current debt).
  const hasHistoricalActivity =
    (deuda?.periodos?.length    ?? 0) > 0 ||
    (historial?.periodos?.length ?? 0) > 0 ||
    (cheques?.causales?.length   ?? 0) > 0;

  // Most recent period that actually carries debt entries.
  // BCRA sends up to 24 months; periodos[0] can be empty when debt just hit $0.
  const periodWithData = deuda?.periodos?.find((p) => p.entidades.length > 0) ?? null;

  const worstSituacion = periodWithData
    ? Math.max(...periodWithData.entidades.map((e) => e.situacion))
    : 1;

  const apptoScore = calculateApptoScore(deuda, historial, cheques);

  const debtDetail: DebtEntry[] = (periodWithData?.entidades ?? []).map((e) => ({
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
    return {
      profile: { id: crypto.randomUUID(), user_id: null, ...payload } as Profile,
      hasHistoricalActivity,
    };
  }

  return { profile: data as Profile, hasHistoricalActivity };
}

// ── DNI retry loop ────────────────────────────────────────────────────────
//
// Tries each prefix in order (20 → 27 → 23 → 24) and stops at the first
// BCRA hit. If all four fail, returns null (Estado A).
// Only called when the input is NOT already an 11-digit CUIL.

export async function fetchBcraReportByDni(rawDni: string): Promise<BcraProfileResult | null> {
  const paddedDni = rawDni.padStart(8, '0');

  for (const prefix of DNI_PREFIXES) {
    const cuil = buildCuil(prefix, paddedDni);

    if (!cuil) {
      console.log(`[BCRA] Prefijo ${prefix}+${paddedDni} → dígito verificador inválido (rem=1), saltando`);
      continue;
    }

    console.log(`[BCRA] Probando CUIL: ${cuil} (prefijo ${prefix})`);

    const result = await fetchFullBcraReport(cuil);

    if (result) {
      console.log(`[BCRA] Encontrado con CUIL: ${cuil} — ${result.profile.full_name}`);
      return result;
    }

    const nextPrefix = DNI_PREFIXES[DNI_PREFIXES.indexOf(prefix) + 1];
    if (nextPrefix) {
      console.log(`[BCRA] Sin datos para ${cuil}, probando prefijo ${nextPrefix}...`);
    }
  }

  console.log(`[BCRA] DNI ${paddedDni} → los ${DNI_PREFIXES.length} prefijos fallaron. Estado A.`);
  return null;
}

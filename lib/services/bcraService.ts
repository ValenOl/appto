import { supabase } from "@/lib/supabase";
import type { Profile, DebtEntry } from "@/types/database";
import { calculateApptoScore } from "@/lib/utils/scoring";
import { DNI_PREFIXES, buildCuil } from "@/lib/utils/cuitHelper";

// Requests go through the Cloudflare proxy — the BCRA API blocks Vercel's
// US-based IPs with 503. The proxy routes through a different egress point.
// bypass-tunnel-reminder header is required: without it trycloudflare.com
// returns a Cloudflare interstitial HTML page instead of the API response.
const BCRA_PROXY         = process.env.NEXT_PUBLIC_PROXY_URL ?? "https://monetary-royal-galaxy-fragrances.trycloudflare.com/fetch-bcra";
const BCRA_ENDPOINT_BASE = "/centraldedeudores/v1.0";
const BCRA_TIMEOUT_MS    = 12_000;

function jitter(): Promise<void> {
  const ms = 500 + Math.floor(Math.random() * 1000); // 500–1500ms
  console.log(`[BCRA] Jitter: esperando ${ms}ms antes del request`);
  return new Promise((r) => setTimeout(r, ms));
}

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

// ── HTTP helpers ──────────────────────────────────────────────────────────
//
// Two variants with different error contracts:
//
//   bcraProbe  — strict: throws on any network/connection error, returns null
//                on HTTP 4xx/5xx or API status ≠ 200.
//                Use when you need to distinguish "not found" from "API down".
//
//   bcraFetch  — lenient: wraps bcraProbe in try/catch, always returns null
//                on any failure. Use for secondary endpoints (historial, cheques)
//                where partial data is acceptable.

function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as NodeJS.ErrnoException & { cause?: unknown }).cause;
  const causeStr = cause
    ? ` | causa: ${cause instanceof Error ? cause.message : String(cause)}`
    : '';
  return `${err.name}: ${err.message}${causeStr}`;
}

async function bcraProbe<T>(path: string): Promise<T | null> {
  // No try/catch — network errors propagate so callers can distinguish
  // "not found" (null) from "API down" (thrown exception).
  await jitter();
  const endpoint = `${BCRA_ENDPOINT_BASE}${path}`;
  const url      = `${BCRA_PROXY}?endpoint=${encodeURIComponent(endpoint)}`;
  console.log(`[BCRA] Proxy request → ${endpoint}`);
  const res = await fetch(url, {
    cache:   "no-store",
    signal:  AbortSignal.timeout(BCRA_TIMEOUT_MS),
    headers: { "bypass-tunnel-reminder": "true" },
  });

  console.log(`[BCRA] GET ${path} → HTTP ${res.status}`);

  if (!res.ok) {
    if (res.status !== 404) {
      console.error(`[BCRA] Error ${res.status} en ${path}`);
    }
    return null;
  }

  const json: BcraApiResponse<T> = await res.json();

  console.log(`[BCRA] GET ${path} → API status ${json.status}`);

  if (json.status !== 200) return null;
  return json.results;
}

async function bcraFetch<T>(path: string): Promise<T | null> {
  try {
    return await bcraProbe<T>(path);
  } catch (err) {
    console.log(`[BCRA] GET ${path} → ERROR ${describeError(err)}`);
    return null;
  }
}

function isEconnreset(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const cause = (err as NodeJS.ErrnoException & { cause?: unknown }).cause;
  return (cause as NodeJS.ErrnoException)?.code === 'ECONNRESET';
}

// One automatic retry on ECONNRESET (WAF geo-block drops TCP mid-connection).
// All other errors propagate immediately.
async function probeDeuda(path: string): Promise<BcraDeudaResults | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await bcraProbe<BcraDeudaResults>(path);
    } catch (err) {
      if (attempt === 1 && isEconnreset(err)) {
        console.log(`[BCRA] ECONNRESET → esperando 1500ms y reintentando ${path} (intento 2/2)...`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}

// ── Profile builder ───────────────────────────────────────────────────────
//
// Shared by both the CUIT path and the DNI retry loop. Converts raw BCRA
// responses into a Profile and upserts it to Supabase.

async function buildAndPersistProfile(
  cuit:      string,
  deuda:     BcraDeudaResults | null,
  historial: BcraHistorialResults | null,
  cheques:   BcraChequesResults | null,
): Promise<BcraProfileResult> {
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

// ── CUIT path (11 digits) ─────────────────────────────────────────────────
//
// We already know the exact CUIT, so all three endpoints fire in parallel.
// Uses bcraFetch (lenient) — a down endpoint yields null and the others
// still contribute partial data.

export async function fetchFullBcraReport(cuit: string): Promise<BcraProfileResult | null> {
  const [deuda, historial, cheques] = await Promise.all([
    bcraFetch<BcraDeudaResults>(`/Deudas/${cuit}`),
    bcraFetch<BcraHistorialResults>(`/Historial/${cuit}`),
    bcraFetch<BcraChequesResults>(`/Cheques/${cuit}`),
  ]);

  // All three null → CUIT truly not in BCRA (Estado A)
  if (!deuda && !historial && !cheques) return null;

  return buildAndPersistProfile(cuit, deuda, historial, cheques);
}

// ── DNI retry loop (sequential + lazy) ───────────────────────────────────
//
// Strategy: probe /Deudas only — one request per prefix, in order.
//
//   • Network error on /Deudas → THROW. The API is down; we must not continue
//     to the next prefix or return null, because null gets cached as Estado A.
//
//   • HTTP 404 / API status ≠ 200 → not this prefix, try the next one.
//
//   • HTTP 200 with data → CUIL confirmed. Break the loop, then lazy-fetch
//     /Historial and /Cheques for THIS CUIL only (lenient — partial data OK).
//
// This fires at most 1 + 2 = 3 requests on success, vs 12 with the old approach
// of calling fetchFullBcraReport (3 parallel) for each of the 4 prefixes.

export async function fetchBcraReportByDni(rawDni: string): Promise<BcraProfileResult | null> {
  const paddedDni = rawDni.padStart(8, '0');

  for (const prefix of DNI_PREFIXES) {
    const cuil = buildCuil(prefix, paddedDni);

    if (!cuil) {
      console.log(`[BCRA] Prefijo ${prefix}+${paddedDni} → dígito verificador inválido (rem=1), saltando`);
      continue;
    }

    console.log(`[BCRA] Probando CUIL: ${cuil} (prefijo ${prefix})`);

    let deuda: BcraDeudaResults | null;
    try {
      deuda = await probeDeuda(`/Deudas/${cuil}`);
    } catch (err) {
      // Network/timeout error — do NOT continue to next prefix.
      // Treating this as "not found" would cache a false Estado A.
      console.log(`[BCRA] ERROR de red en /Deudas/${cuil}: ${describeError(err)} — abortando búsqueda`);
      throw err;
    }

    if (!deuda) {
      // Clean 404 — this prefix doesn't match. Try the next one.
      const nextPrefix = DNI_PREFIXES[DNI_PREFIXES.indexOf(prefix) + 1];
      if (nextPrefix) {
        console.log(`[BCRA] Falló ${cuil}, probando prefijo ${nextPrefix}...`);
      }
      continue;
    }

    // CUIL confirmed. Lazy-fetch the secondary endpoints for this CUIL only.
    console.log(`[BCRA] Encontrado con CUIL: ${cuil} — cargando historial y cheques`);
    const [historial, cheques] = await Promise.all([
      bcraFetch<BcraHistorialResults>(`/Historial/${cuil}`),
      bcraFetch<BcraChequesResults>(`/Cheques/${cuil}`),
    ]);

    const result = await buildAndPersistProfile(cuil, deuda, historial, cheques);
    console.log(`[BCRA] Perfil construido: ${result.profile.full_name} — APPTO score ${result.profile.appto_score}`);
    return result;
  }

  console.log(`[BCRA] Búsqueda agotada para DNI ${paddedDni}. ¿Verificado en ANSES/BCRA manualmente?`);
  return null;
}

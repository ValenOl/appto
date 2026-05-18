'use server';

import { getSupabaseAdmin } from '@/lib/supabase';
import { buildCuil } from '@/lib/utils/cuitHelper';

// ─── Public types (consumed by RiskQuery client component) ───────────────────

export interface BcraEntidad {
  entidad:               number;
  descripcion:           string;
  situacion:             number;   // 1–6
  fechaSit1:             string;
  monto:                 number;   // miles de ARS
  diasAtrasoPago:        number;
  refinanciaciones:      boolean;
  recategorizacionOblig: boolean;
  situacionJuridica:     boolean;
  irrecuperable:         boolean;
  enRevision:            boolean;
  procesoJud:            boolean;
}

export interface BcraPeriodo {
  periodo:   string;               // "YYYY-MM"
  entidades: BcraEntidad[];
}

export interface BcraDeudaResults {
  identificacion: number;
  denominacion:   string;
  periodos:       BcraPeriodo[];
}

export type QueryOutcome = 'fresh' | 'cached' | 'clean' | 'error';

export interface BcraQueryResult {
  data:         BcraDeudaResults | null;
  outcome:      QueryOutcome;
  fetchedAt:    string | null;
  resolvedCuil: string | null;   // confirmed CUIL (null on clean/error)
  error?:       string;
}

// ─── Internal constants ───────────────────────────────────────────────────────

const PROXY         = process.env.PROXY_URL ?? '';
const PROXY_API_KEY = process.env.PROXY_API_KEY ?? '';
const TTL_MS        = 30 * 24 * 60 * 60 * 1000;   // 30 days

// Written to payload when all CUIL candidates returned 404. Lets us cache
// "this DNI has no debt" without making an extra API call for 30 days.
const CLEAN_SENTINEL = '__clean__';

// ─── Cache row type ────────────────────────────────────────────────────────────

interface CacheRow {
  payload:    BcraDeudaResults | { __clean: string };
  fetched_at: string;
}

interface CacheHit {
  isClean:   boolean;
  payload:   BcraDeudaResults | null;
  fetchedAt: string;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function readCache(identificador: string): Promise<CacheHit | null> {
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: cacheError } = await (getSupabaseAdmin() as any)
    .from('consultas_bcra')
    .select('payload, fetched_at')
    .eq('identificador', identificador)
    .gte('fetched_at', cutoff)
    .maybeSingle() as { data: CacheRow | null; error: { message: string } | null };

  if (cacheError) {
    console.error('[cache] readCache failed:', cacheError.message);
    return null;
  }

  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isClean = (data.payload as any)?.__clean === CLEAN_SENTINEL;
  return {
    isClean,
    payload:   isClean ? null : data.payload as BcraDeudaResults,
    fetchedAt: data.fetched_at,
  };
}

async function writeCache(
  identificador: string,
  payload: BcraDeudaResults | null,
): Promise<void> {
  try {
    const stored = payload ?? { __clean: CLEAN_SENTINEL };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (getSupabaseAdmin() as any)
      .from('consultas_bcra')
      .upsert(
        { identificador, payload: stored, fetched_at: new Date().toISOString() },
        { onConflict: 'identificador' },
      );
  } catch (e) {
    console.warn('[ΛPPTO] Cache write failed:', e instanceof Error ? e.message : e);
  }
}

// ─── CUIL resolution ──────────────────────────────────────────────────────────
//
// 11-digit input: already a CUIL/CUIT — passthrough.
// 8-digit input:  try prefix 20 (male) then 27 (female) via Módulo 11.

function getCuilCandidates(input: string): string[] {
  if (input.length === 11) return [input];
  const padded = input.padStart(8, '0');
  return (['20', '27'] as const)
    .map((p) => buildCuil(p, padded))
    .filter((c): c is string => c !== null);
}

// ─── Live fetch (single CUIL) ─────────────────────────────────────────────────

type FetchResult = BcraDeudaResults | 'not-found' | 'error';

const FETCH_RETRY_DELAYS_MS = [1500, 3000] as const;

async function fetchDeudas(cuil: string): Promise<FetchResult> {
  if (!PROXY) throw new Error('[BCRA] PROXY_URL no configurado — definir en variables de entorno');
  const endpoint = `/centraldedeudores/v1.0/Deudas/${cuil}`;
  const url      = `${PROXY}?endpoint=${encodeURIComponent(endpoint)}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        cache:   'no-store',
        signal:  AbortSignal.timeout(30_000),
        headers: { ...(PROXY_API_KEY && { 'x-proxy-key': PROXY_API_KEY }) },
      });

      if (res.status === 404) return 'not-found';

      if ((res.status === 502 || res.status === 503) && attempt < 3) {
        await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAYS_MS[attempt - 1]));
        continue;
      }

      if (!res.ok) return 'error';

      const json = await res.json() as { status: number; results: BcraDeudaResults };
      if (json.status !== 200 || !json.results) return 'not-found';
      return json.results;
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError';
      if (!isTimeout && attempt < 3) {
        await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAYS_MS[attempt - 1]));
        continue;
      }
      return 'error';
    }
  }
  return 'error';
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Queries BCRA Central de Deudores for a DNI (8 digits) or CUIT/CUIL (11 digits).
 *
 * - DNI: tries prefix 20 (male) then 27 (female) sequentially.
 * - All 404s → outcome 'clean' (no debt on record), cached for 30 days.
 * - Network/HTTP error → outcome 'error', not cached.
 * - Unauthenticated callers → outcome 'error', rejected immediately.
 */
export async function queryBcra(identifier: string): Promise<BcraQueryResult> {
  // Input validation — only digits, exactly 7–8 chars (DNI) or 11 chars (CUIT).
  // 9–10 digit inputs are not valid formats and must be rejected.
  // RiskQuery.tsx already strips non-digits client-side, but queryBcra is a
  // public Server Action callable directly — validate at the server boundary.
  if (!/^(\d{7,8}|\d{11})$/.test(identifier)) {
    return {
      data:         null,
      outcome:      'error',
      fetchedAt:    null,
      resolvedCuil: null,
      error:        'Identificador inválido. Ingresá un DNI (7-8 dígitos) o CUIT (11 dígitos).',
    };
  }

  // Fail-closed: PROXY must be present or fetchDeudas will throw.
  if (!PROXY) {
    return {
      data:         null,
      outcome:      'error',
      fetchedAt:    null,
      resolvedCuil: null,
      error:        'Proxy URL no configurada.',
    };
  }

  // Fail-closed: PROXY_API_KEY must be present or the fetch will silently fail with 401.
  if (!PROXY_API_KEY) {
    return {
      data:         null,
      outcome:      'error',
      fetchedAt:    null,
      resolvedCuil: null,
      error:        'Proxy API key no configurada.',
    };
  }

  // Auth gate — esta Server Action escribe al caché con service role key.
  // Rechazar cualquier llamada sin sesión activa verificada.
  const { createClient } = await import('@/utils/supabase/server');
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return {
      data:         null,
      outcome:      'error',
      fetchedAt:    null,
      resolvedCuil: null,
      error:        'No autorizado.',
    };
  }
  // ── 1. Cache lookup ────────────────────────────────────────────────────────
  const hit = await readCache(identifier);
  if (hit) {
    return {
      data:         hit.payload,
      outcome:      hit.isClean ? 'clean' : 'cached',
      fetchedAt:    hit.fetchedAt,
      resolvedCuil: hit.isClean ? null : (hit.payload ? String(hit.payload.identificacion) : null),
    };
  }

  // ── 2. Resolve CUIL candidates ─────────────────────────────────────────────
  const candidates = getCuilCandidates(identifier);

  if (candidates.length === 0) {
    return {
      data:         null,
      outcome:      'error',
      fetchedAt:    null,
      resolvedCuil: null,
      error:        'No se pudo calcular un CUIL válido para este DNI.',
    };
  }

  // ── 3. Try each candidate ──────────────────────────────────────────────────
  for (const cuil of candidates) {
    const result = await fetchDeudas(cuil);

    if (result === 'error') {
      return {
        data:         null,
        outcome:      'error',
        fetchedAt:    null,
        resolvedCuil: null,
        error:        'Error de conexión con el proxy BCRA.',
      };
    }

    if (result === 'not-found') continue;

    const now = new Date().toISOString();
    await writeCache(identifier, result);
    return {
      data:         result,
      outcome:      'fresh',
      fetchedAt:    now,
      resolvedCuil: cuil,
    };
  }

  // ── 4. All candidates returned 404 → clean state ───────────────────────────
  const now = new Date().toISOString();
  await writeCache(identifier, null);
  return {
    data:         null,
    outcome:      'clean',
    fetchedAt:    now,
    resolvedCuil: null,
  };
}

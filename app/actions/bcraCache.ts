'use server';

import { supabase, getSupabaseAdmin } from '@/lib/supabase';

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

export type QueryOutcome = 'fresh' | 'cached' | 'not-found' | 'error';

export interface BcraQueryResult {
  data:      BcraDeudaResults | null;
  outcome:   QueryOutcome;
  fetchedAt: string | null;        // ISO timestamp — null on error/not-found
  error?:    string;
}

// ─── Internal constants ───────────────────────────────────────────────────────

const PROXY   = 'https://monetary-royal-galaxy-fragrances.trycloudflare.com/fetch-bcra';
const TTL_MS  = 30 * 24 * 60 * 60 * 1000;   // 30 days

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function readCache(identificador: string): Promise<{ payload: BcraDeudaResults; fetchedAt: string } | null> {
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();

  const { data } = await supabase
    .from('consultas_bcra')
    .select('payload, fetched_at')
    .eq('identificador', identificador)
    .gte('fetched_at', cutoff)
    .maybeSingle();

  if (!data?.payload) return null;
  return {
    payload:   data.payload as unknown as BcraDeudaResults,
    fetchedAt: data.fetched_at,
  };
}

async function writeCache(identificador: string, payload: BcraDeudaResults): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    await admin
      .from('consultas_bcra')
      .upsert(
        {
          identificador,
          payload: payload as unknown as import('@/types/database').Json,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'identificador' }
      );
  } catch (e) {
    // Non-fatal — cache write failure doesn't block the response
    console.warn('[ΛPPTO] Cache write failed:', e instanceof Error ? e.message : e);
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Looks up an identifier (DNI or CUIT) in the BCRA Central de Deudores.
 * - Cache hit (< 30 days): returns stored payload, no external request.
 * - Cache miss: fetches from the Cloudflare proxy, stores result, returns data.
 */
export async function queryBcra(identifier: string): Promise<BcraQueryResult> {
  // ── 1. Cache check ─────────────────────────────────────────────────────────
  const hit = await readCache(identifier);
  if (hit) {
    return {
      data:      hit.payload,
      outcome:   'cached',
      fetchedAt: hit.fetchedAt,
    };
  }

  // ── 2. Live fetch ──────────────────────────────────────────────────────────
  try {
    const endpoint = `/centraldedeudores/v1.0/Deudas/${identifier}`;
    const url      = `${PROXY}?endpoint=${encodeURIComponent(endpoint)}`;
    const res      = await fetch(url, {
      cache:  'no-store',
      signal: AbortSignal.timeout(12_000),
    });

    if (res.status === 404) {
      return { data: null, outcome: 'not-found', fetchedAt: null };
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json() as { status: number; results: BcraDeudaResults };

    if (json.status !== 200 || !json.results) {
      return { data: null, outcome: 'not-found', fetchedAt: null };
    }

    const now = new Date().toISOString();

    // ── 3. Persist to cache ─────────────────────────────────────────────────
    await writeCache(identifier, json.results);

    return {
      data:      json.results,
      outcome:   'fresh',
      fetchedAt: now,
    };
  } catch (e) {
    return {
      data:      null,
      outcome:   'error',
      fetchedAt: null,
      error:     e instanceof Error ? e.message : 'Error desconocido',
    };
  }
}

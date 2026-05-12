import { supabase, getSupabaseAdmin } from "@/lib/supabase";
import type { Profile } from "@/types/database";
import { fetchFullBcraReport, fetchBcraReportByDni } from "./bcraService";

export interface ProfileFetch {
  profile:               Profile;
  isNew:                 boolean;  // true = fresh BCRA fetch (billable), false = cache hit (free)
  hasHistoricalActivity: boolean;  // false = Estado A (never in system), true = Estado B (zero debt)
}

// Agressive cache: 90 days — reduces BCRA hits by ~70% for repeat B2B queries.
const CACHE_DAYS = 90;

async function logAudit(companyId: string, queryTarget: string, profile: Profile): Promise<void> {
  try {
    const { error } = await (getSupabaseAdmin() as any)
      .from("search_history")
      .insert({
        company_id:   companyId,
        query_target: queryTarget,
        full_name:    profile.full_name,
        result_score: profile.appto_score,
        status:       "success",
      });
    if (error) {
      console.error("[DATABASE ERROR] Falló el registro del historial:", error);
    } else {
      console.log(`[DB] Auditoría registrada para CUIL: ${queryTarget}`);
    }
  } catch (err) {
    console.error("[DATABASE ERROR] Excepción al registrar historial:", err);
  }
}

export async function getOrFetchProfile(
  input:     string,
  companyId?: string,
): Promise<ProfileFetch | null> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CACHE_DAYS);

  let fetchResult: ProfileFetch | null = null;

  // ── CUIT path (11 digits) ─────────────────────────────────────────────────
  if (input.length === 11) {
    const { data: cached } = await (supabase as any)
      .from("profiles")
      .select("*")
      .eq("cuit", input)
      .gte("created_at", cutoff.toISOString())
      .maybeSingle();

    if (cached) {
      fetchResult = { profile: cached as Profile, isNew: false, hasHistoricalActivity: true };
    } else {
      const result = await fetchFullBcraReport(input);
      if (result) {
        fetchResult = { profile: result.profile, isNew: true, hasHistoricalActivity: result.hasHistoricalActivity };
      }
    }
  } else {
    // ── DNI path (7–8 digits) ───────────────────────────────────────────────
    const paddedDni = input.padStart(8, '0');

    const { data: cached } = await (supabase as any)
      .from("profiles")
      .select("*")
      .ilike("cuit", `%${paddedDni}%`)
      .gte("created_at", cutoff.toISOString())
      .maybeSingle();

    if (cached) {
      fetchResult = { profile: cached as Profile, isNew: false, hasHistoricalActivity: true };
    } else {
      const result = await fetchBcraReportByDni(input);
      if (result) {
        fetchResult = { profile: result.profile, isNew: true, hasHistoricalActivity: result.hasHistoricalActivity };
      }
    }
  }

  // Audit every successful result (cache hit or fresh fetch) if caller provides companyId.
  if (fetchResult && companyId) {
    await logAudit(companyId, input, fetchResult.profile);
  }

  return fetchResult;
}

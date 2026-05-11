import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";
import { fetchFullBcraReport, fetchBcraReportByDni } from "./bcraService";

export interface ProfileFetch {
  profile:               Profile;
  isNew:                 boolean;  // true = fresh BCRA fetch (billable), false = cache hit (free)
  hasHistoricalActivity: boolean;  // false = Estado A (never in system), true = Estado B (zero debt)
}

export async function getOrFetchProfile(input: string): Promise<ProfileFetch | null> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // ── CUIT path (11 digits) ─────────────────────────────────────────────────
  if (input.length === 11) {
    const { data: cached } = await (supabase as any)
      .from("profiles")
      .select("*")
      .eq("cuit", input)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .maybeSingle();

    // Cache hits were found in BCRA before, so historical activity is guaranteed.
    if (cached) return { profile: cached as Profile, isNew: false, hasHistoricalActivity: true };

    const result = await fetchFullBcraReport(input);
    if (!result) return null;  // Estado A — BCRA 404 across all endpoints
    return { profile: result.profile, isNew: true, hasHistoricalActivity: result.hasHistoricalActivity };
  }

  // ── DNI path (7–8 digits) ─────────────────────────────────────────────────
  const paddedDni = input.padStart(8, '0');

  const { data: cached } = await (supabase as any)
    .from("profiles")
    .select("*")
    .ilike("cuit", `%${paddedDni}%`)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .maybeSingle();

  if (cached) return { profile: cached as Profile, isNew: false, hasHistoricalActivity: true };

  // Cache miss — retry all prefixes in order with per-prefix logging.
  const result = await fetchBcraReportByDni(input);
  if (result) return { profile: result.profile, isNew: true, hasHistoricalActivity: result.hasHistoricalActivity };

  return null;  // Estado A — los 4 prefijos fallaron
}

import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";
import { fetchFullBcraReport } from "./bcraService";
import { getPossibleCuils } from "@/lib/utils/cuitHelper";

export interface ProfileFetch {
  profile: Profile;
  isNew:   boolean;  // true = fresh BCRA fetch (billable), false = cache hit (free)
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

    if (cached) return { profile: cached as Profile, isNew: false };

    const profile = await fetchFullBcraReport(input);
    if (!profile) return null;  // BCRA 404 — Rule B
    return { profile, isNew: true };
  }

  // ── DNI path (7–8 digits) ─────────────────────────────────────────────────
  const paddedDni = input.padStart(8, '0');

  const { data: cached } = await (supabase as any)
    .from("profiles")
    .select("*")
    .ilike("cuit", `%${paddedDni}%`)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .maybeSingle();

  if (cached) return { profile: cached as Profile, isNew: false };

  // Cache miss — iterate possible CUILs and stop at the first BCRA hit.
  const cuils = getPossibleCuils(input);
  for (const cuil of cuils) {
    const profile = await fetchFullBcraReport(cuil);
    if (profile) return { profile, isNew: true };
  }

  return null;  // BCRA 404 — Rule B
}

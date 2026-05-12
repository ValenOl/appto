import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Service-role client — bypasses RLS. Only used server-side for audit logging.
// Lazy: instantiated on first call so a missing key doesn't break the build.
// Never import this in client components.
export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("[APPTO] SUPABASE_SERVICE_ROLE_KEY no está configurada en las variables de entorno.");
  return createClient<Database>(supabaseUrl, key);
}

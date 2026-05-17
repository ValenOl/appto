'use server'

import { redirect } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase'

// TODO [RATE LIMIT — Sprint Infra]: Implementar @upstash/ratelimit en este punto.
// saveLead usa el service role key (bypasses RLS) — sin rate limit es un vector de spam.
// Límite sugerido: 3 leads por IP por hora (fixed window).
// import { Ratelimit } from '@upstash/ratelimit'
// import { Redis } from '@upstash/redis'
// const rl = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.fixedWindow(3, '1h') })
// const { success } = await rl.limit(headers().get('x-forwarded-for') ?? 'anonymous')
// if (!success) redirect('/?e=rate-limit')
export async function saveLead(formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const cuit  = (formData.get('cuit')  as string)?.replace(/\D/g, '') || null

  if (!email || !email.includes('@')) redirect('/?e=invalid')

  const admin = getSupabaseAdmin()
  await (admin as any)
    .from('leads')
    .insert({ email, cuit })

  // On duplicate email the insert is silently ignored — unique index handles it.
  redirect('/?s=lead')
}

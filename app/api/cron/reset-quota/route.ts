import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase'

// Compara dos strings en tiempo constante para prevenir timing attacks.
// timingSafeEqual requiere buffers de igual longitud — si difieren, retorna false
// sin revelar cuántos bytes coinciden.
function timingSafeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

// Vercel envía CRON_SECRET automáticamente como Bearer token al invocar cron jobs.
// Configura CRON_SECRET en Vercel env vars (ej. `openssl rand -hex 32`).
export async function GET(request: NextRequest) {
  // Fail-Closed: si CRON_SECRET no está seteada, rechazar inmediatamente.
  // "Bearer undefined" nunca podrá autenticar.
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[CRON] CRON_SECRET is not set — rejecting request (misconfigured)')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const auth = request.headers.get('authorization') ?? ''
  if (!timingSafeCompare(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today        = new Date().toISOString().split('T')[0]
  const newResetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Seleccionar solo 'id' para el conteo — nunca exponer company_name, cuit u otros PII
  // en la respuesta de este endpoint de infraestructura.
  const { data, error } = await (getSupabaseAdmin() as any)
    .from('companies')
    .update({ queries_used: 0, cycle_reset_date: newResetDate })
    .eq('subscription_status', 'active')
    .lt('cycle_reset_date', today)
    .select('id')

  if (error) {
    console.error('[CRON] Error resetting quotas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const count = data?.length ?? 0
  console.log(`[CRON] Quota reset: ${count} empresa(s) renovada(s)`)

  // Solo retornar metadato — sin PII en el body de respuesta
  return NextResponse.json({ reset: count })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

// Vercel automatically sends CRON_SECRET as a Bearer token when triggering cron jobs.
// Set CRON_SECRET in Vercel environment variables (any random string, e.g. `openssl rand -hex 32`).
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today        = new Date().toISOString().split('T')[0]
  const newResetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data, error } = await (getSupabaseAdmin() as any)
    .from('companies')
    .update({ queries_used: 0, cycle_reset_date: newResetDate })
    .eq('subscription_status', 'active')
    .lt('cycle_reset_date', today)
    .select('id, company_name, cuit')

  if (error) {
    console.error('[CRON] Error resetting quotas:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const count = data?.length ?? 0
  console.log(`[CRON] Quota reset: ${count} empresa(s) renovada(s)`)

  return NextResponse.json({ reset: count, companies: data })
}

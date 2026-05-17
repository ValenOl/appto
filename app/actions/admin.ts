'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function approveCompany(formData: FormData) {
  // Fail-Closed: leer el email admin en runtime, nunca hardcodear un fallback.
  // Si ADMIN_EMAIL no está seteada, lanzar un error explícito — no silenciar.
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) throw new Error('[APPTO] ADMIN_EMAIL env var is not configured')

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== adminEmail) redirect('/')

  const company_id = formData.get('company_id') as string
  if (!company_id) return

  const cycle_reset_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  await (supabase.from('companies') as any)
    .update({
      subscription_status: 'active',
      queries_used:        0,
      cycle_reset_date,
    })
    .eq('id', company_id)

  revalidatePath('/admin')
}

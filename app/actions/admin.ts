'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'joaquinolivero97@gmail.com'

export async function approveCompany(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) redirect('/')

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

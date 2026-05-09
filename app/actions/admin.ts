'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function approveCompany(formData: FormData) {
  const company_id = formData.get('company_id') as string

  const supabase = await createClient()

  const cycle_reset_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  await supabase
    .from('companies')
    .update({
      subscription_status: 'active',
      queries_used:        0,
      cycle_reset_date,
    })
    .eq('id', company_id)

  revalidatePath('/admin')
}

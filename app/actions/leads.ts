'use server'

import { redirect } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase'

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

'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function changePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirm  = formData.get('confirm')  as string

  if (!password || password.length < 8)
    redirect('/business/settings?e=length')
  if (password !== confirm)
    redirect('/business/settings?e=mismatch')

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) redirect('/business/settings?e=auth')
  redirect('/business/settings?s=password')
}

export async function saveDictamenIssuer(formData: FormData) {
  const issuer   = (formData.get('dictamen_issuer') as string)?.trim() || null
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await (supabase as any)
    .from('companies')
    .update({ dictamen_issuer: issuer })
    .eq('user_id', user.id)

  redirect('/business/settings?s=dictamen')
}

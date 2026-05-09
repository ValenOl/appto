'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function signUpCompany(formData: FormData) {
  const email        = formData.get('email')        as string
  const password     = formData.get('password')     as string
  const cuit         = formData.get('cuit')         as string
  const company_name = formData.get('company_name') as string
  const plan_tier    = (formData.get('plan_tier') as string) || 'BASICO'

  const supabase = await createClient()

  const { data: authData, error } = await supabase.auth.signUp({ email, password })

  if (error || !authData.user) {
    redirect(`/register?plan=${plan_tier}&error=${encodeURIComponent(error?.message ?? 'Error al crear el usuario')}`)
  }

  const monthly_quota    = plan_tier === 'PRO' ? 50 : 10
  const cycle_reset_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  await supabase.from('companies').insert({
    user_id:             authData.user.id,
    cuit,
    name:                company_name,
    verified:            false,
    plan_tier,
    monthly_quota,
    queries_used:        0,
    cycle_reset_date,
    subscription_status: 'pending',
  })

  redirect('/register/success')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/business')
}

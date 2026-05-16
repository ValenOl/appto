'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { validateCuit } from '@/lib/utils/cuitHelper'

export async function signUpCompany(formData: FormData) {
  const email        = formData.get('email')        as string
  const password     = formData.get('password')     as string
  const cuit         = (formData.get('cuit') as string).replace(/\D/g, '')
  const company_name = formData.get('company_name') as string
  const plan_tier    = (formData.get('plan_tier') as string) || 'BASICO'

  if (!validateCuit(cuit)) {
    redirect(`/register?plan=${plan_tier}&error=${encodeURIComponent('CUIT inválido. Verificá los 11 dígitos.')}`)
  }

  const supabase = await createClient()

  const { data: authData, error } = await supabase.auth.signUp({ email, password })

  if (error || !authData.user) {
    redirect(`/register?plan=${plan_tier}&error=${encodeURIComponent(error?.message ?? 'Error al crear el usuario')}`)
  }

  const monthly_quota    = plan_tier === 'PRO' ? 50 : 10
  const cycle_reset_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  const { error: insertError } = await (supabase.from('companies') as any).insert({
    user_id:             authData.user.id,
    cuit,
    company_name,
    plan_tier,
    monthly_quota,
    queries_used:        0,
    cycle_reset_date,
    subscription_status: 'pending',
  })

  if (insertError) {
    redirect(`/register?plan=${plan_tier}&error=${encodeURIComponent(insertError.message)}`)
  }

  redirect('/register/success')
}

export async function signUpUser(formData: FormData) {
  const email    = formData.get('email')    as string
  const password = formData.get('password') as string
  const cuit     = formData.get('cuit')     as string

  const supabase = await createClient()

  const { data: authData, error } = await supabase.auth.signUp({ email, password })

  if (error || !authData.user) {
    redirect(`/register-user?error=${encodeURIComponent(error?.message ?? 'Error al crear el usuario')}`)
  }

  const userId = authData.user.id

  const { data: existing } = await (supabase.from('profiles') as any)
    .select('id')
    .eq('cuit', cuit)
    .single()

  if (existing) {
    await (supabase.from('profiles') as any)
      .update({ user_id: userId })
      .eq('cuit', cuit)
  } else {
    await (supabase.from('profiles') as any)
      .insert({ cuit, user_id: userId, full_name: '', bcra_score: 0, estimated_income: 0 })
  }

  redirect('/personal')
}

export async function sendPasswordReset(formData: FormData) {
  const email   = formData.get('email') as string
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  })

  // Always redirect to success — never reveal whether the email exists.
  redirect('/forgot-password?s=sent')
}

export async function resetPassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirm  = formData.get('confirm')  as string

  if (!password || password.length < 8) redirect('/reset-password?e=length')
  if (password !== confirm)             redirect('/reset-password?e=mismatch')

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) redirect('/reset-password?e=auth')
  redirect('/login?s=password-updated')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function signIn(formData: FormData) {
  const email    = formData.get('email')    as string
  const password = formData.get('password') as string

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? 'Error al iniciar sesión')}`)
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', data.user.id)
    .maybeSingle()

  redirect(company ? '/business' : '/personal')
}

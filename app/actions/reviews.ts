'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export type ReviewState = { error: string } | { ok: true } | null

export async function saveReview(
  _prevState: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const profileId = formData.get('profile_id') as string
  const rawRating = formData.get('rating')     as string
  const comment   = formData.get('comment')    as string

  const rating = parseInt(rawRating, 10)
  if (!profileId || isNaN(rating) || rating < 1 || rating > 5) {
    return { error: 'Datos incompletos — seleccioná una calificación.' }
  }

  if (comment && comment.length > 1000) {
    return { error: 'El comentario no puede superar los 1000 caracteres.' }
  }

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  // Derivar company_id desde la sesión — nunca confiar en el cliente
  const { data: company } = await (authClient as any)
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!company) return { error: 'No se encontró la empresa asociada a esta sesión.' }

  const { error } = await (authClient as any).from('reviews').insert({
    company_id: company.id,
    profile_id: profileId,
    rating,
    comment: comment?.trim() || null,
  })

  if (error) {
    console.error('[reviews] insert failed:', error)
    return { error: `Error al guardar: ${error.message}` }
  }

  revalidatePath('/business', 'page')
  return { ok: true }
}

export async function submitReply(formData: FormData) {
  const reviewId  = formData.get('review_id')
  const replyText = formData.get('reply')

  if (
    typeof reviewId  !== 'string' || !reviewId.trim() ||
    typeof replyText !== 'string' || !replyText.trim()
  ) return

  const authClient = await createClient()

  // Auth gate — esta acción requiere sesión activa
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return

  // Ownership check — solo el titular del perfil puede responder su propia review
  const { data: profile } = await (authClient as any)
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) return

  const { error } = await (authClient as any)
    .from('reviews')
    .update({ reply_text: replyText.trim() })
    .eq('id', reviewId.trim())
    .eq('profile_id', profile.id)  // ownership check: solo toca reviews de su propio perfil

  if (!error) revalidatePath('/personal')
}

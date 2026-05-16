'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export type ReviewState = { error: string } | { ok: true } | null

export async function saveReview(
  _prevState: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const profileId = formData.get('profile_id') as string
  const companyId = formData.get('company_id') as string
  const rawRating = formData.get('rating')     as string
  const comment   = formData.get('comment')    as string

  const rating = parseInt(rawRating, 10)
  if (!profileId || !companyId || isNaN(rating) || rating < 1 || rating > 5) {
    return { error: 'Datos incompletos — seleccioná una calificación.' }
  }

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { error } = await (authClient as any).from('reviews').insert({
    company_id: companyId,
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
  const { error } = await (authClient as any)
    .from('reviews')
    .update({ reply_text: replyText.trim() })
    .eq('id', reviewId.trim())

  if (!error) revalidatePath('/personal')
}

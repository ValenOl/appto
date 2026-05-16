'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function saveReview(formData: FormData) {
  const profileId = formData.get('profile_id') as string
  const companyId = formData.get('company_id') as string
  const rawRating = formData.get('rating')     as string
  const comment   = formData.get('comment')    as string

  const rating = parseInt(rawRating, 10)
  if (!profileId || !companyId || isNaN(rating) || rating < 1 || rating > 5) return

  // Auth guard — only authenticated users can submit reviews
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return

  const { error } = await (authClient as any).from('reviews').insert({
    company_id: companyId,
    profile_id: profileId,
    rating,
    comment: comment?.trim() || null,
  })

  if (error) {
    console.error('[reviews] insert failed:', error)
    return
  }

  revalidatePath('/business', 'page')
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

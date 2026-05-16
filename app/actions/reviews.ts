'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { supabase } from '@/lib/supabase'

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

  // Upsert: one review per company per profile (update if already reviewed)
  await (authClient as any).from('reviews').upsert(
    {
      company_id: companyId,
      profile_id: profileId,
      rating,
      comment: comment?.trim() || null,
    },
    { onConflict: 'company_id,profile_id' }
  )

  revalidatePath('/business')
}

export async function submitReply(formData: FormData) {
  const reviewId = formData.get('review_id')
  const replyText = formData.get('reply')

  if (
    typeof reviewId !== 'string' ||
    typeof replyText !== 'string' ||
    !reviewId.trim() ||
    !replyText.trim()
  ) {
    return
  }

  const { error } = await (supabase.from('reviews') as any)
    .update({ reply_text: replyText.trim() })
    .eq('id', reviewId.trim())

  if (!error) {
    revalidatePath('/personal')
  }
}

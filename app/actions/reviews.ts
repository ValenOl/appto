'use server'

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'

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

  const { error } = await supabase
    .from('reviews')
    .update({ reply_text: replyText.trim() })
    .eq('id', reviewId.trim())

  if (!error) {
    revalidatePath('/personal')
  }
}

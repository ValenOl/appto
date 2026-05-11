'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function saveNote(formData: FormData) {
  const content   = formData.get('content')    as string
  const profileId = formData.get('profile_id') as string
  const companyId = formData.get('company_id') as string

  if (!content?.trim() || !profileId || !companyId) return

  const supabase = await createClient()
  await (supabase as any).from('notes').insert({
    company_id: companyId,
    profile_id: profileId,
    content:    content.trim(),
  })

  revalidatePath('/business')
}

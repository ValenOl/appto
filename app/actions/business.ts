'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function saveNote(formData: FormData) {
  const content   = formData.get('content')    as string
  const profileId = formData.get('profile_id') as string

  if (!content?.trim() || !profileId) return
  if (content.length > 2000) return

  const supabase = await createClient()

  // Auth gate — Zero Trust: verificar sesión antes de cualquier operación
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Derivar company_id desde la base de datos, nunca desde el cliente
  const { data: company } = await (supabase as any)
    .from('companies')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!company) return

  await (supabase as any).from('notes').insert({
    company_id: company.id,  // fuente: DB, no formData
    profile_id: profileId,
    content:    content.trim(),
  })

  revalidatePath('/business')
}

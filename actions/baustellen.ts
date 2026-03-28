'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import {
  BaustelleFormSchema,
  type BaustelleFormData,
} from '@/lib/validations/baustelle'

export async function createBaustelle(
  data: BaustelleFormData
): Promise<{ error: string | null }> {
  const parsed = BaustelleFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { error } = await supabase
    .from('baustellen')
    .insert({ ...parsed.data, user_id: user.id })

  if (error) return { error: error.message }

  revalidatePath('/mobile/aufmasse')
  revalidatePath('/desktop/aufmasse')
  return { error: null }
}

export async function updateBaustelle(
  id: string,
  data: BaustelleFormData
): Promise<{ error: string | null }> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Ungültige ID' }

  const parsed = BaustelleFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { data: rows, error } = await supabase
    .from('baustellen')
    .update(parsed.data)
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length) return { error: 'Baustelle nicht gefunden oder keine Berechtigung' }

  revalidatePath('/mobile/aufmasse')
  revalidatePath('/desktop/aufmasse')
  return { error: null }
}

export async function deleteBaustelle(
  id: string
): Promise<{ error: string | null }> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Ungültige ID' }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { data: rows, error } = await supabase
    .from('baustellen')
    .delete()
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length) return { error: 'Baustelle nicht gefunden oder keine Berechtigung' }

  revalidatePath('/mobile/aufmasse')
  revalidatePath('/desktop/aufmasse')
  return { error: null }
}

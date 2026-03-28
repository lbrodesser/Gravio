'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import {
  AufmassFormSchema,
  type AufmassFormData,
} from '@/lib/validations/aufmass'

export async function createAufmass(
  baustelleId: string,
  data: AufmassFormData
): Promise<{ error: string | null }> {
  const baustelleIdParsed = z.string().uuid().safeParse(baustelleId)
  if (!baustelleIdParsed.success) return { error: 'Ungültige Baustelle-ID' }

  const parsed = AufmassFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { error } = await supabase.from('aufmasse').insert({
    user_id: user.id,
    baustelle_id: baustelleIdParsed.data,
    element_template_id: parsed.data.element_template_id,
    element_name: parsed.data.element_name,
    positionen_werte: parsed.data.positionen_werte,
    notiz: parsed.data.notiz ?? null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/mobile/aufmasse/${baustelleId}`)
  revalidatePath('/desktop/aufmasse')
  return { error: null }
}

export async function deleteAufmass(
  id: string,
  baustelleId: string
): Promise<{ error: string | null }> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Ungültige ID' }

  const baustelleIdParsed = z.string().uuid().safeParse(baustelleId)
  if (!baustelleIdParsed.success) return { error: 'Ungültige Baustelle-ID' }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { data: rows, error } = await supabase
    .from('aufmasse')
    .delete()
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length) return { error: 'Aufmaß nicht gefunden oder keine Berechtigung' }

  revalidatePath(`/mobile/aufmasse/${baustelleId}`)
  revalidatePath('/desktop/aufmasse')
  return { error: null }
}

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import {
  LvImportSchema,
  LvPositionFormSchema,
} from '@/lib/validations/lv'
import type { LvGruppe, LvPosition } from '@/types/lv'

export async function getLvGruppen(): Promise<{
  data: LvGruppe[] | null
  error: string | null
}> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: 'Nicht angemeldet' }

  const { data, error } = await supabase
    .from('lv_gruppen')
    .select('id, user_id, name, einheiten_faktoren, created_at')
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as LvGruppe[], error: null }
}

export async function getLvPositionen(gruppeId: string): Promise<{
  data: LvPosition[] | null
  error: string | null
}> {
  const idParsed = z.string().uuid().safeParse(gruppeId)
  if (!idParsed.success) return { data: null, error: 'Ungültige Gruppen-ID' }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: 'Nicht angemeldet' }

  const { data, error } = await supabase
    .from('lv_positionen')
    .select(
      'id, lv_gruppe_id, user_id, artikelnr, kurztext, einheit, einheitspreis, faktor, created_at'
    )
    .eq('lv_gruppe_id', idParsed.data)
    .order('created_at', { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: data as LvPosition[], error: null }
}

export async function importLv(
  rawData: unknown
): Promise<{ error: string | null }> {
  const parsed = LvImportSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { gruppenname, positionen, einheiten_faktoren } = parsed.data

  const { data: gruppeRows, error: gruppeError } = await supabase
    .from('preislisten_gruppen')
    .insert({
      user_id: user.id,
      name: gruppenname,
      einheiten_faktoren,
      is_active: true,
      index_status: 'fertig',
    })
    .select('id')

  if (gruppeError) return { error: gruppeError.message }
  if (!gruppeRows?.length) return { error: 'Gruppe konnte nicht erstellt werden' }

  const gruppeId = gruppeRows[0].id as string

  const chunkSize = 100
  for (let i = 0; i < positionen.length; i += chunkSize) {
    const chunk = positionen.slice(i, i + chunkSize)
    const rows = chunk.map((pos) => ({
      preisliste_gruppe_id: gruppeId,
      user_id: user.id,
      artikel: pos.kurztext,
      einheit: pos.einheit,
      preis: pos.einheitspreis,
      faktor: pos.faktor,
    }))

    const { error: posError } = await supabase.from('preisliste').insert(rows)
    if (posError) return { error: posError.message }
  }

  revalidatePath('/mobile/lv')
  revalidatePath('/desktop/lv')
  return { error: null }
}

export async function deleteLvGruppe(
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
    .from('preislisten_gruppen')
    .delete()
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length)
    return { error: 'LV-Gruppe nicht gefunden oder keine Berechtigung' }

  revalidatePath('/mobile/lv')
  revalidatePath('/desktop/lv')
  return { error: null }
}

export async function updateLvPosition(
  id: string,
  rawData: unknown
): Promise<{ error: string | null }> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Ungültige ID' }

  const parsed = LvPositionFormSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { kurztext, einheit, einheitspreis, faktor } = parsed.data

  const { data: rows, error } = await supabase
    .from('preisliste')
    .update({
      artikel: kurztext,
      einheit,
      preis: einheitspreis,
      faktor,
    })
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length)
    return { error: 'Position nicht gefunden oder keine Berechtigung' }

  revalidatePath('/desktop/lv')
  return { error: null }
}

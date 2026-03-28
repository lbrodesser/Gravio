'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import type { AbrechnungMitPositionen, AbrechnungPosition } from '@/types/lv'
import type { AufmassPositionWert } from '@/types/index'

// ─── Input Types ─────────────────────────────────────────────────────────────

interface LvPositionInput {
  id: string
  kurztext: string
  einheit: string
  einheitspreis: number
  faktor: number
}

interface CreateAbrechnungInput {
  aufmassId: string
  baustelleId: string
  aufmassName: string
  positionenWerte: AufmassPositionWert[]
  lvPositionen: LvPositionInput[]
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const UuidSchema = z.string().uuid()

const LvPositionInputSchema = z.object({
  id: z.string().uuid(),
  kurztext: z.string().min(1),
  einheit: z.string().min(1),
  einheitspreis: z.number().nonnegative(),
  faktor: z.number().positive(),
})

const CreateAbrechnungSchema = z.object({
  aufmassId: z.string().uuid('Ungültige Aufmaß-ID'),
  baustelleId: z.string().uuid('Ungültige Baustellen-ID'),
  aufmassName: z.string().min(1, 'Name darf nicht leer sein'),
  positionenWerte: z.array(
    z.object({
      name: z.string(),
      einheit: z.enum(['m³', 'm²', 'm', 'Stk', 't']),
      wert: z.number().nullable(),
      lv_position_id: z.string().uuid().nullable().optional(),
    })
  ),
  lvPositionen: z.array(LvPositionInputSchema),
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function berechneGesamtsumme(positionen: AbrechnungPosition[]): number {
  return positionen.reduce((sum, pos) => sum + (pos.gesamtpreis ?? 0), 0)
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getAbrechnungFuerAufmass(aufmassId: string): Promise<{
  data: AbrechnungMitPositionen | null
  error: string | null
}> {
  const idParsed = UuidSchema.safeParse(aufmassId)
  if (!idParsed.success) return { data: null, error: 'Ungültige Aufmaß-ID' }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: 'Nicht angemeldet' }

  const { data, error } = await supabase
    .from('abrechnungen')
    .select(
      `id, user_id, aufmass_id, baustelle_id, name, status, datum_von, datum_bis, created_at, updated_at,
       abrechnung_positionen(id, abrechnung_id, lv_position_id, positionsname, einheit, menge, einheitspreis, faktor, gesamtpreis, created_at)`
    )
    .eq('aufmass_id', idParsed.data)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return { data: null, error: null }
    return { data: null, error: error.message }
  }

  const positionen = (data.abrechnung_positionen ?? []) as AbrechnungPosition[]
  const result: AbrechnungMitPositionen = {
    id: data.id as string,
    user_id: data.user_id as string | null,
    aufmass_id: data.aufmass_id as string | null,
    baustelle_id: data.baustelle_id as string,
    name: data.name as string,
    status: data.status as 'offen' | 'abgeschlossen',
    datum_von: data.datum_von as string | null,
    datum_bis: data.datum_bis as string | null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    positionen,
    gesamtsumme: berechneGesamtsumme(positionen),
  }

  return { data: result, error: null }
}

export async function getAbrechnungenFuerBaustelle(baustelleId: string): Promise<{
  data: AbrechnungMitPositionen[] | null
  error: string | null
}> {
  const idParsed = UuidSchema.safeParse(baustelleId)
  if (!idParsed.success) return { data: null, error: 'Ungültige Baustellen-ID' }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: 'Nicht angemeldet' }

  const { data, error } = await supabase
    .from('abrechnungen')
    .select(
      `id, user_id, aufmass_id, baustelle_id, name, status, datum_von, datum_bis, created_at, updated_at,
       abrechnung_positionen(id, abrechnung_id, lv_position_id, positionsname, einheit, menge, einheitspreis, faktor, gesamtpreis, created_at)`
    )
    .eq('baustelle_id', idParsed.data)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }

  const results: AbrechnungMitPositionen[] = (data ?? []).map((row) => {
    const positionen = (row.abrechnung_positionen ?? []) as AbrechnungPosition[]
    return {
      id: row.id as string,
      user_id: row.user_id as string | null,
      aufmass_id: row.aufmass_id as string | null,
      baustelle_id: row.baustelle_id as string,
      name: row.name as string,
      status: row.status as 'offen' | 'abgeschlossen',
      datum_von: row.datum_von as string | null,
      datum_bis: row.datum_bis as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      positionen,
      gesamtsumme: berechneGesamtsumme(positionen),
    }
  })

  return { data: results, error: null }
}

export async function createAbrechnungFuerAufmass(
  input: CreateAbrechnungInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  const parsed = CreateAbrechnungSchema.safeParse(input)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { data: null, error: 'Nicht angemeldet' }

  const { aufmassId, baustelleId, aufmassName, positionenWerte, lvPositionen } = parsed.data

  const { data: abrRows, error: abrError } = await supabase
    .from('abrechnungen')
    .insert({
      user_id: user.id,
      aufmass_id: aufmassId,
      baustelle_id: baustelleId,
      name: aufmassName,
      status: 'offen',
    })
    .select('id')

  if (abrError) return { data: null, error: abrError.message }
  if (!abrRows?.length) return { data: null, error: 'Abrechnung konnte nicht erstellt werden' }

  const abrechnungId = abrRows[0].id as string

  // Build a lookup map for LV-Positionen
  const lvMap = new Map(lvPositionen.map((lv) => [lv.id, lv]))

  const positionen = positionenWerte
    .filter((pw) => pw.wert !== null && pw.wert !== undefined)
    .map((pw) => {
      const lv = pw.lv_position_id ? lvMap.get(pw.lv_position_id) : undefined
      return {
        abrechnung_id: abrechnungId,
        lv_position_id: pw.lv_position_id ?? null,
        positionsname: pw.name,
        einheit: pw.einheit,
        menge: pw.wert as number,
        einheitspreis: lv?.einheitspreis ?? 0,
        faktor: lv?.faktor ?? 1,
      }
    })

  if (positionen.length > 0) {
    const { error: posError } = await supabase
      .from('abrechnung_positionen')
      .insert(positionen)

    if (posError) return { data: null, error: posError.message }
  }

  revalidatePath(`/mobile/aufmasse/${baustelleId}`)
  revalidatePath('/desktop/aufmasse')

  return { data: { id: abrechnungId }, error: null }
}

export async function updateAbrechnungPosition(
  id: string,
  menge: number
): Promise<{ error: string | null }> {
  const idParsed = UuidSchema.safeParse(id)
  if (!idParsed.success) return { error: 'Ungültige ID' }

  const mengeParsed = z.number().nonnegative().safeParse(menge)
  if (!mengeParsed.success) return { error: 'Ungültige Menge' }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { data: rows, error } = await supabase
    .from('abrechnung_positionen')
    .update({ menge: mengeParsed.data })
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length) return { error: 'Position nicht gefunden oder keine Berechtigung' }

  return { error: null }
}

export async function deleteAbrechnung(
  id: string,
  baustelleId: string
): Promise<{ error: string | null }> {
  const idParsed = UuidSchema.safeParse(id)
  if (!idParsed.success) return { error: 'Ungültige ID' }

  const baustelleIdParsed = UuidSchema.safeParse(baustelleId)
  if (!baustelleIdParsed.success) return { error: 'Ungültige Baustellen-ID' }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { data: rows, error } = await supabase
    .from('abrechnungen')
    .delete()
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length) return { error: 'Abrechnung nicht gefunden oder keine Berechtigung' }

  revalidatePath(`/mobile/aufmasse/${baustelleId}`)
  revalidatePath('/desktop/aufmasse')

  return { error: null }
}

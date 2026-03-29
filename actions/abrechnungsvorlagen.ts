'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@/lib/supabase/server'
import type { Abrechnungsvorlage, VorlageMapping } from '@/types/lv'

// xlsx-js-style für Node.js (Server-seitig)
async function leseExcelStruktur(buffer: Buffer): Promise<string> {
  const { read, utils } = await import('xlsx-js-style')
  const wb = read(new Uint8Array(buffer), { type: 'array', sheetRows: 15 })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows = utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: true,
  }) as unknown[][]

  // Erste 12 Zeilen als lesbaren Text formatieren
  const lines = rows.slice(0, 12).map((row, i) => {
    const cells = (row as unknown[])
      .slice(0, 10)
      .map((v, j) => `[${i},${j}]=${String(v ?? '').trim().slice(0, 40)}`)
      .filter((c) => !c.endsWith('='))
    return cells.join('  ')
  })
  return lines.filter((l) => l.length > 0).join('\n')
}

async function analysiereVorlage(zellstruktur: string): Promise<VorlageMapping> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Du analysierst eine Excel-Aufmaß-Vorlage für das Baugewerbe.
Die Zellen sind im Format [Zeile,Spalte]=Wert angegeben (0-basiert).

Identifiziere:
1. header_row: Zeile mit Spaltenüberschriften (z.B. "Position", "Menge", "Einheit", "Preis")
2. data_start_row: Erste leere Zeile unter den Überschriften, wo Datenwerte eingetragen werden
3. sheet_index: Immer 0
4. columns: Für jedes Feld die Spaltennummer (null wenn nicht vorhanden):
   - positionsname: Spalte für Positionsbezeichnung / Leistungsbeschreibung
   - einheit: Spalte für Einheit (m³, m², m, Stk, t)
   - menge: Spalte für Menge / Anzahl
   - einheitspreis: Spalte für Einheitspreis / EP
   - faktor: Spalte für Faktor (oft nicht vorhanden → null)
   - gesamtpreis: Spalte für Gesamtpreis / GP (wenn Formel-Spalte → null)

Antworte NUR mit validem JSON ohne Markdown-Blöcke:
{"sheet_index":0,"header_row":N,"data_start_row":N,"columns":{"positionsname":N,"einheit":N,"menge":N,"einheitspreis":N,"faktor":N,"gesamtpreis":N}}

Excel-Zellen:
${zellstruktur}`,
      },
    ],
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  const json = JSON.parse(raw) as VorlageMapping
  return json
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function getAbrechnungsvorlagen(): Promise<{
  data: Abrechnungsvorlage[] | null
  error: string | null
}> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Nicht angemeldet' }

  const { data, error } = await supabase
    .from('abrechnungsvorlagen')
    .select('id, user_id, name, storage_path, created_at, mapping, analysiert')
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as Abrechnungsvorlage[], error: null }
}

export async function uploadUndAnalysiereVorlage(
  formData: FormData
): Promise<{ data: Abrechnungsvorlage | null; error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Nicht angemeldet' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { data: null, error: 'Keine Datei übermittelt' }

  const NameSchema = z.string().min(1).max(100)
  const rawName = formData.get('name')
  const nameParsed = NameSchema.safeParse(
    typeof rawName === 'string' && rawName.trim() ? rawName.trim() : file.name.replace(/\.[^.]+$/, '')
  )
  if (!nameParsed.success) return { data: null, error: 'Ungültiger Name' }

  if (file.size > 10 * 1024 * 1024) return { data: null, error: 'Datei zu groß (max. 10 MB)' }
  if (!file.name.match(/\.(xlsx|xls)$/i)) return { data: null, error: 'Nur .xlsx/.xls erlaubt' }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/templates/${Date.now()}_${sanitized}`

  const { error: uploadError } = await supabase.storage
    .from('vorlagen')
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    })

  if (uploadError) return { data: null, error: uploadError.message }

  const { data: inserted, error: insertError } = await supabase
    .from('abrechnungsvorlagen')
    .insert({
      user_id: user.id,
      name: nameParsed.data,
      storage_path: storagePath,
      analysiert: false,
    })
    .select('id, user_id, name, storage_path, created_at, mapping, analysiert')
    .single()

  if (insertError || !inserted) return { data: null, error: insertError?.message ?? 'Fehler beim Speichern' }

  try {
    const zellstruktur = await leseExcelStruktur(buffer)
    const mapping = await analysiereVorlage(zellstruktur)

    await supabase
      .from('abrechnungsvorlagen')
      .update({ mapping, analysiert: true })
      .eq('id', (inserted as { id: string }).id)

    const vorlage: Abrechnungsvorlage = {
      ...(inserted as Abrechnungsvorlage),
      mapping,
      analysiert: true,
    }

    revalidatePath('/mobile/lv')
    revalidatePath('/desktop/lv')
    return { data: vorlage, error: null }
  } catch (err) {
    revalidatePath('/mobile/lv')
    revalidatePath('/desktop/lv')
    return {
      data: inserted as Abrechnungsvorlage,
      error: `Vorlage hochgeladen, Analyse fehlgeschlagen: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`,
    }
  }
}

export async function deleteAbrechnungsvorlage(
  id: string
): Promise<{ error: string | null }> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Ungültige ID' }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Nicht angemeldet' }

  const { data: vorlage, error: fetchError } = await supabase
    .from('abrechnungsvorlagen')
    .select('storage_path')
    .eq('id', idParsed.data)
    .single()

  if (fetchError || !vorlage) return { error: 'Vorlage nicht gefunden' }

  await supabase.storage
    .from('vorlagen')
    .remove([(vorlage as { storage_path: string }).storage_path])

  const { error: deleteError } = await supabase
    .from('abrechnungsvorlagen')
    .delete()
    .eq('id', idParsed.data)

  if (deleteError) return { error: deleteError.message }

  revalidatePath('/mobile/lv')
  revalidatePath('/desktop/lv')
  return { error: null }
}

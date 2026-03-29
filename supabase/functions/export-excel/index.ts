// supabase/functions/export-excel/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface VorlageMapping {
  sheet_index: number
  header_row: number
  data_start_row: number
  columns: {
    positionsname: number | null
    einheit: number | null
    menge: number | null
    einheitspreis: number | null
    faktor: number | null
    gesamtpreis: number | null
  }
}

interface AbrechnungPosition {
  positionsname: string
  einheit: string
  menge: number
  einheitspreis: number
  faktor: number
  gesamtpreis: number
}

interface Abrechnung {
  id: string
  name: string
  status: string
  abrechnung_positionen: AbrechnungPosition[]
}

// Zelle setzen ohne bestehende Styles zu überschreiben
function setzeZellwert(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  value: string | number,
  styleQuelleRow?: number
): void {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  const vorhandeneZelle = ws[addr]
  const typ = typeof value === 'number' ? 'n' : 's'

  if (vorhandeneZelle) {
    // Nur Wert aktualisieren, Style bleibt erhalten
    ws[addr] = { ...vorhandeneZelle, v: value, t: typ }
    if (typ === 'n') delete ws[addr].w // formatierten Text löschen, damit XLSX ihn neu erzeugt
  } else {
    // Neue Zelle: Style aus der Quellzeile (data_start_row) kopieren
    const styleQuelle = styleQuelleRow !== undefined
      ? ws[XLSX.utils.encode_cell({ r: styleQuelleRow, c: col })]
      : undefined
    ws[addr] = { v: value, t: typ, s: styleQuelle?.s }
  }
}

// !ref des Worksheets erweitern falls nötig
function erweitereRef(ws: XLSX.WorkSheet, bisZeile: number): void {
  const ref = ws['!ref']
  if (!ref) return
  const range = XLSX.utils.decode_range(ref)
  if (bisZeile > range.e.r) {
    range.e.r = bisZeile
    ws['!ref'] = XLSX.utils.encode_range(range)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ message: 'Nicht autorisiert' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ message: 'Nicht angemeldet' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json() as { abrechnung_id?: string; baustelle_id?: string }

    // Abrechnungs-Daten laden
    let abrechnungen: Abrechnung[] = []

    if (body.abrechnung_id) {
      const { data, error } = await supabase
        .from('abrechnungen')
        .select(`id, name, status, abrechnung_positionen(positionsname, einheit, menge, einheitspreis, faktor, gesamtpreis)`)
        .eq('id', body.abrechnung_id)
        .single()

      if (error || !data) {
        return new Response(JSON.stringify({ message: 'Abrechnung nicht gefunden' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      abrechnungen = [data as Abrechnung]
    } else if (body.baustelle_id) {
      const { data, error } = await supabase
        .from('abrechnungen')
        .select(`id, name, status, abrechnung_positionen(positionsname, einheit, menge, einheitspreis, faktor, gesamtpreis)`)
        .eq('baustelle_id', body.baustelle_id)

      if (error) {
        return new Response(JSON.stringify({ message: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      abrechnungen = (data ?? []) as Abrechnung[]
    } else {
      return new Response(JSON.stringify({ message: 'abrechnung_id oder baustelle_id erforderlich' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Neueste analysierte Vorlage des Users holen
    const { data: vorlageRow } = await supabase
      .from('abrechnungsvorlagen')
      .select('storage_path, mapping')
      .eq('user_id', user.id)
      .eq('analysiert', true)
      .not('mapping', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const vorlage = vorlageRow as { storage_path: string; mapping: VorlageMapping } | null

    let wb: XLSX.WorkBook

    if (vorlage?.mapping) {
      // ── Template-basierter Export ──────────────────────────────────────────
      const { data: templateBytes, error: downloadError } = await supabase.storage
        .from('vorlagen')
        .download(vorlage.storage_path)

      if (downloadError || !templateBytes) {
        // Fallback auf Plain-Export wenn Template nicht ladbar
        wb = erstellePlainWorkbook(abrechnungen)
      } else {
        const arrayBuffer = await templateBytes.arrayBuffer()
        const uint8 = new Uint8Array(arrayBuffer)
        const mapping = vorlage.mapping

        wb = XLSX.read(uint8, { type: 'array', cellStyles: true })
        const sheetName = wb.SheetNames[mapping.sheet_index] ?? wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]

        // Für jede Abrechnung ein Sheet befüllen (nur erste Abrechnung in Template-Sheet,
        // weitere als neue Sheets anhängen)
        abrechnungen.forEach((abr, abrIdx) => {
          const targetSheet = abrIdx === 0 ? ws : (() => {
            // Template-Sheet kopieren für weitere Abrechnungen
            const newWs: XLSX.WorkSheet = JSON.parse(JSON.stringify(ws))
            const newName = abr.name.slice(0, 31).replace(/[\\/:*?[\]]/g, '_')
            XLSX.utils.book_append_sheet(wb, newWs, newName)
            return newWs
          })()

          abr.abrechnung_positionen.forEach((pos, i) => {
            const row = mapping.data_start_row + i
            const { columns } = mapping

            if (columns.positionsname !== null) {
              setzeZellwert(targetSheet, row, columns.positionsname, pos.positionsname, mapping.data_start_row)
            }
            if (columns.einheit !== null) {
              setzeZellwert(targetSheet, row, columns.einheit, pos.einheit, mapping.data_start_row)
            }
            if (columns.menge !== null) {
              setzeZellwert(targetSheet, row, columns.menge, pos.menge, mapping.data_start_row)
            }
            if (columns.einheitspreis !== null) {
              setzeZellwert(targetSheet, row, columns.einheitspreis, pos.einheitspreis, mapping.data_start_row)
            }
            if (columns.faktor !== null) {
              setzeZellwert(targetSheet, row, columns.faktor, pos.faktor, mapping.data_start_row)
            }
            if (columns.gesamtpreis !== null) {
              setzeZellwert(targetSheet, row, columns.gesamtpreis, pos.gesamtpreis, mapping.data_start_row)
            }

            erweitereRef(targetSheet, row)
          })
        })
      }
    } else {
      // ── Plain-Export (kein Template vorhanden) ─────────────────────────────
      wb = erstellePlainWorkbook(abrechnungen)
    }

    const xlsxBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true })
    const uint8Out = new Uint8Array(xlsxBuffer)

    const fileName = `${user.id}/exports/${Date.now()}_abrechnung.xlsx`
    const { error: uploadError } = await supabase.storage
      .from('vorlagen')
      .upload(fileName, uint8Out, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      })

    if (uploadError) {
      return new Response(JSON.stringify({ message: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: signedUrl } = await supabase.storage
      .from('vorlagen')
      .createSignedUrl(fileName, 60 * 60)

    return new Response(
      JSON.stringify({ download_url: signedUrl?.signedUrl, file_name: 'abrechnung.xlsx' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ message: err instanceof Error ? err.message : 'Interner Fehler' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function erstellePlainWorkbook(abrechnungen: Abrechnung[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  for (const abr of abrechnungen) {
    const rows: unknown[][] = [
      ['Position', 'Einheit', 'Menge', 'Einheitspreis €', 'Faktor', 'Gesamtpreis €'],
      ...abr.abrechnung_positionen.map((p) => [
        p.positionsname, p.einheit, p.menge, p.einheitspreis, p.faktor, p.gesamtpreis,
      ]),
      [],
      ['Gesamt', '', '', '', '', abr.abrechnung_positionen.reduce((s, p) => s + p.gesamtpreis, 0)],
    ]

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [
      { wch: 40 }, // Position
      { wch: 10 }, // Einheit
      { wch: 12 }, // Menge
      { wch: 16 }, // EP
      { wch: 8 },  // Faktor
      { wch: 16 }, // Gesamt
    ]

    const sheetName = abr.name.slice(0, 31).replace(/[\\/:*?[\]]/g, '_')
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  return wb
}

// supabase/functions/export-excel/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Daten laden
    let abrechnungen: Array<{
      id: string
      name: string
      status: string
      abrechnung_positionen: Array<{
        positionsname: string
        einheit: string
        menge: number
        einheitspreis: number
        faktor: number
        gesamtpreis: number
      }>
    }> = []

    if (body.abrechnung_id) {
      const { data, error } = await supabase
        .from('abrechnungen')
        .select(`
          id, name, status,
          abrechnung_positionen (
            positionsname, einheit, menge, einheitspreis, faktor, gesamtpreis
          )
        `)
        .eq('id', body.abrechnung_id)
        .single()

      if (error || !data) {
        return new Response(JSON.stringify({ message: 'Abrechnung nicht gefunden' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      abrechnungen = [data as typeof abrechnungen[0]]
    } else if (body.baustelle_id) {
      const { data, error } = await supabase
        .from('abrechnungen')
        .select(`
          id, name, status,
          abrechnung_positionen (
            positionsname, einheit, menge, einheitspreis, faktor, gesamtpreis
          )
        `)
        .eq('baustelle_id', body.baustelle_id)

      if (error) {
        return new Response(JSON.stringify({ message: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      abrechnungen = (data ?? []) as typeof abrechnungen
    } else {
      return new Response(JSON.stringify({ message: 'abrechnung_id oder baustelle_id erforderlich' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Excel-Workbook erstellen
    const wb = XLSX.utils.book_new()

    for (const abr of abrechnungen) {
      const rows: unknown[][] = [
        ['Position', 'Einheit', 'Menge', 'Einheitspreis €', 'Faktor', 'Gesamtpreis €'],
        ...abr.abrechnung_positionen.map((p) => [
          p.positionsname,
          p.einheit,
          p.menge,
          p.einheitspreis,
          p.faktor,
          p.gesamtpreis,
        ]),
        [],
        [
          'Gesamt',
          '',
          '',
          '',
          '',
          abr.abrechnung_positionen.reduce((s, p) => s + p.gesamtpreis, 0),
        ],
      ]

      const ws = XLSX.utils.aoa_to_sheet(rows)

      // Spaltenbreiten
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

    const xlsxBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const uint8 = new Uint8Array(xlsxBuffer)

    // In Storage hochladen
    const fileName = `${user.id}/exports/${Date.now()}_abrechnung.xlsx`
    const { error: uploadError } = await supabase.storage
      .from('vorlagen')
      .upload(fileName, uint8, {
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
      .createSignedUrl(fileName, 60 * 60) // 1 Stunde gültig

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

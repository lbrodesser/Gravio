'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useImportLv } from '@/hooks/use-lv'
import { EinheitenFaktorenDialog } from './EinheitenFaktorenDialog'
import type { LvImportData } from '@/lib/validations/lv'

interface ParsedRow {
  artikelnr: string | null
  kurztext: string
  einheit: string
  einheitspreis: number
  faktor: number
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Deutschen Dezimaltrennzeichen normalisieren
function parseGermanNumber(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    const cleaned = val.replace(/\./g, '').replace(',', '.')
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, '').replace(/__empty/g, '')
}

export function LvImportDialog({ open, onOpenChange }: Props): React.JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null)
  const [gruppenname, setGruppenname] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null)
  const [uniqueEinheiten, setUniqueEinheiten] = useState<string[]>([])
  const [showFaktoren, setShowFaktoren] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const importLv = useImportLv()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const { read, utils } = await import('xlsx-js-style')
        const data = new Uint8Array(ev.target?.result as ArrayBuffer)
        const workbook = read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

        if (rows.length === 0) {
          toast.error('Die Datei enthält keine Daten')
          setIsLoading(false)
          return
        }

        // Spalten-Mapping erkennen
        const rawHeaders = Object.keys(rows[0])

        const findCol = (keywords: string[]): string | undefined =>
          rawHeaders.find((h) => keywords.some((k) => normalizeHeader(h).includes(k)))

        const artCol = findCol(['artikel', 'artikelnr', 'pos', 'nr'])
        const txtCol = findCol(['kurztext', 'beschreibung', 'text', 'bezeichnung', 'leistung'])
        const einheitCol = findCol(['einheit', 'eh', 'unit'])
        const preisCol = findCol(['ep', 'einheitspreis', 'preis', 'eur'])

        if (!txtCol || !einheitCol) {
          toast.error('Spalten "Kurztext" und "Einheit" konnten nicht erkannt werden')
          setIsLoading(false)
          return
        }

        const parsed: ParsedRow[] = rows
          .filter((r) => String(r[txtCol ?? '']).trim().length > 0)
          .map((r) => ({
            artikelnr: artCol ? String(r[artCol]).trim() || null : null,
            kurztext: String(r[txtCol]).trim(),
            einheit: String(r[einheitCol]).trim(),
            einheitspreis: preisCol ? parseGermanNumber(r[preisCol]) : 0,
            faktor: 1,
          }))

        const einheiten = [...new Set(parsed.map((p) => p.einheit).filter(Boolean))]

        setParsedRows(parsed)
        setUniqueEinheiten(einheiten)
        setGruppenname(file.name.replace(/\.[^.]+$/, ''))
      } catch {
        toast.error('Fehler beim Lesen der Datei')
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function handleWeiter(): void {
    if (!parsedRows || !gruppenname.trim()) return
    setShowFaktoren(true)
  }

  async function handleImport(einheitenFaktoren: Record<string, number>): Promise<void> {
    if (!parsedRows) return

    const data: LvImportData = {
      gruppenname: gruppenname.trim(),
      positionen: parsedRows,
      einheiten_faktoren: einheitenFaktoren,
    }

    const result = await importLv.mutateAsync(data)
    if (!result.error) {
      setShowFaktoren(false)
      setParsedRows(null)
      onOpenChange(false)
    }
  }

  return (
    <>
      <Dialog open={open && !showFaktoren} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Leistungsverzeichnis importieren</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lv-file">Excel-Datei (.xlsx)</Label>
              <input
                ref={fileRef}
                id="lv-file"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full h-14"
                onClick={() => fileRef.current?.click()}
                disabled={isLoading}
              >
                <Upload className="mr-2 h-5 w-5" />
                {parsedRows
                  ? `${parsedRows.length} Positionen geladen`
                  : 'Datei auswählen'}
              </Button>
            </div>

            {parsedRows && (
              <div className="space-y-2">
                <Label htmlFor="lv-name">Name des Leistungsverzeichnisses</Label>
                <Input
                  id="lv-name"
                  value={gruppenname}
                  onChange={(e) => setGruppenname(e.target.value)}
                  className="h-14"
                  placeholder="z. B. LV Kanal 2026"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="h-14" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleWeiter}
              disabled={!parsedRows || !gruppenname.trim()}
              className="h-14"
            >
              Weiter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showFaktoren && parsedRows && (
        <EinheitenFaktorenDialog
          open={showFaktoren}
          einheiten={uniqueEinheiten}
          onConfirm={handleImport}
          onCancel={() => setShowFaktoren(false)}
          isLoading={importLv.isPending}
        />
      )}
    </>
  )
}

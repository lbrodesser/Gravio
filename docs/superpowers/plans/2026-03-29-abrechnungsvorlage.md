# Abrechnungsvorlage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nutzer können eine firmeneigene Excel-Vorlage hochladen; Claude analysiert automatisch welche Spalten wohin gehören; der Abrechnung-Export befüllt die Vorlage ohne Formatierung zu ändern.

**Architecture:** Server Action empfängt Excel-Datei via FormData → xlsx-js-style extrahiert Zellstruktur der ersten 10 Zeilen → Claude API (claude-haiku-4-5-20251001) identifiziert Header-Zeile + Spalten-Mapping → Mapping wird als JSONB in `abrechnungsvorlagen.mapping` gespeichert. Export-Edge-Function fragt automatisch die neueste Vorlage des Users ab; wenn Mapping vorhanden: Template aus Storage laden, Daten in korrekte Zellen schreiben (Styles erhalten), Output zurückgeben; sonst: Plain-Export wie bisher.

**Tech Stack:** Next.js 15 Server Actions + FormData, xlsx-js-style (already installed), @anthropic-ai/sdk (new), Supabase Storage + SSR, TanStack Query v5, Deno Edge Function (XLSX via esm.sh), shadcn/ui (Dialog, Button, Label)

---

## File Map

| Aktion  | Pfad | Zweck |
|---------|------|-------|
| Create  | `supabase/migrations/20260329000000_vorlage_mapping.sql` | `mapping` + `analysiert` Spalten zu `abrechnungsvorlagen` |
| Modify  | `types/lv.ts` | `VorlageMapping` Interface + `Abrechnungsvorlage` um `mapping` + `analysiert` erweitern |
| Modify  | `next.config.ts` | `serverActionsBodySizeLimit: '10mb'` |
| Create  | `actions/abrechnungsvorlagen.ts` | Server Actions: list, upload+analyse, delete |
| Create  | `hooks/use-abrechnungsvorlagen.ts` | TanStack Query: fetch + mutations |
| Create  | `components/abrechnung/AbrechnungsvorlageSection.tsx` | Upload-UI + Vorlage-Liste mit Status |
| Modify  | `app/mobile/lv/page.tsx` | AbrechnungsvorlageSection unterhalb der LV-Liste |
| Modify  | `app/desktop/lv/page.tsx` | AbrechnungsvorlageSection in rechter Spalte wenn keine LV ausgewählt |
| Modify  | `supabase/functions/export-excel/index.ts` | Template-basierter Export (auto-detect neueste Vorlage) |

---

## Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260329000000_vorlage_mapping.sql`

- [ ] **Schritt 1: SQL-Datei erstellen**

```sql
-- supabase/migrations/20260329000000_vorlage_mapping.sql

ALTER TABLE abrechnungsvorlagen
  ADD COLUMN IF NOT EXISTS mapping jsonb,
  ADD COLUMN IF NOT EXISTS analysiert boolean NOT NULL DEFAULT false;
```

- [ ] **Schritt 2: Migration via Supabase MCP anwenden**

Verwende `mcp__claude_ai_Supabase__apply_migration` mit:
- `project_id`: `glkamrvfsmolqfgampmx`
- `name`: `vorlage_mapping`
- `query`: SQL aus Schritt 1

- [ ] **Schritt 3: Verifizieren**

Via `mcp__claude_ai_Supabase__execute_sql`:
```sql
select column_name, data_type
from information_schema.columns
where table_name = 'abrechnungsvorlagen'
order by ordinal_position;
```
Erwartung: Spalten `id, user_id, name, storage_path, created_at, mapping, analysiert`

---

## Task 2: Types + next.config.ts

**Files:**
- Modify: `types/lv.ts`
- Modify: `next.config.ts`

- [ ] **Schritt 1: `VorlageMapping` Interface + erweiterter `Abrechnungsvorlage` Typ in `types/lv.ts`**

Füge nach dem `Abrechnungsvorlage` Interface ein:

```typescript
// Ersetze das bestehende Abrechnungsvorlage Interface:
export interface VorlageMapping {
  sheet_index: number          // 0-basierter Index des Sheets
  header_row: number           // 0-basierte Zeile mit Spaltenüberschriften
  data_start_row: number       // 0-basierte erste Zeile für Datenwerte
  columns: {
    positionsname: number | null
    einheit: number | null
    menge: number | null
    einheitspreis: number | null
    faktor: number | null
    gesamtpreis: number | null
  }
}

export interface Abrechnungsvorlage {
  id: string
  user_id: string
  name: string
  storage_path: string
  created_at: string | null
  mapping: VorlageMapping | null
  analysiert: boolean
}
```

- [ ] **Schritt 2: `serverActionsBodySizeLimit` in `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActionsBodySizeLimit: '10mb',
  },
};

export default nextConfig;
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartung: 0 Fehler

---

## Task 3: Anthropic SDK installieren

**Files:** `package.json` (via pnpm)

- [ ] **Schritt 1: SDK installieren**

```bash
pnpm add @anthropic-ai/sdk
```

- [ ] **Schritt 2: Env-Variable prüfen**

`.env.local` muss enthalten:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Falls nicht vorhanden: beim Nutzer nachfragen. Die Variable wird in der Server Action gebraucht (`process.env.ANTHROPIC_API_KEY`).

---

## Task 4: Server Actions `actions/abrechnungsvorlagen.ts`

**Files:**
- Create: `actions/abrechnungsvorlagen.ts`

- [ ] **Schritt 1: Datei erstellen**

```typescript
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
  const rows = utils.sheet_to_json<Record<string, unknown>>(ws, {
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

  // Validierung
  const NameSchema = z.string().min(1).max(100)
  const rawName = formData.get('name')
  const nameParsed = NameSchema.safeParse(
    typeof rawName === 'string' && rawName.trim() ? rawName.trim() : file.name.replace(/\.[^.]+$/, '')
  )
  if (!nameParsed.success) return { data: null, error: 'Ungültiger Name' }

  if (file.size > 10 * 1024 * 1024) return { data: null, error: 'Datei zu groß (max. 10 MB)' }
  if (!file.name.match(/\.(xlsx|xls)$/i)) return { data: null, error: 'Nur .xlsx/.xls erlaubt' }

  // In Storage hochladen
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const storagePath = `${user.id}/templates/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { error: uploadError } = await supabase.storage
    .from('vorlagen')
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: false,
    })

  if (uploadError) return { data: null, error: uploadError.message }

  // Metadaten in DB speichern
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

  // Claude-Analyse
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
    // Hochladen hat geklappt, nur Analyse fehlgeschlagen → kein Rollback
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

  // Storage-Pfad aus DB holen
  const { data: vorlage, error: fetchError } = await supabase
    .from('abrechnungsvorlagen')
    .select('storage_path')
    .eq('id', idParsed.data)
    .single()

  if (fetchError || !vorlage) return { error: 'Vorlage nicht gefunden' }

  // Aus Storage löschen
  await supabase.storage
    .from('vorlagen')
    .remove([(vorlage as { storage_path: string }).storage_path])

  // Aus DB löschen
  const { error: deleteError } = await supabase
    .from('abrechnungsvorlagen')
    .delete()
    .eq('id', idParsed.data)

  if (deleteError) return { error: deleteError.message }

  revalidatePath('/mobile/lv')
  revalidatePath('/desktop/lv')
  return { error: null }
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartung: 0 Fehler

---

## Task 5: Hook `hooks/use-abrechnungsvorlagen.ts`

**Files:**
- Create: `hooks/use-abrechnungsvorlagen.ts`

- [ ] **Schritt 1: Hook erstellen**

```typescript
'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getAbrechnungsvorlagen,
  uploadUndAnalysiereVorlage,
  deleteAbrechnungsvorlage,
} from '@/actions/abrechnungsvorlagen'
import type { Abrechnungsvorlage } from '@/types/lv'

export function useAbrechnungsvorlagen(): UseQueryResult<Abrechnungsvorlage[], Error> {
  return useQuery({
    queryKey: ['abrechnungsvorlagen'] as const,
    queryFn: async (): Promise<Abrechnungsvorlage[]> => {
      const result = await getAbrechnungsvorlagen()
      if (result.error) throw new Error(result.error)
      return result.data ?? []
    },
  })
}

export function useUploadVorlage(): UseMutationResult<
  { data: Abrechnungsvorlage | null; error: string | null },
  Error,
  FormData
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formData: FormData) => uploadUndAnalysiereVorlage(formData),
    onSuccess: (result) => {
      if (result.error) {
        // Partieller Erfolg: hochgeladen aber Analyse fehlgeschlagen
        toast.warning(result.error)
      } else {
        toast.success('Vorlage hochgeladen und analysiert')
      }
      queryClient.invalidateQueries({ queryKey: ['abrechnungsvorlagen'] })
    },
    onError: () => toast.error('Upload fehlgeschlagen'),
  })
}

export function useDeleteVorlage(): UseMutationResult<
  { error: string | null },
  Error,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAbrechnungsvorlage(id),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['abrechnungsvorlagen'] })
      toast.success('Vorlage gelöscht')
    },
    onError: () => toast.error('Löschen fehlgeschlagen'),
  })
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartung: 0 Fehler

---

## Task 6: UI-Komponente `components/abrechnung/AbrechnungsvorlageSection.tsx`

**Files:**
- Create: `components/abrechnung/AbrechnungsvorlageSection.tsx`

- [ ] **Schritt 1: Komponente erstellen**

```typescript
'use client'

import { useRef } from 'react'
import { Upload, Trash2, CheckCircle, Loader2, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAbrechnungsvorlagen, useUploadVorlage, useDeleteVorlage } from '@/hooks/use-abrechnungsvorlagen'
import type { Abrechnungsvorlage } from '@/types/lv'

export function AbrechnungsvorlageSection(): React.JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: vorlagen, isLoading } = useAbrechnungsvorlagen()
  const uploadVorlage = useUploadVorlage()
  const deleteVorlage = useDeleteVorlage()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', file.name.replace(/\.[^.]+$/, ''))
    uploadVorlage.mutate(formData)
    // Reset input so dieselbe Datei nochmal gewählt werden kann
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Abrechnungsvorlage</h3>
        <Button
          size="sm"
          variant="outline"
          className="h-10"
          onClick={() => fileRef.current?.click()}
          disabled={uploadVorlage.isPending}
        >
          {uploadVorlage.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Analysiere…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-1" />
              Hochladen
            </>
          )}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {isLoading && (
        <div className="h-12 rounded bg-muted animate-pulse" />
      )}

      {!isLoading && (!vorlagen || vorlagen.length === 0) && (
        <p className="text-xs text-muted-foreground py-2">
          Noch keine Vorlage hochgeladen. Der Export verwendet dann ein Standard-Layout.
        </p>
      )}

      {!isLoading && vorlagen && vorlagen.length > 0 && (
        <ul className="space-y-2">
          {vorlagen.map((v: Abrechnungsvorlage) => (
            <li
              key={v.id}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 min-w-0 truncate">{v.name}</span>
              {v.analysiert ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-green-500" title="Analysiert" />
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" title="Wird analysiert…" />
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                onClick={() => deleteVorlage.mutate(v.id)}
                disabled={deleteVorlage.isPending}
                aria-label="Vorlage löschen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartung: 0 Fehler

---

## Task 7: AbrechnungsvorlageSection in LV-Pages einbinden

**Files:**
- Modify: `app/mobile/lv/page.tsx`
- Modify: `app/desktop/lv/page.tsx`

- [ ] **Schritt 1: Mobile LV-Page**

`app/mobile/lv/page.tsx` — Section unter der Gruppen-Liste hinzufügen:

```typescript
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLvGruppen } from '@/hooks/use-lv'
import { LvGruppeCard } from '@/components/lv/LvGruppeCard'
import { LvImportDialog } from '@/components/lv/LvImportDialog'
import { AbrechnungsvorlageSection } from '@/components/abrechnung/AbrechnungsvorlageSection'

export default function MobileLvPage(): React.JSX.Element {
  const [importOpen, setImportOpen] = useState(false)
  const { data: gruppen, isLoading } = useLvGruppen()

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <h1 className="text-lg font-semibold">Leistungsverzeichnisse</h1>
        <Button size="icon" className="h-14 w-14" onClick={() => setImportOpen(true)}>
          <Plus className="h-6 w-6" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </>
        )}

        {!isLoading && (!gruppen || gruppen.length === 0) && (
          <div className="flex flex-col items-center justify-center h-48 gap-4 text-center">
            <p className="text-muted-foreground">
              Noch kein Leistungsverzeichnis vorhanden
            </p>
            <Button className="h-14" onClick={() => setImportOpen(true)}>
              <Plus className="mr-2 h-5 w-5" />
              LV importieren
            </Button>
          </div>
        )}

        {!isLoading && gruppen?.map((g) => <LvGruppeCard key={g.id} gruppe={g} />)}

        <div className="pt-4 border-t">
          <AbrechnungsvorlageSection />
        </div>
      </div>

      <LvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
```

- [ ] **Schritt 2: Desktop LV-Page**

`app/desktop/lv/page.tsx` — AbrechnungsvorlageSection am Ende der linken Sidebar:

```typescript
'use client'

import { useState } from 'react'
import { Plus, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLvGruppen, useLvPositionen } from '@/hooks/use-lv'
import { LvImportDialog } from '@/components/lv/LvImportDialog'
import { AbrechnungsvorlageSection } from '@/components/abrechnung/AbrechnungsvorlageSection'
import type { LvGruppe } from '@/types/lv'

export default function DesktopLvPage(): React.JSX.Element {
  const [importOpen, setImportOpen] = useState(false)
  const [selectedGruppe, setSelectedGruppe] = useState<LvGruppe | null>(null)
  const { data: gruppen, isLoading } = useLvGruppen()
  const { data: positionen, isLoading: posLoading } = useLvPositionen(
    selectedGruppe?.id ?? null
  )

  return (
    <div className="flex h-full">
      {/* Linke Spalte */}
      <aside className="w-72 border-r flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-semibold">Leistungsverzeichnisse</h2>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Import
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading &&
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded bg-muted animate-pulse" />
            ))}
          {!isLoading && (!gruppen || gruppen.length === 0) && (
            <div className="p-2 space-y-2">
              <p className="text-sm text-muted-foreground">Kein LV vorhanden</p>
              <Button size="sm" variant="outline" className="w-full" onClick={() => setImportOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                LV importieren
              </Button>
            </div>
          )}
          {gruppen?.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGruppe(g)}
              className={`w-full text-left px-3 py-3 rounded-md text-sm transition-colors min-h-[44px] ${
                selectedGruppe?.id === g.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Abrechnungsvorlage Section am unteren Ende der Sidebar */}
        <div className="border-t p-3">
          <AbrechnungsvorlageSection />
        </div>
      </aside>

      {/* Rechte Spalte */}
      <main className="flex-1 overflow-y-auto">
        {!selectedGruppe && !isLoading && (!gruppen || gruppen.length === 0) && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <ClipboardList className="h-12 w-12 opacity-40" />
            <p className="text-sm">Noch kein Leistungsverzeichnis importiert</p>
            <Button onClick={() => setImportOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              LV importieren
            </Button>
          </div>
        )}
        {!selectedGruppe && (isLoading || (gruppen && gruppen.length > 0)) && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">LV auswählen</p>
          </div>
        )}
        {selectedGruppe && (
          <>
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">{selectedGruppe.name}</h2>
              <p className="text-sm text-muted-foreground">
                {positionen?.length ?? '–'} Positionen
              </p>
            </div>
            <div className="divide-y">
              {posLoading &&
                [...Array(6)].map((_, i) => (
                  <div key={i} className="px-6 py-4 h-14 bg-muted/30 animate-pulse" />
                ))}
              {!posLoading &&
                positionen?.map((pos) => (
                  <div key={pos.id} className="px-6 py-3 flex items-center gap-4 text-sm">
                    {pos.artikelnr && (
                      <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">
                        {pos.artikelnr}
                      </span>
                    )}
                    <span className="flex-1">{pos.kurztext}</span>
                    <span className="text-muted-foreground w-12 text-right shrink-0">
                      {pos.einheit}
                    </span>
                    <span className="font-mono w-28 text-right shrink-0">
                      {pos.einheitspreis.toLocaleString('de-DE', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </span>
                  </div>
                ))}
            </div>
          </>
        )}
      </main>

      <LvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
```

- [ ] **Schritt 3: TypeScript + Build prüfen**

```bash
pnpm tsc --noEmit && pnpm build
```
Erwartung: 0 Fehler, Build erfolgreich

---

## Task 8: Export-Edge-Function mit Template-Support

**Files:**
- Modify: `supabase/functions/export-excel/index.ts`

- [ ] **Schritt 1: Edge Function ersetzen**

Die gesamte Datei `supabase/functions/export-excel/index.ts` ersetzen:

```typescript
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
    ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 16 }]
    const sheetName = abr.name.slice(0, 31).replace(/[\\/:*?[\]]/g, '_')
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  return wb
}
```

- [ ] **Schritt 2: Edge Function deployen**

Via Supabase MCP `mcp__claude_ai_Supabase__deploy_edge_function`:
- `project_id`: `glkamrvfsmolqfgampmx`
- `name`: `export-excel`
- `entrypoint_path`: `supabase/functions/export-excel/index.ts`

---

## Task 9: ANTHROPIC_API_KEY als Supabase Secret setzen

- [ ] **Schritt 1: Secret setzen**

Der Nutzer muss einmalig in seinem Terminal ausführen:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref glkamrvfsmolqfgampmx
```

Alternativ im Supabase Dashboard unter Project → Settings → Edge Functions → Secrets.

- [ ] **Schritt 2: End-to-End Test**

1. `pnpm dev --turbo` starten
2. `/mobile/lv` oder `/desktop/lv` öffnen
3. Firmen-Excel-Vorlage hochladen → Loader erscheint → nach ~3s "Analysiert" (grüner Haken)
4. Aufmaß-Seite öffnen → Abrechnung erstellen → Export klicken → Excel-Download enthält Firmenlayout

---

## Commit-Strategie

Nach Task 2: `feat: add VorlageMapping type + next.config body limit`
Nach Task 4: `feat: add abrechnungsvorlagen server actions with Claude analysis`
Nach Task 5: `feat: add use-abrechnungsvorlagen hooks`
Nach Task 6: `feat: add AbrechnungsvorlageSection component`
Nach Task 7: `feat: integrate AbrechnungsvorlageSection into LV pages`
Nach Task 8: `feat: template-based Excel export in export-excel edge function`

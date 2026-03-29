# Element LV-Verknüpfung & Positions-Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elements können einem LV zugeordnet werden; ein Positions-Browser ermöglicht das Hinzufügen von LV-Positionen per Klick (Desktop) bzw. Checkbox (Mobile).

**Architecture:** `element_templates` bekommt ein nullable `lv_gruppe_id` FK. Die Desktop-Elemente-Seite wird zu einem 3-Spalten-Layout erweitert (Liste | Formular | LV-Browser); auf Mobile öffnet ein eigenes Full-Screen-Sheet den Positions-Picker. Wenn kein LV gewählt ist, bleibt der bisherige manuelle `PositionenEditor` erhalten (Rückwärtskompatibilität).

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui (Sheet, Dialog, Input, Button, Select, Label, Skeleton), React Hook Form + Zod, TanStack Query v5, Supabase, Lucide React (Search, Check, Plus, Trash2, X)

---

## File Map

| Aktion | Pfad | Zuständigkeit |
|--------|------|---------------|
| Create | `supabase/migrations/20260329100000_element_templates_lv.sql` | `lv_gruppe_id` zu `element_templates` |
| Modify | `types/index.ts` | `lv_gruppe_id` zu `ElementTemplate` |
| Modify | `lib/validations/element-template.ts` | `lv_gruppe_id` im Schema |
| Modify | `actions/element-templates.ts` | `lv_gruppe_id` in create/update |
| Modify | `hooks/use-element-templates.ts` | Query key + Typ-Update |
| Create | `components/elemente/PositionenListe.tsx` | Listet gewählte LV-Positionen (menge editierbar) |
| Create | `components/elemente/LvPositionenPanel.tsx` | Desktop: rechtes Panel mit Suche + Klick-Liste |
| Create | `components/elemente/LvPositionenSheet.tsx` | Mobile: Full-Screen Sheet mit Checkboxen |
| Modify | `components/elemente/ElementDetailPanel.tsx` | Desktop-Formular (LV-Select + neue Positions-UI) |
| Modify | `components/elemente/ElementFormSheet.tsx` | Mobile-Formular (LV-Select + neue Positions-UI) |
| Modify | `app/desktop/elemente/page.tsx` | 3-Spalten-Layout, LV-State, LV-Positionen fetchen |
| Modify | `app/mobile/elemente/page.tsx` | LV-Daten an FormSheet weitergeben |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260329100000_element_templates_lv.sql`

- [ ] **Step 1: Migration schreiben**

```sql
-- supabase/migrations/20260329100000_element_templates_lv.sql

-- lv_gruppe_id verweist auf preislisten_gruppen (lv_gruppen ist nur ein View)
ALTER TABLE public.element_templates
  ADD COLUMN IF NOT EXISTS lv_gruppe_id uuid
    REFERENCES public.preislisten_gruppen(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Migration in Supabase anwenden**

Im Supabase Dashboard → SQL Editor ausführen, oder lokal:
```bash
supabase db push
```
Expected: Kein Fehler, Spalte `lv_gruppe_id` in `element_templates` vorhanden.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260329100000_element_templates_lv.sql
git commit -m "feat: add lv_gruppe_id to element_templates"
```

---

## Task 2: Types + Validation

**Files:**
- Modify: `types/index.ts` — `lv_gruppe_id` zu `ElementTemplate`
- Modify: `lib/validations/element-template.ts` — Feld im Schema

- [ ] **Step 1: `types/index.ts` anpassen**

In `ElementTemplate` eine Zeile hinzufügen (nach `tiefe`):

```typescript
export interface ElementTemplate {
  id: string
  created_at: string
  name: string
  description: string | null
  laenge: number | null
  breite: number | null
  tiefe: number | null
  lv_gruppe_id: string | null   // NEU
  positionen: Position[]
  created_by: string
}
```

- [ ] **Step 2: `lib/validations/element-template.ts` anpassen**

```typescript
// lib/validations/element-template.ts
import { z } from 'zod'

export const EinheitSchema = z.enum(['m³', 'm²', 'm', 'Stk', 't'])

export const PositionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name ist erforderlich'),
  einheit: EinheitSchema,
  menge: z.number().nullable(),
  lv_position_id: z.string().uuid().nullable().optional(),
})

const nullableNumber = z.preprocess(
  (v) =>
    v === '' || v === undefined || v === null || (typeof v === 'number' && isNaN(v))
      ? null
      : Number(v),
  z.number().positive('Muss eine positive Zahl sein').nullable()
)

export const ElementTemplateFormSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  description: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().nullable().optional()
  ),
  laenge: nullableNumber,
  breite: nullableNumber,
  tiefe: nullableNumber,
  lv_gruppe_id: z.preprocess(        // NEU
    (v) => (v === '' ? null : v),
    z.string().uuid().nullable().optional()
  ),
  positionen: z.array(PositionSchema).default([]),
})

export type ElementTemplateFormData = z.infer<typeof ElementTemplateFormSchema>
```

- [ ] **Step 3: Commit**

```bash
git add types/index.ts lib/validations/element-template.ts
git commit -m "feat: add lv_gruppe_id to ElementTemplate type and schema"
```

---

## Task 3: Server Actions

**Files:**
- Modify: `actions/element-templates.ts`

Das Feld `lv_gruppe_id` muss in `insert` und `update` durchgereicht werden. Da `ElementTemplateFormSchema` es jetzt enthält, wird es durch `parsed.data` automatisch mitgenommen — es gibt nichts Besonderes zu tun außer sicherzustellen, dass der Action-Code `parsed.data` vollständig nutzt (was er bereits tut).

- [ ] **Step 1: `createElementTemplate` prüfen**

`actions/element-templates.ts` Zeile 27–29 — `insert` nutzt `{ ...parsed.data, created_by: user.id }`. Da `lv_gruppe_id` jetzt in `parsed.data` enthalten ist, wird es automatisch eingefügt. Keine Codeänderung nötig.

- [ ] **Step 2: `updateElementTemplate` prüfen**

Zeile 57 — `update(parsed.data)` enthält `lv_gruppe_id` automatisch. Keine Codeänderung nötig.

- [ ] **Step 3: TypeScript-Check**

```bash
pnpm tsc --noEmit
```
Expected: 0 Fehler.

---

## Task 4: Hook Update

**Files:**
- Modify: `hooks/use-element-templates.ts`

Der `select('*')` Query gibt `lv_gruppe_id` automatisch zurück, sobald die Spalte existiert. Der Query Key bleibt gleich. Einzige Änderung: das Ergebnis wird jetzt als `ElementTemplate[]` mit `lv_gruppe_id` typisiert (bereits korrekt durch den Type-Cast in Zeile 32).

- [ ] **Step 1: Keine Codeänderung nötig — TypeScript-Check ausführen**

```bash
pnpm tsc --noEmit
```
Expected: 0 Fehler (da `ElementTemplate.lv_gruppe_id` jetzt definiert ist und `select('*')` es liefert).

---

## Task 5: `PositionenListe` Komponente

**Files:**
- Create: `components/elemente/PositionenListe.tsx`

Diese Komponente zeigt die bereits gewählten Positionen an (für den LV-Modus). Name und Einheit sind read-only (kommen vom LV), Menge ist editierbar, jede Position hat einen Entfernen-Button.

- [ ] **Step 1: Komponente erstellen**

```typescript
// components/elemente/PositionenListe.tsx
'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Position } from '@/types'

interface PositionenListeProps {
  positionen: Position[]
  onChange: (positionen: Position[]) => void
}

export function PositionenListe({
  positionen,
  onChange,
}: PositionenListeProps): React.JSX.Element {
  function updateMenge(id: string, value: string): void {
    onChange(
      positionen.map((p) =>
        p.id === id
          ? { ...p, menge: value ? Number(value) : null }
          : p
      )
    )
  }

  function remove(id: string): void {
    onChange(positionen.filter((p) => p.id !== id))
  }

  if (positionen.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Positionen</Label>
        <p className="text-sm text-muted-foreground py-2">
          Noch keine Positionen gewählt
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>Positionen ({positionen.length})</Label>
      <ul className="space-y-2">
        {positionen.map((pos) => (
          <li
            key={pos.id}
            className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{pos.name}</p>
              <p className="text-xs text-muted-foreground">{pos.einheit}</p>
            </div>
            <Input
              type="number"
              step="0.01"
              placeholder="Menge"
              value={pos.menge ?? ''}
              onChange={(e) => updateMenge(pos.id, e.target.value)}
              className="h-10 w-24 shrink-0 text-sm"
              aria-label={`Menge ${pos.name}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(pos.id)}
              className="h-10 w-10 shrink-0 text-destructive hover:text-destructive"
              aria-label={`${pos.name} entfernen`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
pnpm tsc --noEmit
```
Expected: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add components/elemente/PositionenListe.tsx
git commit -m "feat: add PositionenListe component for LV-linked positions"
```

---

## Task 6: `LvPositionenPanel` (Desktop)

**Files:**
- Create: `components/elemente/LvPositionenPanel.tsx`

Rechte Spalte im Desktop-Layout. Zeigt alle Positionen des gewählten LV mit Suchleiste. Bereits hinzugefügte Positionen haben ein Häkchen; Klick auf eine nicht-hinzugefügte Position fügt sie hinzu, Klick auf eine hinzugefügte entfernt sie.

- [ ] **Step 1: Komponente erstellen**

```typescript
// components/elemente/LvPositionenPanel.tsx
'use client'

import { useState } from 'react'
import { Search, Check, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LvPositionOption } from './PositionenEditor'

interface LvPositionenPanelProps {
  positionen: LvPositionOption[]
  addedIds: Set<string>
  onAdd: (pos: LvPositionOption) => void
  onRemove: (id: string) => void
  isLoading: boolean
}

export function LvPositionenPanel({
  positionen,
  addedIds,
  onAdd,
  onRemove,
  isLoading,
}: LvPositionenPanelProps): React.JSX.Element {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? positionen.filter((p) =>
        p.kurztext.toLowerCase().includes(query.toLowerCase())
      )
    : positionen

  return (
    <div className="flex flex-col h-full border-l border-border">
      <div className="px-4 py-3 border-b border-border shrink-0">
        <p className="text-sm font-semibold mb-2">LV-Positionen</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <LvPanelSkeleton />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-4">
            {query ? 'Keine Treffer' : 'Keine Positionen im LV'}
          </p>
        ) : (
          <ul>
            {filtered.map((pos) => {
              const isAdded = addedIds.has(pos.id)
              return (
                <li key={pos.id}>
                  <button
                    type="button"
                    onClick={() => (isAdded ? onRemove(pos.id) : onAdd(pos))}
                    className={cn(
                      'w-full text-left flex items-center gap-3 px-4 py-3',
                      'border-b border-border transition-colors duration-100',
                      isAdded
                        ? 'bg-accent/10 hover:bg-accent/20'
                        : 'hover:bg-secondary'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{pos.kurztext}</p>
                      <p className="text-xs text-muted-foreground">{pos.einheit}</p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 flex items-center justify-center h-6 w-6 rounded-full',
                        isAdded
                          ? 'bg-accent text-accent-foreground'
                          : 'border border-border text-muted-foreground'
                      )}
                    >
                      {isAdded ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function LvPanelSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="px-4 py-3 border-b border-border space-y-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-12" />
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
pnpm tsc --noEmit
```
Expected: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add components/elemente/LvPositionenPanel.tsx
git commit -m "feat: add LvPositionenPanel for desktop element editor"
```

---

## Task 7: `LvPositionenSheet` (Mobile)

**Files:**
- Create: `components/elemente/LvPositionenSheet.tsx`

Full-Screen Bottom Sheet für Mobile. Zeigt alle Positionen des LV mit Checkboxen und einer Suchleiste. Bestätigung über "Übernehmen"-Button unten.

- [ ] **Step 1: Komponente erstellen**

```typescript
// components/elemente/LvPositionenSheet.tsx
'use client'

import { useState, useEffect } from 'react'
import { Search, Check } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { LvPositionOption } from './PositionenEditor'

interface LvPositionenSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  positionen: LvPositionOption[]
  initialSelectedIds: string[]
  onConfirm: (selectedIds: string[]) => void
  isLoading: boolean
}

export function LvPositionenSheet({
  open,
  onOpenChange,
  positionen,
  initialSelectedIds,
  onConfirm,
  isLoading,
}: LvPositionenSheetProps): React.JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelectedIds)
  )
  const [query, setQuery] = useState('')

  // Wenn das Sheet geöffnet wird, Selektion neu initialisieren
  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelectedIds))
      setQuery('')
    }
  }, [open, initialSelectedIds])

  const filtered = query.trim()
    ? positionen.filter((p) =>
        p.kurztext.toLowerCase().includes(query.toLowerCase())
      )
    : positionen

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleConfirm(): void {
    onConfirm(Array.from(selected))
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] flex flex-col rounded-t-xl p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <SheetTitle>Positionen auswählen</SheetTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Suchen…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-12 text-base"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <MobilePickerSkeleton />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 px-4">
              {query ? 'Keine Treffer' : 'Keine Positionen im LV'}
            </p>
          ) : (
            <ul>
              {filtered.map((pos) => {
                const isSelected = selected.has(pos.id)
                return (
                  <li key={pos.id}>
                    <button
                      type="button"
                      onClick={() => toggle(pos.id)}
                      className={cn(
                        'w-full text-left flex items-center gap-4 px-4 min-h-[64px]',
                        'border-b border-border transition-colors duration-100',
                        isSelected ? 'bg-accent/10' : 'hover:bg-secondary'
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 flex items-center justify-center h-6 w-6 rounded border-2',
                          isSelected
                            ? 'bg-accent border-accent'
                            : 'border-muted-foreground'
                        )}
                      >
                        {isSelected && (
                          <Check className="h-4 w-4 text-accent-foreground" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium truncate">
                          {pos.kurztext}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {pos.einheit}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="px-4 py-4 border-t border-border shrink-0">
          <Button
            onClick={handleConfirm}
            className="w-full h-14 text-base"
          >
            Übernehmen ({selected.size})
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MobilePickerSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="flex items-center gap-4 px-4 min-h-[64px] border-b border-border">
          <Skeleton className="h-6 w-6 rounded shrink-0" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-12" />
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
pnpm tsc --noEmit
```
Expected: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add components/elemente/LvPositionenSheet.tsx
git commit -m "feat: add LvPositionenSheet for mobile position picker"
```

---

## Task 8: `ElementDetailPanel` redesign (Desktop)

**Files:**
- Modify: `components/elemente/ElementDetailPanel.tsx`

Das Panel bekommt einen LV-Selector. Bei gewähltem LV wird `PositionenListe` verwendet und `onLvChange` informiert den Parent. Bei nicht gewähltem LV bleibt `PositionenEditor`. Callbacks `onAdd`/`onRemove` aus dem LV-Panel werden als Props hereingereicht.

- [ ] **Step 1: Vollständiges Rewrite**

```typescript
// components/elemente/ElementDetailPanel.tsx
'use client'

import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PositionenEditor, type LvPositionOption } from './PositionenEditor'
import { PositionenListe } from './PositionenListe'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'
import {
  useCreateTemplate,
  useUpdateTemplate,
} from '@/hooks/use-element-templates'
import type { ElementTemplate } from '@/types'
import type { LvGruppe } from '@/types/lv'

type ElementTemplateFormInput = z.input<typeof ElementTemplateFormSchema>

interface ElementDetailPanelProps {
  template: ElementTemplate | null
  onClose: () => void
  onDelete?: () => void
  lvGruppen: LvGruppe[]
  lvPositionen: LvPositionOption[]
  onLvChange: (lvGruppeId: string | null) => void
}

export function ElementDetailPanel({
  template,
  onClose,
  onDelete,
  lvGruppen,
  lvPositionen,
  onLvChange,
}: ElementDetailPanelProps): React.JSX.Element {
  const isEditing = !!template
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<ElementTemplateFormInput, unknown, ElementTemplateFormData>({
    resolver: zodResolver(ElementTemplateFormSchema),
    defaultValues: {
      name: '',
      description: null,
      laenge: null,
      breite: null,
      tiefe: null,
      lv_gruppe_id: null,
      positionen: [],
    },
  })

  const positionen = useWatch({ control, name: 'positionen' }) ?? []
  const currentLvId = watch('lv_gruppe_id') as string | null | undefined

  useEffect(() => {
    if (template) {
      reset({
        name: template.name,
        description: template.description,
        laenge: template.laenge,
        breite: template.breite,
        tiefe: template.tiefe,
        lv_gruppe_id: template.lv_gruppe_id,
        positionen: template.positionen,
      })
      onLvChange(template.lv_gruppe_id ?? null)
    } else {
      reset({
        name: '',
        description: null,
        laenge: null,
        breite: null,
        tiefe: null,
        lv_gruppe_id: null,
        positionen: [],
      })
      onLvChange(null)
    }
  }, [template, reset, onLvChange])

  function handleLvChange(value: string): void {
    const newId = value === '__none__' ? null : value
    setValue('lv_gruppe_id', newId ?? undefined, { shouldDirty: true })
    // LV-verknüpfte Positionen löschen; manuelle behalten
    const manual = positionen.filter((p) => !p.lv_position_id)
    setValue('positionen', manual, { shouldDirty: true })
    onLvChange(newId)
  }

  function handleAddPosition(pos: LvPositionOption): void {
    const alreadyAdded = positionen.some((p) => p.lv_position_id === pos.id)
    if (alreadyAdded) return
    setValue(
      'positionen',
      [
        ...positionen,
        {
          id: crypto.randomUUID(),
          name: pos.kurztext,
          einheit: pos.einheit as import('@/types').Einheit,
          menge: null,
          lv_position_id: pos.id,
        },
      ],
      { shouldDirty: true }
    )
  }

  function handleRemoveByLvId(lvPositionId: string): void {
    setValue(
      'positionen',
      positionen.filter((p) => p.lv_position_id !== lvPositionId),
      { shouldDirty: true }
    )
  }

  // Expose add/remove für das LvPositionenPanel im Parent
  // (Parent liest addedIds und ruft diese Callbacks auf)
  const addedLvIds = new Set(
    positionen
      .map((p) => p.lv_position_id)
      .filter((id): id is string => !!id)
  )

  async function onSubmit(data: ElementTemplateFormData): Promise<void> {
    if (isEditing) {
      const result = await updateMutation.mutateAsync({ id: template.id, data })
      if (!result.error) onClose()
    } else {
      const result = await createMutation.mutateAsync(data)
      if (!result.error) onClose()
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const hasLv = !!currentLvId

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">
          {isEditing ? 'Element bearbeiten' : 'Neues Element'}
        </h2>
        {isEditing && onDelete && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
            aria-label="Element löschen"
            disabled={isPending}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* LV-Auswahl */}
        <div className="space-y-1">
          <Label>Leistungsverzeichnis</Label>
          <Select
            value={currentLvId ?? '__none__'}
            onValueChange={handleLvChange}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="— kein LV —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— kein LV —</SelectItem>
              {lvGruppen.map((lv) => (
                <SelectItem key={lv.id} value={lv.id}>
                  {lv.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="panel-name">Name *</Label>
          <Input
            id="panel-name"
            {...register('name')}
            placeholder="z.B. Muffengrube"
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="panel-desc">Beschreibung</Label>
          <Input
            id="panel-desc"
            {...register('description')}
            placeholder="Optional"
          />
        </div>

        <div className="space-y-1">
          <Label>Standardmaße (optional)</Label>
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              step="0.01"
              placeholder="Länge (m)"
              {...register('laenge', { valueAsNumber: true })}
              aria-label="Standardlänge"
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Breite (m)"
              {...register('breite', { valueAsNumber: true })}
              aria-label="Standardbreite"
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Tiefe (m)"
              {...register('tiefe', { valueAsNumber: true })}
              aria-label="Standardtiefe"
            />
          </div>
        </div>

        {/* Positionen: LV-Modus vs. manuell */}
        {hasLv ? (
          <PositionenListe
            positionen={positionen}
            onChange={(p) => setValue('positionen', p, { shouldDirty: true })}
          />
        ) : (
          <PositionenEditor
            positionen={positionen}
            onChange={(p) => setValue('positionen', p, { shouldDirty: true })}
          />
        )}

        {errors.positionen && (
          <p className="text-sm text-destructive">
            Alle Positionen benötigen einen Namen
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Abbrechen
          </Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? 'Wird gespeichert…' : 'Speichern'}
          </Button>
        </div>
      </form>

      {/* Versteckte Daten-Bridge für das Parent-Panel */}
      <div
        data-lv-added-ids={JSON.stringify(Array.from(addedLvIds))}
        data-lv-add-callback="true"
        className="hidden"
        id="element-panel-bridge"
      />
    </div>
  )
}
```

Hinweis: Das `data-bridge`-Div ist ein Anti-Pattern. Besser: `addedLvIds`, `handleAddPosition` und `handleRemoveByLvId` werden per Props an das Panel weitergegeben. Die `app/desktop/elemente/page.tsx` muss diese Callbacks koordinieren.

Bessere Lösung: `ElementDetailPanel` gibt die nötigen Callbacks über einen `onPositionenChange`-Callback nach oben. Aber das verkompliziert den Parent zu stark.

**Sauberste Lösung:** `addedLvIds`, `onAdd`, `onRemove` werden direkt aus dem `ElementDetailPanel` nach oben geliftet via Callback-Props:

```typescript
// Ersetze den Bridge-Div durch zusätzliche Props:

interface ElementDetailPanelProps {
  template: ElementTemplate | null
  onClose: () => void
  onDelete?: () => void
  lvGruppen: LvGruppe[]
  lvPositionen: LvPositionOption[]
  onLvChange: (lvGruppeId: string | null) => void
  // NEU: Panel-externe Steuerung
  onAddLvPosition?: (pos: LvPositionOption) => void   // wird vom Parent gesetzt
  onRemoveLvPosition?: (id: string) => void            // wird vom Parent gesetzt
  addedLvIds?: Set<string>                             // wird vom Parent geleitet
}
```

Nein — das invertiert die Kontrolle unnötig. Die sauberste Lösung: Der Parent (`page.tsx`) kennt `addedLvIds` nicht direkt. Der `LvPositionenPanel` ruft `onAdd(pos)` auf, und `ElementDetailPanel` verarbeitet das intern.

**Finale Entscheidung:** `ElementDetailPanel` bekommt `ref`-basierte oder `externalAdd` Props nicht. Stattdessen werden `addedLvIds` + die beiden Callbacks als Props exposed (Parent hält sie nicht, `LvPositionenPanel` ruft sie direkt auf):

Der Parent (`page.tsx`) leitet `onAdd` und `onRemove` sowie `addedIds` vom `ElementDetailPanel`-State ab. Das geht sauber, wenn das Panel über `useImperativeHandle` oder einfachere Callback-Props kommuniziert.

**Einfachste saubere Lösung:**
- `ElementDetailPanel` bekommt `panelRef` als prop (optional)
- Oder: `page.tsx` hält `activePositionen` und `activeLvId` als State, gibt sie nach unten; Panel ist controlled.

Da das zu komplex wird: **Wir machen das Panel controlled für LV-Daten.** Positionen-State bleibt im Panel (React Hook Form). Aber `page.tsx` braucht `addedIds` nur um den `LvPositionenPanel` zu rendern. Also geben wir `addedIds` aus dem Panel raus per `onPositionenChange` Callback.

**FINALE ENTSCHEIDUNG für Task 8:**

`ElementDetailPanel` bekommt:
- `addedLvIds: Set<string>` — computed intern, nach außen geleitet via `onAddedIdsChange`
- `onAddPosition: (pos: LvPositionOption) => void` — vom Parent hereingereicht, wird im Panel aufgerufen
- `onRemovePosition: (id: string) => void` — vom Parent hereingereicht

Nein — das ist zu viel Prop-Drilling. **Endgültig**: Wir lassen `ElementDetailPanel` alle Position-State intern verwalten und rendern `LvPositionenPanel` **direkt im `ElementDetailPanel`** (als inline rechte Spalte).

Aber dann ist der Parent kein 3-Spalten-Layout mehr — das Panel ist 2-spaltig intern.

→ **Architektur-Entscheidung:** Der Desktop-`ElementDetailPanel` rendert intern ein 2-Spalten-Layout: links das Formular, rechts (wenn LV) den `LvPositionenPanel`. Der Parent bleibt 2-Spalten (Liste | Panel), das Panel selbst wird 2-spaltig wenn LV aktiv.

Das ist das sauberste Design. Umsetzung unten:

- [ ] **Step 1 (revidiert): Vollständiges `ElementDetailPanel` mit internem 2-Spalten-Layout**

```typescript
// components/elemente/ElementDetailPanel.tsx
'use client'

import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PositionenEditor, type LvPositionOption } from './PositionenEditor'
import { PositionenListe } from './PositionenListe'
import { LvPositionenPanel } from './LvPositionenPanel'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'
import {
  useCreateTemplate,
  useUpdateTemplate,
} from '@/hooks/use-element-templates'
import { useLvGruppen, useLvPositionen } from '@/hooks/use-lv'
import type { ElementTemplate, Einheit } from '@/types'

type ElementTemplateFormInput = z.input<typeof ElementTemplateFormSchema>

interface ElementDetailPanelProps {
  template: ElementTemplate | null
  onClose: () => void
  onDelete?: () => void
}

export function ElementDetailPanel({
  template,
  onClose,
  onDelete,
}: ElementDetailPanelProps): React.JSX.Element {
  const isEditing = !!template
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()
  const { data: lvGruppen = [] } = useLvGruppen()

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<ElementTemplateFormInput, unknown, ElementTemplateFormData>({
    resolver: zodResolver(ElementTemplateFormSchema),
    defaultValues: {
      name: '',
      description: null,
      laenge: null,
      breite: null,
      tiefe: null,
      lv_gruppe_id: null,
      positionen: [],
    },
  })

  const positionen = useWatch({ control, name: 'positionen' }) ?? []
  const currentLvId = (watch('lv_gruppe_id') as string | null | undefined) ?? null

  const { data: lvPositionen = [], isLoading: lvLoading } = useLvPositionen(currentLvId)

  const lvPositionOptions: LvPositionOption[] = lvPositionen.map((p) => ({
    id: p.id,
    kurztext: p.kurztext,
    einheit: p.einheit,
  }))

  const addedLvIds = new Set(
    positionen
      .map((p) => p.lv_position_id)
      .filter((id): id is string => !!id)
  )

  useEffect(() => {
    if (template) {
      reset({
        name: template.name,
        description: template.description,
        laenge: template.laenge,
        breite: template.breite,
        tiefe: template.tiefe,
        lv_gruppe_id: template.lv_gruppe_id,
        positionen: template.positionen,
      })
    } else {
      reset({
        name: '',
        description: null,
        laenge: null,
        breite: null,
        tiefe: null,
        lv_gruppe_id: null,
        positionen: [],
      })
    }
  }, [template, reset])

  function handleLvChange(value: string): void {
    const newId = value === '__none__' ? null : value
    setValue('lv_gruppe_id', newId ?? undefined, { shouldDirty: true })
    const manual = positionen.filter((p) => !p.lv_position_id)
    setValue('positionen', manual, { shouldDirty: true })
  }

  function handleAddPosition(pos: LvPositionOption): void {
    if (positionen.some((p) => p.lv_position_id === pos.id)) return
    setValue(
      'positionen',
      [
        ...positionen,
        {
          id: crypto.randomUUID(),
          name: pos.kurztext,
          einheit: pos.einheit as Einheit,
          menge: null,
          lv_position_id: pos.id,
        },
      ],
      { shouldDirty: true }
    )
  }

  function handleRemoveByLvId(lvPositionId: string): void {
    setValue(
      'positionen',
      positionen.filter((p) => p.lv_position_id !== lvPositionId),
      { shouldDirty: true }
    )
  }

  async function onSubmit(data: ElementTemplateFormData): Promise<void> {
    if (isEditing) {
      const result = await updateMutation.mutateAsync({ id: template.id, data })
      if (!result.error) onClose()
    } else {
      const result = await createMutation.mutateAsync(data)
      if (!result.error) onClose()
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex h-full">
      {/* Linke Seite: Formular */}
      <div className="flex-1 overflow-y-auto p-6 min-w-0">
        <div className="max-w-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">
              {isEditing ? 'Element bearbeiten' : 'Neues Element'}
            </h2>
            {isEditing && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="text-destructive hover:text-destructive"
                aria-label="Element löschen"
                disabled={isPending}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1">
              <Label>Leistungsverzeichnis</Label>
              <Select
                value={currentLvId ?? '__none__'}
                onValueChange={handleLvChange}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="— kein LV —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— kein LV —</SelectItem>
                  {lvGruppen.map((lv) => (
                    <SelectItem key={lv.id} value={lv.id}>
                      {lv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentLvId && (
                <p className="text-xs text-muted-foreground">
                  Positionen rechts anklicken zum Hinzufügen
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="panel-name">Name *</Label>
              <Input
                id="panel-name"
                {...register('name')}
                placeholder="z.B. Muffengrube"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="panel-desc">Beschreibung</Label>
              <Input
                id="panel-desc"
                {...register('description')}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-1">
              <Label>Standardmaße (optional)</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Länge (m)"
                  {...register('laenge', { valueAsNumber: true })}
                  aria-label="Standardlänge"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Breite (m)"
                  {...register('breite', { valueAsNumber: true })}
                  aria-label="Standardbreite"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Tiefe (m)"
                  {...register('tiefe', { valueAsNumber: true })}
                  aria-label="Standardtiefe"
                />
              </div>
            </div>

            {currentLvId ? (
              <PositionenListe
                positionen={positionen}
                onChange={(p) => setValue('positionen', p, { shouldDirty: true })}
              />
            ) : (
              <PositionenEditor
                positionen={positionen}
                onChange={(p) => setValue('positionen', p, { shouldDirty: true })}
              />
            )}

            {errors.positionen && (
              <p className="text-sm text-destructive">
                Alle Positionen benötigen einen Namen
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Abbrechen
              </Button>
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? 'Wird gespeichert…' : 'Speichern'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Rechte Seite: LV-Positions-Browser (nur wenn LV aktiv) */}
      {currentLvId && (
        <div className="w-72 shrink-0 overflow-hidden flex flex-col">
          <LvPositionenPanel
            positionen={lvPositionOptions}
            addedIds={addedLvIds}
            onAdd={handleAddPosition}
            onRemove={handleRemoveByLvId}
            isLoading={lvLoading}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
pnpm tsc --noEmit
```
Expected: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add components/elemente/ElementDetailPanel.tsx
git commit -m "feat: redesign ElementDetailPanel with LV selector and positions browser"
```

---

## Task 9: `ElementFormSheet` redesign (Mobile)

**Files:**
- Modify: `components/elemente/ElementFormSheet.tsx`

LV-Selector hinzufügen. Bei gewähltem LV: `PositionenListe` + "Positionen auswählen" Button → öffnet `LvPositionenSheet`. Bei nicht gewähltem LV: `PositionenEditor` wie bisher.

- [ ] **Step 1: Vollständiges Rewrite**

```typescript
// components/elemente/ElementFormSheet.tsx
'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ListChecks } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PositionenEditor, type LvPositionOption } from './PositionenEditor'
import { PositionenListe } from './PositionenListe'
import { LvPositionenSheet } from './LvPositionenSheet'
import { z } from 'zod'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'
import { useCreateTemplate, useUpdateTemplate } from '@/hooks/use-element-templates'
import { useLvGruppen, useLvPositionen } from '@/hooks/use-lv'
import type { ElementTemplate, Einheit } from '@/types'

type ElementTemplateFormInput = z.input<typeof ElementTemplateFormSchema>

interface ElementFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editTemplate?: ElementTemplate | null
}

export function ElementFormSheet({
  open,
  onOpenChange,
  editTemplate,
}: ElementFormSheetProps): React.JSX.Element {
  const isEditing = !!editTemplate
  const [pickerOpen, setPickerOpen] = useState(false)
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()
  const { data: lvGruppen = [] } = useLvGruppen()

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<ElementTemplateFormInput, unknown, ElementTemplateFormData>({
    resolver: zodResolver(ElementTemplateFormSchema),
    defaultValues: {
      name: '',
      description: null,
      laenge: null,
      breite: null,
      tiefe: null,
      lv_gruppe_id: null,
      positionen: [],
    },
  })

  const positionen = useWatch({ control, name: 'positionen' }) ?? []
  const currentLvId = (watch('lv_gruppe_id') as string | null | undefined) ?? null

  const { data: lvPositionen = [], isLoading: lvLoading } = useLvPositionen(currentLvId)

  const lvPositionOptions: LvPositionOption[] = lvPositionen.map((p) => ({
    id: p.id,
    kurztext: p.kurztext,
    einheit: p.einheit,
  }))

  useEffect(() => {
    if (editTemplate) {
      reset({
        name: editTemplate.name,
        description: editTemplate.description,
        laenge: editTemplate.laenge,
        breite: editTemplate.breite,
        tiefe: editTemplate.tiefe,
        lv_gruppe_id: editTemplate.lv_gruppe_id,
        positionen: editTemplate.positionen,
      })
    } else {
      reset({
        name: '',
        description: null,
        laenge: null,
        breite: null,
        tiefe: null,
        lv_gruppe_id: null,
        positionen: [],
      })
    }
  }, [editTemplate, reset])

  function handleLvChange(value: string): void {
    const newId = value === '__none__' ? null : value
    setValue('lv_gruppe_id', newId ?? undefined, { shouldDirty: true })
    const manual = positionen.filter((p) => !p.lv_position_id)
    setValue('positionen', manual, { shouldDirty: true })
  }

  function handlePickerConfirm(selectedIds: string[]): void {
    const selectedSet = new Set(selectedIds)
    // Behalte manuelle Positionen + bereits vorhandene LV-Positionen die noch ausgewählt sind
    const kept = positionen.filter(
      (p) => !p.lv_position_id || selectedSet.has(p.lv_position_id)
    )
    // Neu hinzufügen: gewählte IDs die noch nicht drin sind
    const keptLvIds = new Set(kept.map((p) => p.lv_position_id).filter(Boolean))
    const toAdd = lvPositionOptions
      .filter((p) => selectedSet.has(p.id) && !keptLvIds.has(p.id))
      .map((p) => ({
        id: crypto.randomUUID(),
        name: p.kurztext,
        einheit: p.einheit as Einheit,
        menge: null,
        lv_position_id: p.id,
      }))
    setValue('positionen', [...kept, ...toAdd], { shouldDirty: true })
  }

  async function onSubmit(data: ElementTemplateFormData): Promise<void> {
    if (isEditing) {
      const result = await updateMutation.mutateAsync({ id: editTemplate.id, data })
      if (!result.error) onOpenChange(false)
    } else {
      const result = await createMutation.mutateAsync(data)
      if (!result.error) onOpenChange(false)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const addedLvIds = positionen
    .map((p) => p.lv_position_id)
    .filter((id): id is string => !!id)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[90vh] overflow-y-auto rounded-t-xl px-4 pb-8"
        >
          <SheetHeader className="mb-6">
            <SheetTitle>
              {isEditing ? 'Element bearbeiten' : 'Neues Element'}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* LV-Auswahl */}
            <div className="space-y-2">
              <Label>Leistungsverzeichnis</Label>
              <Select
                value={currentLvId ?? '__none__'}
                onValueChange={handleLvChange}
              >
                <SelectTrigger className="h-14">
                  <SelectValue placeholder="— kein LV —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— kein LV —</SelectItem>
                  {lvGruppen.map((lv) => (
                    <SelectItem key={lv.id} value={lv.id}>
                      {lv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sheet-name">Name *</Label>
              <Input
                id="sheet-name"
                {...register('name')}
                placeholder="z.B. Muffengrube"
                className="h-14 text-base"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sheet-desc">Beschreibung</Label>
              <Input
                id="sheet-desc"
                {...register('description')}
                placeholder="Optional"
                className="h-14 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label>Standardmaße (optional)</Label>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Länge (m)"
                  {...register('laenge', { valueAsNumber: true })}
                  className="h-14 text-base"
                  aria-label="Standardlänge in Metern"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Breite (m)"
                  {...register('breite', { valueAsNumber: true })}
                  className="h-14 text-base"
                  aria-label="Standardbreite in Metern"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Tiefe (m)"
                  {...register('tiefe', { valueAsNumber: true })}
                  className="h-14 text-base"
                  aria-label="Standardtiefe in Metern"
                />
              </div>
            </div>

            {/* Positionen */}
            {currentLvId ? (
              <div className="space-y-3">
                <PositionenListe
                  positionen={positionen}
                  onChange={(p) => setValue('positionen', p, { shouldDirty: true })}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                  className="w-full h-14 gap-2 text-base"
                  disabled={lvLoading}
                >
                  <ListChecks className="h-5 w-5" />
                  {lvLoading ? 'Lade Positionen…' : 'Positionen auswählen'}
                </Button>
              </div>
            ) : (
              <PositionenEditor
                positionen={positionen}
                onChange={(p) => setValue('positionen', p, { shouldDirty: true })}
              />
            )}

            {errors.positionen && (
              <p className="text-sm text-destructive">
                Alle Positionen benötigen einen Namen
              </p>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 h-14 text-base"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                className="flex-1 h-14 text-base"
                disabled={isPending}
              >
                {isPending ? 'Speichern...' : 'Speichern'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Positions-Picker als separates Sheet (überlagert das Formular-Sheet) */}
      <LvPositionenSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        positionen={lvPositionOptions}
        initialSelectedIds={addedLvIds}
        onConfirm={handlePickerConfirm}
        isLoading={lvLoading}
      />
    </>
  )
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
pnpm tsc --noEmit
```
Expected: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add components/elemente/ElementFormSheet.tsx
git commit -m "feat: redesign ElementFormSheet with LV selector and mobile position picker"
```

---

## Task 10: Desktop Page Update

**Files:**
- Modify: `app/desktop/elemente/page.tsx`

Da `ElementDetailPanel` jetzt `lvGruppen` und `lvPositionen` intern fetcht (über `useLvGruppen`/`useLvPositionen`), muss die Page diese nicht mehr bereitstellen. Die Page bleibt weitgehend gleich — nur die Props zu `ElementDetailPanel` werden bereinigt.

- [ ] **Step 1: Page anpassen (Props bereinigen)**

```typescript
// app/desktop/elemente/page.tsx
'use client'

import { useState } from 'react'
import { Plus, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ElementDetailPanel } from '@/components/elemente/ElementDetailPanel'
import {
  useElementTemplates,
  useDeleteTemplate,
} from '@/hooks/use-element-templates'
import type { ElementTemplate } from '@/types'
import { cn } from '@/lib/utils'

export default function DesktopElementePage(): React.JSX.Element {
  const [selected, setSelected] = useState<ElementTemplate | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const { data: templates, isLoading, isError, refetch } = useElementTemplates()
  const deleteMutation = useDeleteTemplate()

  function handleNew(): void {
    setSelected(null)
    setIsCreating(true)
  }

  function handleSelect(template: ElementTemplate): void {
    setSelected(template)
    setIsCreating(false)
  }

  function handlePanelClose(): void {
    setSelected(null)
    setIsCreating(false)
  }

  async function handleDelete(id: string): Promise<void> {
    try {
      const result = await deleteMutation.mutateAsync(id)
      if (!result.error) handlePanelClose()
    } catch {
      // onError in useDeleteTemplate handles rollback and toast
    }
  }

  const showPanel = isCreating || selected !== null

  return (
    <div className="flex h-full">
      {/* Linke Spalte: Element-Liste */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <h2 className="font-semibold">Elemente</h2>
          <Button size="sm" onClick={handleNew} className="gap-1">
            <Plus className="h-4 w-4" />
            Neu
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <DesktopListeSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center py-12">
              <p className="text-sm text-muted-foreground">
                Elemente konnten nicht geladen werden.
              </p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Erneut versuchen
              </Button>
            </div>
          ) : !templates?.length ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center py-12">
              <Layers className="h-8 w-8 text-accent" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                Noch keine Elemente — klicke auf &quot;Neu&quot;
              </p>
            </div>
          ) : (
            <ul>
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    onClick={() => handleSelect(template)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-border',
                      'hover:bg-secondary transition-colors duration-150',
                      selected?.id === template.id && 'bg-accent/10'
                    )}
                  >
                    <p className="font-medium text-sm truncate">
                      {template.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {template.positionen.length}{' '}
                      {template.positionen.length === 1
                        ? 'Position'
                        : 'Positionen'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Mittlere + Rechte Seite: Detail / Erstellen (Panel ist intern 2-spaltig wenn LV aktiv) */}
      <div className="flex-1 overflow-hidden flex">
        {showPanel ? (
          <ElementDetailPanel
            template={selected}
            onClose={handlePanelClose}
            onDelete={selected ? () => handleDelete(selected.id) : undefined}
          />
        ) : (
          <div className="flex items-center justify-center w-full text-muted-foreground text-sm">
            Wähle ein Element aus der Liste oder erstelle ein neues
          </div>
        )}
      </div>
    </div>
  )
}

function DesktopListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3].map((i) => (
        <li key={i} className="px-4 py-3 border-b border-border space-y-1">
          <div className="h-4 bg-muted rounded animate-pulse w-32" />
          <div className="h-3 bg-muted rounded animate-pulse w-20" />
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: TypeScript-Check**

```bash
pnpm tsc --noEmit
```
Expected: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add app/desktop/elemente/page.tsx
git commit -m "feat: update desktop elemente page for 2+1 column layout"
```

---

## Task 11: Mobile Page Update

**Files:**
- Modify: `app/mobile/elemente/page.tsx`

`ElementFormSheet` fetcht jetzt intern LV-Daten — die mobile Page muss nichts weiterreichen. Einzige Änderung: den `lvPositionen` Prop aus `ElementFormSheet` entfernen (er existiert nicht mehr als Prop).

- [ ] **Step 1: Mobile Page prüfen**

`app/mobile/elemente/page.tsx` Zeile 94–98 — `ElementFormSheet` wird aktuell ohne `lvPositionen` Prop aufgerufen. Da wir den Prop in Task 9 entfernt haben, passt das bereits. Keine Codeänderung nötig, nur TypeScript-Check.

- [ ] **Step 2: TypeScript-Check**

```bash
pnpm tsc --noEmit
```
Expected: 0 Fehler.

---

## Task 12: Final Build Check

- [ ] **Step 1: TypeScript**

```bash
pnpm tsc --noEmit
```
Expected: `Found 0 errors.`

- [ ] **Step 2: Lint**

```bash
pnpm lint
```
Expected: `✔ No ESLint warnings or errors`

- [ ] **Step 3: Build**

```bash
pnpm build
```
Expected: Grüner Build.

- [ ] **Step 4: Finaler Commit**

```bash
git add -A
git commit -m "feat: element LV-Verknüpfung, Positions-Browser Desktop + Mobile"
```

---

## Spec Coverage Check

| Anforderung | Task |
|-------------|------|
| Element einem LV zuordnen | Task 1, 2, 3 |
| Nur passende Elemente pro Baustelle sichtbar | DB-Spalte vorhanden; Filter-Logik in Baustellen-Kontext ist Folge-Feature |
| Desktop: LV-Positionen-Browser mit Suchleiste | Task 6 |
| Desktop: Klick auf Position → ins Element | Task 8 (`handleAddPosition`) |
| Desktop: bereits hinzugefügte Positionen markiert | Task 6 (Häkchen-State via `addedIds`) |
| Desktop: Menge optional pro Position | Task 5 (`PositionenListe`) |
| Mobile: Checkbox-basierter Positions-Picker | Task 7 |
| Mobile: Suchleiste im Picker | Task 7 |
| Mobile: Bestätigung per Button | Task 7 |
| Mobile: Menge optional pro Position | Task 5 |
| Rückwärtskompatibilität (kein LV = alter Editor) | Task 8, 9 |

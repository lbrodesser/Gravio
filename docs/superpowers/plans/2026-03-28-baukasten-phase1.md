# Baukasten Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nutzer können eigene Element-Vorlagen (Baukasten) erstellen, bearbeiten und löschen — mit optionalen Standardmaßen und Aufmaßpositionen.

**Architecture:** Supabase-Tabelle `element_templates` mit RLS → Server Actions für Mutationen → TanStack Query Hooks für Datenabruf → Shared Components → Mobile (Bottom Sheet) + Desktop (Split Panel) UI.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Zod v4, React Hook Form, TanStack Query v5, Supabase SSR, shadcn/ui, Tailwind CSS v4, pnpm

---

## File Map

| Aktion | Pfad | Zweck |
|---|---|---|
| Create | `supabase/migrations/20260328000000_create_element_templates.sql` | DB-Schema + RLS |
| Modify | `types/index.ts` | Einheit, Position, ElementTemplate hinzufügen |
| Create | `lib/validations/element-template.ts` | Zod-Schemas für Forms + Server Actions |
| Create | `actions/element-templates.ts` | Server Actions: create, update, delete |
| Create | `hooks/use-element-templates.ts` | TanStack Query: fetch + mutations |
| Create | `components/elemente/PositionenEditor.tsx` | Shared: Positionen-Liste bearbeiten |
| Create | `components/elemente/ElementFormSheet.tsx` | Mobile: Bottom Sheet create/edit |
| Create | `components/elemente/ElementDetailPanel.tsx` | Desktop: Detailpanel create/edit |
| Create | `app/mobile/elemente/page.tsx` | Mobile Listenseite |
| Create | `app/mobile/elemente/loading.tsx` | Mobile Skeleton |
| Create | `app/desktop/elemente/page.tsx` | Desktop Split-Panel-Seite |
| Create | `app/desktop/elemente/loading.tsx` | Desktop Skeleton |

**Keine Änderungen nötig:**
- `components/layout/mobile-nav.tsx` — Link `/mobile/elemente` bereits vorhanden
- `components/layout/desktop-sidebar.tsx` — Link `/desktop/elemente` bereits vorhanden

---

## Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260328000000_create_element_templates.sql`

- [ ] **Schritt 1: Migrations-Verzeichnis und SQL-Datei erstellen**

```sql
-- supabase/migrations/20260328000000_create_element_templates.sql

create table public.element_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  description text,
  laenge numeric(10,2),
  breite numeric(10,2),
  tiefe numeric(10,2),
  positionen jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade
);

alter table public.element_templates enable row level security;

create policy "Authentifizierte Nutzer koennen alle Templates lesen"
  on public.element_templates for select
  to authenticated
  using (auth.uid() is not null);

create policy "Nutzer koennen eigene Templates erstellen"
  on public.element_templates for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Nutzer koennen nur eigene Templates bearbeiten"
  on public.element_templates for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "Nutzer koennen nur eigene Templates loeschen"
  on public.element_templates for delete
  to authenticated
  using (auth.uid() = created_by);
```

- [ ] **Schritt 2: Migration über Supabase MCP anwenden**

Verwende das MCP-Tool `mcp__claude_ai_Supabase__apply_migration` mit:
- `project_id`: `glkamrvfsmolqfgampmx`
- `name`: `create_element_templates`
- `query`: den SQL-Inhalt aus Schritt 1

- [ ] **Schritt 3: Tabelle verifizieren**

Führe über `mcp__claude_ai_Supabase__execute_sql` aus:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'element_templates'
order by ordinal_position;
```
Erwartetes Ergebnis: 9 Spalten (id, created_at, name, description, laenge, breite, tiefe, positionen, created_by)

- [ ] **Schritt 4: RLS verifizieren**

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename = 'element_templates';
```
Erwartetes Ergebnis: `rowsecurity = true`

- [ ] **Schritt 5: Commit**

```bash
git add supabase/migrations/20260328000000_create_element_templates.sql
git commit -m "feat: add element_templates migration with RLS"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Schritt 1: Neue Types ans Ende von `types/index.ts` anhängen**

Bestehende Typen (Projekt, Skizze, Aufmass, NutzerRolle, Nutzer) NICHT anfassen. Folgendes hinzufügen:

```ts
// --- Baukasten ---

export type Einheit = 'm³' | 'm²' | 'm' | 'Stk' | 't'

export interface Position {
  id: string
  name: string
  einheit: Einheit
  menge: number | null
}

export interface ElementTemplate {
  id: string
  created_at: string
  name: string
  description: string | null
  laenge: number | null
  breite: number | null
  tiefe: number | null
  positionen: Position[]
  created_by: string
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartetes Ergebnis: 0 Fehler

- [ ] **Schritt 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add ElementTemplate, Position, Einheit types"
```

---

## Task 3: Zod Validation Schema

**Files:**
- Create: `lib/validations/element-template.ts`

- [ ] **Schritt 1: Datei erstellen**

```ts
// lib/validations/element-template.ts
import { z } from 'zod'

export const EinheitSchema = z.enum(['m³', 'm²', 'm', 'Stk', 't'])

export const PositionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name ist erforderlich'),
  einheit: EinheitSchema,
  menge: z.number().nullable(),
})

// Hilfsfunktion: leere Strings und NaN → null für numerische Felder
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
  positionen: z.array(PositionSchema).default([]),
})

export type ElementTemplateFormData = z.infer<typeof ElementTemplateFormSchema>
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartetes Ergebnis: 0 Fehler

- [ ] **Schritt 3: Commit**

```bash
git add lib/validations/element-template.ts
git commit -m "feat: add Zod schema for ElementTemplate form"
```

---

## Task 4: Server Actions

**Files:**
- Create: `actions/element-templates.ts`

- [ ] **Schritt 1: Datei erstellen**

```ts
// actions/element-templates.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'

export async function createElementTemplate(
  data: ElementTemplateFormData
): Promise<{ error: string | null }> {
  const parsed = ElementTemplateFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { error } = await supabase
    .from('element_templates')
    .insert({ ...parsed.data, created_by: user.id })

  if (error) return { error: error.message }

  revalidatePath('/mobile/elemente')
  revalidatePath('/desktop/elemente')
  return { error: null }
}

export async function updateElementTemplate(
  id: string,
  data: ElementTemplateFormData
): Promise<{ error: string | null }> {
  const parsed = ElementTemplateFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()

  const { error } = await supabase
    .from('element_templates')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/mobile/elemente')
  revalidatePath('/desktop/elemente')
  return { error: null }
}

export async function deleteElementTemplate(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient()

  const { error } = await supabase
    .from('element_templates')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/mobile/elemente')
  revalidatePath('/desktop/elemente')
  return { error: null }
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartetes Ergebnis: 0 Fehler

- [ ] **Schritt 3: Commit**

```bash
git add actions/element-templates.ts
git commit -m "feat: add Server Actions for element_templates CRUD"
```

---

## Task 5: TanStack Query Hooks

**Files:**
- Create: `hooks/use-element-templates.ts`

- [ ] **Schritt 1: Datei erstellen**

```ts
// hooks/use-element-templates.ts
'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import { toast } from 'sonner'
import { createBrowserClient } from '@/lib/supabase/client'
import {
  createElementTemplate,
  updateElementTemplate,
  deleteElementTemplate,
} from '@/actions/element-templates'
import type { ElementTemplate } from '@/types'
import type { ElementTemplateFormData } from '@/lib/validations/element-template'

const QUERY_KEY = ['element-templates'] as const

export function useElementTemplates(): UseQueryResult<ElementTemplate[], Error> {
  const supabase = createBrowserClient()

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<ElementTemplate[]> => {
      const { data, error } = await supabase
        .from('element_templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      return data as ElementTemplate[]
    },
  })
}

export function useCreateTemplate(): UseMutationResult<
  { error: string | null },
  Error,
  ElementTemplateFormData
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ElementTemplateFormData) => createElementTemplate(data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Element erstellt')
    },
  })
}

export function useUpdateTemplate(): UseMutationResult<
  { error: string | null },
  Error,
  { id: string; data: ElementTemplateFormData }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ElementTemplateFormData }) =>
      updateElementTemplate(id, data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Element gespeichert')
    },
  })
}

export function useDeleteTemplate(): UseMutationResult<
  { error: string | null },
  Error,
  string,
  { previous: ElementTemplate[] }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteElementTemplate(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous =
        queryClient.getQueryData<ElementTemplate[]>(QUERY_KEY) ?? []
      queryClient.setQueryData<ElementTemplate[]>(
        QUERY_KEY,
        previous.filter((t) => t.id !== id)
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous)
      }
      toast.error('Löschen fehlgeschlagen')
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Element gelöscht')
      }
    },
  })
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartetes Ergebnis: 0 Fehler

- [ ] **Schritt 3: Commit**

```bash
git add hooks/use-element-templates.ts
git commit -m "feat: add TanStack Query hooks for element_templates"
```

---

## Task 6: PositionenEditor Component (Shared)

**Files:**
- Create: `components/elemente/PositionenEditor.tsx`

- [ ] **Schritt 1: Verzeichnis + Datei erstellen**

```tsx
// components/elemente/PositionenEditor.tsx
'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Position, Einheit } from '@/types'

const EINHEITEN: Einheit[] = ['m³', 'm²', 'm', 'Stk', 't']

interface PositionenEditorProps {
  positionen: Position[]
  onChange: (positionen: Position[]) => void
}

export function PositionenEditor({
  positionen,
  onChange,
}: PositionenEditorProps): React.JSX.Element {
  function addPosition(): void {
    onChange([
      ...positionen,
      { id: crypto.randomUUID(), name: '', einheit: 'm³', menge: null },
    ])
  }

  function removePosition(id: string): void {
    onChange(positionen.filter((p) => p.id !== id))
  }

  function updatePosition(
    id: string,
    field: keyof Position,
    value: string | number | null
  ): void {
    onChange(
      positionen.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }

  return (
    <div className="space-y-3">
      <Label>Positionen</Label>

      {positionen.map((position, index) => (
        <div key={position.id} className="flex gap-2 items-center">
          <Input
            placeholder={`Position ${index + 1}`}
            value={position.name}
            onChange={(e) => updatePosition(position.id, 'name', e.target.value)}
            className="h-14 text-base flex-1"
            aria-label={`Name Position ${index + 1}`}
          />
          <select
            value={position.einheit}
            onChange={(e) =>
              updatePosition(position.id, 'einheit', e.target.value as Einheit)
            }
            className="h-14 px-3 rounded-md border border-input bg-background text-base shrink-0"
            aria-label={`Einheit Position ${index + 1}`}
          >
            {EINHEITEN.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <Input
            type="number"
            step="0.01"
            placeholder="Menge"
            value={position.menge ?? ''}
            onChange={(e) =>
              updatePosition(
                position.id,
                'menge',
                e.target.value ? Number(e.target.value) : null
              )
            }
            className="h-14 text-base w-24 shrink-0"
            aria-label={`Menge Position ${index + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removePosition(position.id)}
            className="h-14 w-14 shrink-0 text-destructive hover:text-destructive"
            aria-label={`Position ${index + 1} entfernen`}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addPosition}
        className="w-full h-14 gap-2 text-base"
      >
        <Plus className="h-5 w-5" />
        Position hinzufügen
      </Button>
    </div>
  )
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartetes Ergebnis: 0 Fehler

- [ ] **Schritt 3: Commit**

```bash
git add components/elemente/PositionenEditor.tsx
git commit -m "feat: add shared PositionenEditor component"
```

---

## Task 7: ElementFormSheet (Mobile Bottom Sheet)

**Files:**
- Create: `components/elemente/ElementFormSheet.tsx`

- [ ] **Schritt 1: Datei erstellen**

```tsx
// components/elemente/ElementFormSheet.tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PositionenEditor } from './PositionenEditor'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'
import { useCreateTemplate, useUpdateTemplate } from '@/hooks/use-element-templates'
import type { ElementTemplate } from '@/types'

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
  const createMutation = useCreateTemplate()
  const updateMutation = useUpdateTemplate()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ElementTemplateFormData>({
    resolver: zodResolver(ElementTemplateFormSchema),
    defaultValues: {
      name: '',
      description: null,
      laenge: null,
      breite: null,
      tiefe: null,
      positionen: [],
    },
  })

  const positionen = watch('positionen') ?? []

  useEffect(() => {
    if (editTemplate) {
      reset({
        name: editTemplate.name,
        description: editTemplate.description,
        laenge: editTemplate.laenge,
        breite: editTemplate.breite,
        tiefe: editTemplate.tiefe,
        positionen: editTemplate.positionen,
      })
    } else {
      reset({
        name: '',
        description: null,
        laenge: null,
        breite: null,
        tiefe: null,
        positionen: [],
      })
    }
  }, [editTemplate, reset])

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

  return (
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

          <PositionenEditor
            positionen={positionen}
            onChange={(p) => setValue('positionen', p)}
          />

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
  )
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartetes Ergebnis: 0 Fehler

- [ ] **Schritt 3: Commit**

```bash
git add components/elemente/ElementFormSheet.tsx
git commit -m "feat: add ElementFormSheet mobile bottom sheet"
```

---

## Task 8: Mobile Page

**Files:**
- Create: `app/mobile/elemente/page.tsx`
- Create: `app/mobile/elemente/loading.tsx`

- [ ] **Schritt 1: loading.tsx erstellen**

```tsx
// app/mobile/elemente/loading.tsx
export default function Loading(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 h-16 flex items-center justify-between">
        <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        <div className="h-10 w-10 bg-muted rounded-md animate-pulse" />
      </header>
      <ul>
        {[1, 2, 3, 4].map((i) => (
          <li
            key={i}
            className="flex items-center px-4 min-h-[72px] border-b border-border gap-3"
          >
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse w-40" />
              <div className="h-3 bg-muted rounded animate-pulse w-24" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Schritt 2: page.tsx erstellen**

```tsx
// app/mobile/elemente/page.tsx
'use client'

import { useState } from 'react'
import { Plus, Layers, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ElementFormSheet } from '@/components/elemente/ElementFormSheet'
import {
  useElementTemplates,
  useDeleteTemplate,
} from '@/hooks/use-element-templates'
import type { ElementTemplate } from '@/types'

export default function MobileElementePage(): React.JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<ElementTemplate | null>(null)
  const { data: templates, isLoading } = useElementTemplates()
  const deleteMutation = useDeleteTemplate()

  function handleEdit(template: ElementTemplate): void {
    setEditTemplate(template)
    setSheetOpen(true)
  }

  function handleNew(): void {
    setEditTemplate(null)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 h-16 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold">Elemente</h1>
        <Button size="icon" onClick={handleNew} className="h-10 w-10">
          <Plus className="h-5 w-5" />
          <span className="sr-only">Neues Element</span>
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {isLoading ? (
          <ElementeListeSkeleton />
        ) : !templates?.length ? (
          <ElementeEmptyState onCreateClick={handleNew} />
        ) : (
          <ul>
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex items-center px-4 min-h-[72px] border-b border-border gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-base truncate">
                    {template.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {template.positionen.length}{' '}
                    {template.positionen.length === 1
                      ? 'Position'
                      : 'Positionen'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 shrink-0"
                  onClick={() => handleEdit(template)}
                  aria-label={`${template.name} bearbeiten`}
                >
                  <Pencil className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(template.id)}
                  aria-label={`${template.name} löschen`}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <ElementFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editTemplate={editTemplate}
      />
    </div>
  )
}

function ElementeListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3].map((i) => (
        <li
          key={i}
          className="flex items-center px-4 min-h-[72px] border-b border-border gap-3"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-40" />
            <div className="h-3 bg-muted rounded animate-pulse w-24" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ElementeEmptyState({
  onCreateClick,
}: {
  onCreateClick: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <Layers className="h-12 w-12 text-accent" strokeWidth={1.5} />
      <div>
        <p className="font-semibold text-lg">
          Noch keine Elemente definiert
        </p>
        <p className="text-muted-foreground text-sm mt-1">
          Definiere dein erstes Element — z.B. eine Muffengrube
        </p>
      </div>
      <Button onClick={onCreateClick} className="h-14 px-8 text-base">
        Element erstellen
      </Button>
    </div>
  )
}
```

- [ ] **Schritt 3: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartetes Ergebnis: 0 Fehler

- [ ] **Schritt 4: Manuell im Browser testen**

1. `http://localhost:3001/dev` → Als Admin einloggen
2. Auf "Elemente" in der Bottom-Nav tippen
3. Erwartetes Ergebnis: Leerer State mit "Noch keine Elemente definiert" + Button
4. "+" tippen → Bottom Sheet öffnet sich
5. Name eingeben → "Speichern" → Element erscheint in der Liste
6. Element antippen → Sheet öffnet sich mit vorausgefüllten Daten
7. Löschen-Button → Element verschwindet aus der Liste

- [ ] **Schritt 5: Commit**

```bash
git add app/mobile/elemente/
git commit -m "feat: add mobile Elemente page with list, empty state, create/edit/delete"
```

---

## Task 9: ElementDetailPanel (Desktop)

**Files:**
- Create: `components/elemente/ElementDetailPanel.tsx`

- [ ] **Schritt 1: Datei erstellen**

```tsx
// components/elemente/ElementDetailPanel.tsx
'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PositionenEditor } from './PositionenEditor'
import {
  ElementTemplateFormSchema,
  type ElementTemplateFormData,
} from '@/lib/validations/element-template'
import {
  useCreateTemplate,
  useUpdateTemplate,
} from '@/hooks/use-element-templates'
import type { ElementTemplate } from '@/types'

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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ElementTemplateFormData>({
    resolver: zodResolver(ElementTemplateFormSchema),
    defaultValues: {
      name: template?.name ?? '',
      description: template?.description ?? null,
      laenge: template?.laenge ?? null,
      breite: template?.breite ?? null,
      tiefe: template?.tiefe ?? null,
      positionen: template?.positionen ?? [],
    },
  })

  const positionen = watch('positionen') ?? []

  useEffect(() => {
    reset({
      name: template?.name ?? '',
      description: template?.description ?? null,
      laenge: template?.laenge ?? null,
      breite: template?.breite ?? null,
      tiefe: template?.tiefe ?? null,
      positionen: template?.positionen ?? [],
    })
  }, [template, reset])

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
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

        <PositionenEditor
          positionen={positionen}
          onChange={(p) => setValue('positionen', p)}
        />

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
            {isPending ? 'Speichern...' : 'Speichern'}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Schritt 2: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartetes Ergebnis: 0 Fehler

- [ ] **Schritt 3: Commit**

```bash
git add components/elemente/ElementDetailPanel.tsx
git commit -m "feat: add ElementDetailPanel desktop component"
```

---

## Task 10: Desktop Page

**Files:**
- Create: `app/desktop/elemente/page.tsx`
- Create: `app/desktop/elemente/loading.tsx`

- [ ] **Schritt 1: loading.tsx erstellen**

```tsx
// app/desktop/elemente/loading.tsx
export default function Loading(): React.JSX.Element {
  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-border">
          <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
        </div>
        <ul>
          {[1, 2, 3].map((i) => (
            <li key={i} className="px-4 py-3 border-b border-border space-y-1">
              <div className="h-4 bg-muted rounded animate-pulse w-32" />
              <div className="h-3 bg-muted rounded animate-pulse w-20" />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex-1" />
    </div>
  )
}
```

- [ ] **Schritt 2: page.tsx erstellen**

```tsx
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
  const { data: templates, isLoading } = useElementTemplates()
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

  function handleDelete(id: string): void {
    deleteMutation.mutate(id)
    handlePanelClose()
  }

  const showPanel = isCreating || selected !== null

  return (
    <div className="flex h-full">
      {/* Linke Spalte: Liste */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
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

      {/* Rechte Seite: Detail / Erstellen */}
      <div className="flex-1 overflow-y-auto">
        {showPanel ? (
          <ElementDetailPanel
            template={selected}
            onClose={handlePanelClose}
            onDelete={selected ? () => handleDelete(selected.id) : undefined}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
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

- [ ] **Schritt 3: TypeScript prüfen**

```bash
pnpm tsc --noEmit
```
Erwartetes Ergebnis: 0 Fehler

- [ ] **Schritt 4: Manuell im Browser testen**

1. Browser auf Desktop-Breite (>1024px) → `http://localhost:3001`
2. In der Sidebar auf "Elemente" klicken
3. Erwartetes Ergebnis: Zwei-Spalten-Layout, linke Spalte mit "Elemente" + "Neu"-Button
4. "Neu" klicken → Rechtes Panel öffnet sich mit leerem Formular
5. Element speichern → erscheint in der linken Liste
6. Element in der Liste anklicken → Panel zeigt Daten, bearbeiten möglich
7. Löschen-Icon → Element verschwindet aus der Liste

- [ ] **Schritt 5: Commit**

```bash
git add app/desktop/elemente/
git commit -m "feat: add desktop Elemente page with split panel"
```

---

## Task 11: Finale Verifikation

- [ ] **Schritt 1: TypeScript vollständig prüfen**

```bash
pnpm tsc --noEmit
```
Erwartetes Ergebnis: 0 Fehler

- [ ] **Schritt 2: Lint prüfen**

```bash
pnpm lint
```
Erwartetes Ergebnis: 0 Warnungen, 0 Fehler

- [ ] **Schritt 3: Build prüfen**

```bash
pnpm build
```
Erwartetes Ergebnis: Erfolgreich, keine Fehler

- [ ] **Schritt 4: End-to-End manueller Test**

Testen als Admin-User (`http://localhost:3001/dev`):

**Mobile:**
1. `/mobile/elemente` → Empty State sichtbar
2. "+" → Sheet öffnet sich
3. Name + 2 Positionen eingeben → Speichern
4. Element erscheint in Liste mit korrekter Positionsanzahl
5. Element antippen → Sheet mit Daten
6. Name ändern → Speichern → aktualisiert
7. Löschen → weg

**Desktop:**
1. `/desktop/elemente` → Split-Panel sichtbar
2. "Neu" → Panel öffnet sich
3. Element mit Standardmaßen erstellen → erscheint in Liste
4. Element auswählen → Daten im Panel
5. Bearbeiten + Speichern
6. Löschen-Icon → weg

- [ ] **Schritt 5: Dark Mode prüfen**

Browser DevTools → System-Einstellung auf "dark" wechseln. Alle Seiten auf Lesbarkeit prüfen.

- [ ] **Schritt 6: Final Commit**

```bash
git add .
git commit -m "feat: complete Baukasten Phase 1 — element_templates CRUD"
```

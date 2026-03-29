# Aufmaß Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vorarbeiter können Baustellen anlegen und pro Baustelle Aufmaße erfassen — indem sie ein Element aus dem Baukasten wählen und die Istwerte der Positionen eintragen.

**Architecture:** Supabase-Tabellen `baustellen` + `aufmasse` mit RLS → Server Actions → TanStack Query Hooks → `AufmassWerteEditor` (shared) + Sheet-Komponenten (mobile & desktop) → Mobile: 2-Level-Navigation (Baustellen → Aufmaße) → Desktop: Split-Panel mit Sheets.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Zod v4, React Hook Form, TanStack Query v5, Supabase SSR, shadcn/ui (Sheet, Select, Input, Label, Button), Tailwind CSS v4, pnpm

---

## File Map

| Aktion   | Pfad                                                         | Zweck                                        |
|----------|--------------------------------------------------------------|----------------------------------------------|
| Create   | `supabase/migrations/20260328100000_create_baustellen_aufmasse.sql` | DB-Schema + RLS für beide Tabellen    |
| Modify   | `types/index.ts`                                             | Baustelle, AufmassPositionWert, Aufmass (neu) |
| Create   | `lib/validations/baustelle.ts`                               | Zod-Schema für Baustelle-Formular            |
| Create   | `lib/validations/aufmass.ts`                                 | Zod-Schema für Aufmaß-Formular               |
| Create   | `actions/baustellen.ts`                                      | Server Actions: create, update, delete        |
| Create   | `actions/aufmasse.ts`                                        | Server Actions: create, delete               |
| Create   | `hooks/use-baustellen.ts`                                    | TanStack Query: Baustellen CRUD              |
| Create   | `hooks/use-aufmasse.ts`                                      | TanStack Query: Aufmaße fetch + mutate       |
| Create   | `components/aufmasse/AufmassWerteEditor.tsx`                 | Shared: Positionswerte-Eingabe               |
| Create   | `components/aufmasse/BaustelleFormSheet.tsx`                 | Sheet: Baustelle erstellen/bearbeiten        |
| Create   | `components/aufmasse/AufmassFormSheet.tsx`                   | Sheet: Aufmaß erfassen (Template → Werte)    |
| Create   | `app/mobile/aufmasse/page.tsx`                               | Mobile: Baustellen-Liste                     |
| Create   | `app/mobile/aufmasse/[id]/page.tsx`                          | Mobile: Aufmaße einer Baustelle              |
| Create   | `app/desktop/aufmasse/page.tsx`                              | Desktop: Split-Panel Baustellen + Aufmaße    |

---

## Task 1: Supabase Migration — baustellen + aufmasse

**Files:**
- Create: `supabase/migrations/20260328100000_create_baustellen_aufmasse.sql`

- [ ] **Schritt 1: Migration erstellen**

```sql
-- supabase/migrations/20260328100000_create_baustellen_aufmasse.sql

-- ─── baustellen ───────────────────────────────────────────────────────────────

CREATE TABLE baustellen (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  adresse    TEXT        CHECK (adresse IS NULL OR char_length(adresse) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE baustellen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer sehen eigene Baustellen"
  ON baustellen FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Nutzer erstellen eigene Baustellen"
  ON baustellen FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Nutzer aktualisieren eigene Baustellen"
  ON baustellen FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Nutzer löschen eigene Baustellen"
  ON baustellen FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER baustellen_updated_at
  BEFORE UPDATE ON baustellen
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── aufmasse ─────────────────────────────────────────────────────────────────

CREATE TABLE aufmasse (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  baustelle_id        UUID        REFERENCES baustellen(id) ON DELETE CASCADE NOT NULL,
  element_template_id UUID        REFERENCES element_templates(id) ON DELETE SET NULL,
  element_name        TEXT        NOT NULL CHECK (char_length(element_name) BETWEEN 1 AND 100),
  positionen_werte    JSONB       NOT NULL DEFAULT '[]',
  notiz               TEXT        CHECK (notiz IS NULL OR char_length(notiz) <= 500),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE aufmasse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer sehen eigene Aufmaße"
  ON aufmasse FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Nutzer erstellen eigene Aufmaße"
  ON aufmasse FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Nutzer löschen eigene Aufmaße"
  ON aufmasse FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **Schritt 2: Migration anwenden**

```bash
npx supabase db push
```

Erwartete Ausgabe: Beide Tabellen angelegt, keine Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add supabase/migrations/20260328100000_create_baustellen_aufmasse.sql
git commit -m "feat: add baustellen + aufmasse tables with RLS"
```

---

## Task 2: TypeScript Types

**Files:**
- Modify: `types/index.ts`

- [ ] **Schritt 1: types/index.ts aktualisieren**

Die bestehende Placeholder-`Aufmass`-Schnittstelle ersetzen und `Baustelle` + `AufmassPositionWert` hinzufügen. Komplette neue Datei:

```typescript
export interface Projekt {
  id: string
  name: string
  beschreibung: string | null
  erstellt_am: string
  aktualisiert_am: string
  nutzer_id: string
}

export interface Skizze {
  id: string
  projekt_id: string
  name: string
  daten: Record<string, unknown>
  erstellt_am: string
  aktualisiert_am: string
}

export type NutzerRolle = 'admin' | 'vorarbeiter' | 'bauleiter'

export interface Nutzer {
  id: string
  email: string
  rolle: NutzerRolle
  anzeigename: string | null
  erstellt_am: string
}

// ─── Baukasten ────────────────────────────────────────────────────────────────

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

// ─── Baustellen & Aufmaße ─────────────────────────────────────────────────────

export interface Baustelle {
  id: string
  user_id: string
  name: string
  adresse: string | null
  created_at: string
  updated_at: string
}

export interface AufmassPositionWert {
  name: string
  einheit: Einheit
  wert: number | null
}

export interface Aufmass {
  id: string
  user_id: string
  baustelle_id: string
  element_template_id: string | null
  element_name: string
  positionen_werte: AufmassPositionWert[]
  notiz: string | null
  created_at: string
}
```

- [ ] **Schritt 2: Typ-Check**

```bash
pnpm tsc --noEmit
```

Erwartete Ausgabe: 0 Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Baustelle, AufmassPositionWert, Aufmass types"
```

---

## Task 3: Zod Validation Schemas

**Files:**
- Create: `lib/validations/baustelle.ts`
- Create: `lib/validations/aufmass.ts`

- [ ] **Schritt 1: lib/validations/baustelle.ts erstellen**

```typescript
// lib/validations/baustelle.ts
import { z } from 'zod'

export const BaustelleFormSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  adresse: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(200).nullable().optional()
  ),
})

export type BaustelleFormData = z.infer<typeof BaustelleFormSchema>
```

- [ ] **Schritt 2: lib/validations/aufmass.ts erstellen**

```typescript
// lib/validations/aufmass.ts
import { z } from 'zod'
import { EinheitSchema } from './element-template'

export const AufmassPositionWertSchema = z.object({
  name: z.string().min(1),
  einheit: EinheitSchema,
  wert: z.preprocess(
    (v) =>
      v === '' || v === undefined || v === null || (typeof v === 'number' && isNaN(v))
        ? null
        : Number(v),
    z.number().nullable()
  ),
})

export const AufmassFormSchema = z.object({
  element_template_id: z.string().uuid('Bitte Element auswählen'),
  element_name: z.string().min(1),
  positionen_werte: z.array(AufmassPositionWertSchema),
  notiz: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().max(500).nullable().optional()
  ),
})

export type AufmassFormData = z.infer<typeof AufmassFormSchema>
```

- [ ] **Schritt 3: Typ-Check**

```bash
pnpm tsc --noEmit
```

Erwartete Ausgabe: 0 Fehler.

- [ ] **Schritt 4: Commit**

```bash
git add lib/validations/baustelle.ts lib/validations/aufmass.ts
git commit -m "feat: add Zod schemas for Baustelle and Aufmaß forms"
```

---

## Task 4: Server Actions — Baustellen

**Files:**
- Create: `actions/baustellen.ts`

- [ ] **Schritt 1: actions/baustellen.ts erstellen**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import {
  BaustelleFormSchema,
  type BaustelleFormData,
} from '@/lib/validations/baustelle'

export async function createBaustelle(
  data: BaustelleFormData
): Promise<{ error: string | null }> {
  const parsed = BaustelleFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { error } = await supabase
    .from('baustellen')
    .insert({ ...parsed.data, user_id: user.id })

  if (error) return { error: error.message }

  revalidatePath('/mobile/aufmasse')
  revalidatePath('/desktop/aufmasse')
  return { error: null }
}

export async function updateBaustelle(
  id: string,
  data: BaustelleFormData
): Promise<{ error: string | null }> {
  const idParsed = z.string().uuid().safeParse(id)
  if (!idParsed.success) return { error: 'Ungültige ID' }

  const parsed = BaustelleFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' }
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Nicht angemeldet' }

  const { data: rows, error } = await supabase
    .from('baustellen')
    .update(parsed.data)
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length) return { error: 'Baustelle nicht gefunden oder keine Berechtigung' }

  revalidatePath('/mobile/aufmasse')
  revalidatePath('/desktop/aufmasse')
  return { error: null }
}

export async function deleteBaustelle(
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
    .from('baustellen')
    .delete()
    .eq('id', idParsed.data)
    .select('id')

  if (error) return { error: error.message }
  if (!rows?.length) return { error: 'Baustelle nicht gefunden oder keine Berechtigung' }

  revalidatePath('/mobile/aufmasse')
  revalidatePath('/desktop/aufmasse')
  return { error: null }
}
```

- [ ] **Schritt 2: Typ-Check**

```bash
pnpm tsc --noEmit
```

Erwartete Ausgabe: 0 Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add actions/baustellen.ts
git commit -m "feat: add Baustellen server actions (create, update, delete)"
```

---

## Task 5: Server Actions — Aufmaße

**Files:**
- Create: `actions/aufmasse.ts`

- [ ] **Schritt 1: actions/aufmasse.ts erstellen**

```typescript
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
```

- [ ] **Schritt 2: Typ-Check**

```bash
pnpm tsc --noEmit
```

Erwartete Ausgabe: 0 Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add actions/aufmasse.ts
git commit -m "feat: add Aufmasse server actions (create, delete)"
```

---

## Task 6: TanStack Query Hooks

**Files:**
- Create: `hooks/use-baustellen.ts`
- Create: `hooks/use-aufmasse.ts`

- [ ] **Schritt 1: hooks/use-baustellen.ts erstellen**

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
import { createBrowserClient } from '@/lib/supabase/client'
import {
  createBaustelle,
  updateBaustelle,
  deleteBaustelle,
} from '@/actions/baustellen'
import type { Baustelle } from '@/types'
import type { BaustelleFormData } from '@/lib/validations/baustelle'

const QUERY_KEY = ['baustellen'] as const

export function useBaustellen(): UseQueryResult<Baustelle[], Error> {
  const supabase = createBrowserClient()

  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<Baustelle[]> => {
      const { data, error } = await supabase
        .from('baustellen')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      return data as Baustelle[]
    },
  })
}

export function useCreateBaustelle(): UseMutationResult<
  { error: string | null },
  Error,
  BaustelleFormData
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BaustelleFormData) => createBaustelle(data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Baustelle erstellt')
    },
  })
}

export function useUpdateBaustelle(): UseMutationResult<
  { error: string | null },
  Error,
  { id: string; data: BaustelleFormData }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BaustelleFormData }) =>
      updateBaustelle(id, data),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast.success('Baustelle gespeichert')
    },
  })
}

export function useDeleteBaustelle(): UseMutationResult<
  { error: string | null },
  Error,
  string,
  { previous: Baustelle[] }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteBaustelle(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous =
        queryClient.getQueryData<Baustelle[]>(QUERY_KEY) ?? []
      queryClient.setQueryData<Baustelle[]>(
        QUERY_KEY,
        previous.filter((b) => b.id !== id)
      )
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous)
      }
      toast.error('Löschen fehlgeschlagen')
    },
    onSuccess: (result, _id, context) => {
      if (result.error) {
        if (context?.previous) {
          queryClient.setQueryData(QUERY_KEY, context.previous)
        }
        toast.error(result.error)
      } else {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY })
        toast.success('Baustelle gelöscht')
      }
    },
  })
}
```

- [ ] **Schritt 2: hooks/use-aufmasse.ts erstellen**

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
import { createBrowserClient } from '@/lib/supabase/client'
import { createAufmass, deleteAufmass } from '@/actions/aufmasse'
import type { Aufmass } from '@/types'
import type { AufmassFormData } from '@/lib/validations/aufmass'

const aufmasseQueryKey = (baustelleId: string) =>
  ['aufmasse', baustelleId] as const

export function useAufmasse(
  baustelleId: string
): UseQueryResult<Aufmass[], Error> {
  const supabase = createBrowserClient()

  return useQuery({
    queryKey: aufmasseQueryKey(baustelleId),
    queryFn: async (): Promise<Aufmass[]> => {
      const { data, error } = await supabase
        .from('aufmasse')
        .select('*')
        .eq('baustelle_id', baustelleId)
        .order('created_at', { ascending: false })

      if (error) throw new Error(error.message)
      return data as Aufmass[]
    },
    enabled: !!baustelleId,
  })
}

export function useCreateAufmass(): UseMutationResult<
  { error: string | null },
  Error,
  { baustelleId: string; data: AufmassFormData }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      baustelleId,
      data,
    }: {
      baustelleId: string
      data: AufmassFormData
    }) => createAufmass(baustelleId, data),
    onSuccess: (result, { baustelleId }) => {
      if (result.error) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({
        queryKey: aufmasseQueryKey(baustelleId),
      })
      toast.success('Aufmaß erfasst')
    },
  })
}

export function useDeleteAufmass(): UseMutationResult<
  { error: string | null },
  Error,
  { id: string; baustelleId: string },
  { previous: Aufmass[] }
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, baustelleId }: { id: string; baustelleId: string }) =>
      deleteAufmass(id, baustelleId),
    onMutate: async ({ id, baustelleId }) => {
      const key = aufmasseQueryKey(baustelleId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Aufmass[]>(key) ?? []
      queryClient.setQueryData<Aufmass[]>(
        key,
        previous.filter((a) => a.id !== id)
      )
      return { previous }
    },
    onError: (_err, { baustelleId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(aufmasseQueryKey(baustelleId), context.previous)
      }
      toast.error('Löschen fehlgeschlagen')
    },
    onSuccess: (result, { baustelleId }, context) => {
      if (result.error) {
        if (context?.previous) {
          queryClient.setQueryData(
            aufmasseQueryKey(baustelleId),
            context.previous
          )
        }
        toast.error(result.error)
      } else {
        queryClient.invalidateQueries({
          queryKey: aufmasseQueryKey(baustelleId),
        })
        toast.success('Aufmaß gelöscht')
      }
    },
  })
}
```

- [ ] **Schritt 3: Typ-Check**

```bash
pnpm tsc --noEmit
```

Erwartete Ausgabe: 0 Fehler.

- [ ] **Schritt 4: Commit**

```bash
git add hooks/use-baustellen.ts hooks/use-aufmasse.ts
git commit -m "feat: add TanStack Query hooks for Baustellen and Aufmasse"
```

---

## Task 7: AufmassWerteEditor Component

**Files:**
- Create: `components/aufmasse/AufmassWerteEditor.tsx`

Zeigt pro Position eine Zeile: Name (Label) + Einheit (Label) + Zahleneingabe.

- [ ] **Schritt 1: components/aufmasse/AufmassWerteEditor.tsx erstellen**

```typescript
'use client'

import { Input } from '@/components/ui/input'
import type { AufmassPositionWert } from '@/types'

interface AufmassWerteEditorProps {
  werte: AufmassPositionWert[]
  onChange: (werte: AufmassPositionWert[]) => void
}

export function AufmassWerteEditor({
  werte,
  onChange,
}: AufmassWerteEditorProps): React.JSX.Element {
  if (werte.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Dieses Element hat keine Positionen.
      </p>
    )
  }

  function handleWertChange(index: number, raw: string): void {
    const updated = werte.map((w, i) => {
      if (i !== index) return w
      const parsed = parseFloat(raw)
      return { ...w, wert: raw === '' || isNaN(parsed) ? null : parsed }
    })
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      {werte.map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="flex-1 text-sm font-medium truncate">{w.name}</span>
          <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
            {w.einheit}
          </span>
          <Input
            type="number"
            step="0.01"
            placeholder="0"
            value={w.wert ?? ''}
            onChange={(e) => handleWertChange(i, e.target.value)}
            className="w-28 h-12 text-base text-right shrink-0"
            aria-label={`${w.name} in ${w.einheit}`}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Schritt 2: Typ-Check**

```bash
pnpm tsc --noEmit
```

Erwartete Ausgabe: 0 Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add components/aufmasse/AufmassWerteEditor.tsx
git commit -m "feat: add AufmassWerteEditor shared component"
```

---

## Task 8: Form-Sheets — BaustelleFormSheet + AufmassFormSheet

**Files:**
- Create: `components/aufmasse/BaustelleFormSheet.tsx`
- Create: `components/aufmasse/AufmassFormSheet.tsx`

**Hinweis:** shadcn `Select` importiert aus `@/components/ui/select`. Falls die Datei noch nicht existiert, zuerst via shadcn CLI hinzufügen: `pnpm dlx shadcn@latest add select`.

- [ ] **Schritt 1: Select-Komponente prüfen / hinzufügen**

```bash
ls components/ui/select.tsx 2>/dev/null && echo "exists" || pnpm dlx shadcn@latest add select
```

- [ ] **Schritt 2: components/aufmasse/BaustelleFormSheet.tsx erstellen**

```typescript
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
import {
  BaustelleFormSchema,
  type BaustelleFormData,
} from '@/lib/validations/baustelle'
import {
  useCreateBaustelle,
  useUpdateBaustelle,
} from '@/hooks/use-baustellen'
import type { Baustelle } from '@/types'

interface BaustelleFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editBaustelle?: Baustelle | null
}

export function BaustelleFormSheet({
  open,
  onOpenChange,
  editBaustelle,
}: BaustelleFormSheetProps): React.JSX.Element {
  const isEditing = !!editBaustelle
  const createMutation = useCreateBaustelle()
  const updateMutation = useUpdateBaustelle()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BaustelleFormData>({
    resolver: zodResolver(BaustelleFormSchema),
    defaultValues: { name: '', adresse: null },
  })

  useEffect(() => {
    if (editBaustelle) {
      reset({ name: editBaustelle.name, adresse: editBaustelle.adresse })
    } else {
      reset({ name: '', adresse: null })
    }
  }, [editBaustelle, reset])

  async function onSubmit(data: BaustelleFormData): Promise<void> {
    if (isEditing) {
      const result = await updateMutation.mutateAsync({
        id: editBaustelle.id,
        data,
      })
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
        className="h-auto rounded-t-xl px-4 pb-8"
      >
        <SheetHeader className="mb-6">
          <SheetTitle>
            {isEditing ? 'Baustelle bearbeiten' : 'Neue Baustelle'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="baustelle-name">Name *</Label>
            <Input
              id="baustelle-name"
              {...register('name')}
              placeholder="z.B. Bahnhofstr. 12"
              className="h-14 text-base"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="baustelle-adresse">Adresse</Label>
            <Input
              id="baustelle-adresse"
              {...register('adresse')}
              placeholder="Optional"
              className="h-14 text-base"
            />
          </div>

          <div className="flex gap-3 pt-2">
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

- [ ] **Schritt 3: components/aufmasse/AufmassFormSheet.tsx erstellen**

Wenn ein Template ausgewählt wird, werden die `positionen_werte` automatisch aus dem Template befüllt.

```typescript
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AufmassWerteEditor } from './AufmassWerteEditor'
import {
  AufmassFormSchema,
  type AufmassFormData,
} from '@/lib/validations/aufmass'
import { useCreateAufmass } from '@/hooks/use-aufmasse'
import { useElementTemplates } from '@/hooks/use-element-templates'
import type { AufmassPositionWert } from '@/types'

interface AufmassFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  baustelleId: string
}

export function AufmassFormSheet({
  open,
  onOpenChange,
  baustelleId,
}: AufmassFormSheetProps): React.JSX.Element {
  const createMutation = useCreateAufmass()
  const { data: templates } = useElementTemplates()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AufmassFormData>({
    resolver: zodResolver(AufmassFormSchema),
    defaultValues: {
      element_template_id: '',
      element_name: '',
      positionen_werte: [],
      notiz: null,
    },
  })

  const selectedTemplateId = watch('element_template_id')
  const positionen_werte = watch('positionen_werte')

  // Wenn Template wechselt: Positionen befüllen
  useEffect(() => {
    if (!selectedTemplateId || !templates) return
    const template = templates.find((t) => t.id === selectedTemplateId)
    if (!template) return
    setValue('element_name', template.name, { shouldDirty: true })
    const werte: AufmassPositionWert[] = template.positionen.map((p) => ({
      name: p.name,
      einheit: p.einheit,
      wert: p.menge,
    }))
    setValue('positionen_werte', werte, { shouldDirty: true })
  }, [selectedTemplateId, templates, setValue])

  // Beim Schließen zurücksetzen
  useEffect(() => {
    if (!open) {
      reset({
        element_template_id: '',
        element_name: '',
        positionen_werte: [],
        notiz: null,
      })
    }
  }, [open, reset])

  async function onSubmit(data: AufmassFormData): Promise<void> {
    const result = await createMutation.mutateAsync({ baustelleId, data })
    if (!result.error) onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] overflow-y-auto rounded-t-xl px-4 pb-8"
      >
        <SheetHeader className="mb-6">
          <SheetTitle>Aufmaß erfassen</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label>Element *</Label>
            <Select
              value={selectedTemplateId}
              onValueChange={(v) =>
                setValue('element_template_id', v, { shouldDirty: true })
              }
            >
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Element auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.element_template_id && (
              <p className="text-sm text-destructive">
                {errors.element_template_id.message}
              </p>
            )}
          </div>

          {positionen_werte.length > 0 && (
            <div className="space-y-2">
              <Label>Maße</Label>
              <AufmassWerteEditor
                werte={positionen_werte}
                onChange={(w) =>
                  setValue('positionen_werte', w, { shouldDirty: true })
                }
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="aufmass-notiz">Notiz</Label>
            <Input
              id="aufmass-notiz"
              {...register('notiz')}
              placeholder="Optional"
              className="h-14 text-base"
            />
          </div>

          <div className="flex gap-3 pt-2">
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
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Speichern...' : 'Erfassen'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Schritt 4: Typ-Check**

```bash
pnpm tsc --noEmit
```

Erwartete Ausgabe: 0 Fehler.

- [ ] **Schritt 5: Commit**

```bash
git add components/aufmasse/BaustelleFormSheet.tsx components/aufmasse/AufmassFormSheet.tsx
git commit -m "feat: add BaustelleFormSheet and AufmassFormSheet components"
```

---

## Task 9: Mobile Pages — Baustellen-Liste + Aufmaße pro Baustelle

**Files:**
- Create: `app/mobile/aufmasse/page.tsx`
- Create: `app/mobile/aufmasse/[id]/page.tsx`

- [ ] **Schritt 1: app/mobile/aufmasse/page.tsx erstellen**

Baustellen-Liste. Tap → navigiert zu `/mobile/aufmasse/[id]`.

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, HardHat, Pencil, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BaustelleFormSheet } from '@/components/aufmasse/BaustelleFormSheet'
import {
  useBaustellen,
  useDeleteBaustelle,
} from '@/hooks/use-baustellen'
import type { Baustelle } from '@/types'

export default function MobileAufmassePage(): React.JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editBaustelle, setEditBaustelle] = useState<Baustelle | null>(null)
  const router = useRouter()
  const {
    data: baustellen,
    isLoading,
    isError,
    refetch,
  } = useBaustellen()
  const deleteMutation = useDeleteBaustelle()

  function handleNew(): void {
    setEditBaustelle(null)
    setSheetOpen(true)
  }

  function handleEdit(b: Baustelle): void {
    setEditBaustelle(b)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 h-16 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold">Aufmaße</h1>
        <Button size="icon" onClick={handleNew} className="h-14 w-14">
          <Plus className="h-5 w-5" />
          <span className="sr-only">Neue Baustelle</span>
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {isLoading ? (
          <BaustellenListeSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
            <p className="text-muted-foreground text-sm">
              Baustellen konnten nicht geladen werden.
            </p>
            <Button
              variant="outline"
              className="h-14"
              onClick={() => void refetch()}
            >
              Erneut versuchen
            </Button>
          </div>
        ) : !baustellen?.length ? (
          <BaustellenEmptyState onCreateClick={handleNew} />
        ) : (
          <ul>
            {baustellen.map((b) => (
              <li
                key={b.id}
                className="flex items-center px-4 min-h-[72px] border-b border-border gap-3"
              >
                <button
                  className="flex-1 min-w-0 text-left py-2"
                  onClick={() => router.push(`/mobile/aufmasse/${b.id}`)}
                >
                  <p className="font-medium text-base truncate">{b.name}</p>
                  {b.adresse && (
                    <p className="text-sm text-muted-foreground truncate">
                      {b.adresse}
                    </p>
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 shrink-0"
                  onClick={() => handleEdit(b)}
                  aria-label={`${b.name} bearbeiten`}
                >
                  <Pencil className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-14 w-14 shrink-0 text-muted-foreground"
                  onClick={() => router.push(`/mobile/aufmasse/${b.id}`)}
                  aria-label={`${b.name} öffnen`}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BaustelleFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editBaustelle={editBaustelle}
      />
    </div>
  )
}

function BaustellenListeSkeleton(): React.JSX.Element {
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

function BaustellenEmptyState({
  onCreateClick,
}: {
  onCreateClick: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <HardHat className="h-12 w-12 text-accent" strokeWidth={1.5} />
      <div>
        <p className="font-semibold text-lg">Noch keine Baustellen</p>
        <p className="text-muted-foreground text-sm mt-1">
          Leg deine erste Baustelle an
        </p>
      </div>
      <Button onClick={onCreateClick} className="h-14 px-8 text-base">
        Baustelle anlegen
      </Button>
    </div>
  )
}
```

- [ ] **Schritt 2: app/mobile/aufmasse/[id]/page.tsx erstellen**

Aufmaße einer einzelnen Baustelle. Zeigt Liste + "Aufmaß erfassen" Button.

```typescript
'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Plus, ArrowLeft, FileText, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AufmassFormSheet } from '@/components/aufmasse/AufmassFormSheet'
import { useBaustellen } from '@/hooks/use-baustellen'
import { useAufmasse, useDeleteAufmass } from '@/hooks/use-aufmasse'
import type { Aufmass } from '@/types'

export default function MobileAufmasseDetailPage(): React.JSX.Element {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data: baustellen } = useBaustellen()
  const baustelle = baustellen?.find((b) => b.id === id)

  const { data: aufmasse, isLoading, isError, refetch } = useAufmasse(id)
  const deleteMutation = useDeleteAufmass()

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 bg-background border-b border-border px-4 h-16 flex items-center gap-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-14 w-14 shrink-0"
          onClick={() => router.back()}
          aria-label="Zurück"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1 truncate">
          {baustelle?.name ?? 'Aufmaße'}
        </h1>
        <Button size="icon" onClick={() => setSheetOpen(true)} className="h-14 w-14">
          <Plus className="h-5 w-5" />
          <span className="sr-only">Aufmaß erfassen</span>
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {isLoading ? (
          <AufmasseListeSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
            <p className="text-muted-foreground text-sm">
              Aufmaße konnten nicht geladen werden.
            </p>
            <Button
              variant="outline"
              className="h-14"
              onClick={() => void refetch()}
            >
              Erneut versuchen
            </Button>
          </div>
        ) : !aufmasse?.length ? (
          <AufmasseEmptyState onCreateClick={() => setSheetOpen(true)} />
        ) : (
          <ul>
            {aufmasse.map((a) => (
              <AufmassListItem
                key={a.id}
                aufmass={a}
                onDelete={() =>
                  deleteMutation.mutate({ id: a.id, baustelleId: id })
                }
                isDeleting={
                  deleteMutation.isPending &&
                  deleteMutation.variables?.id === a.id
                }
              />
            ))}
          </ul>
        )}
      </main>

      <AufmassFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        baustelleId={id}
      />
    </div>
  )
}

function AufmassListItem({
  aufmass,
  onDelete,
  isDeleting,
}: {
  aufmass: Aufmass
  onDelete: () => void
  isDeleting: boolean
}): React.JSX.Element {
  const filledCount = aufmass.positionen_werte.filter(
    (w) => w.wert !== null
  ).length

  return (
    <li className="flex items-start px-4 py-4 border-b border-border gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-base">{aufmass.element_name}</p>
        <div className="mt-1 space-y-0.5">
          {aufmass.positionen_werte.map((w, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {w.name}:{' '}
              <span className="text-foreground">
                {w.wert !== null ? `${w.wert} ${w.einheit}` : '—'}
              </span>
            </p>
          ))}
        </div>
        {aufmass.notiz && (
          <p className="text-xs text-muted-foreground mt-1 italic">
            {aufmass.notiz}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {filledCount}/{aufmass.positionen_werte.length} Maße eingetragen
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-14 w-14 shrink-0 text-destructive hover:text-destructive"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={`${aufmass.element_name} löschen`}
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </li>
  )
}

function AufmasseListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3].map((i) => (
        <li key={i} className="px-4 py-4 border-b border-border space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-36" />
          <div className="h-3 bg-muted rounded animate-pulse w-48" />
          <div className="h-3 bg-muted rounded animate-pulse w-40" />
        </li>
      ))}
    </ul>
  )
}

function AufmasseEmptyState({
  onCreateClick,
}: {
  onCreateClick: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
      <FileText className="h-12 w-12 text-accent" strokeWidth={1.5} />
      <div>
        <p className="font-semibold text-lg">Noch keine Aufmaße</p>
        <p className="text-muted-foreground text-sm mt-1">
          Erfasse dein erstes Aufmaß für diese Baustelle
        </p>
      </div>
      <Button onClick={onCreateClick} className="h-14 px-8 text-base">
        Aufmaß erfassen
      </Button>
    </div>
  )
}
```

- [ ] **Schritt 3: Typ-Check**

```bash
pnpm tsc --noEmit
```

Erwartete Ausgabe: 0 Fehler.

- [ ] **Schritt 4: Build-Check**

```bash
pnpm build
```

Erwartete Ausgabe: Erfolgreicher Build, neue Routen `/mobile/aufmasse` und `/mobile/aufmasse/[id]` erscheinen in der Route-Übersicht.

- [ ] **Schritt 5: Commit**

```bash
git add app/mobile/aufmasse/page.tsx app/mobile/aufmasse/[id]/page.tsx
git commit -m "feat: add mobile Aufmasse pages (Baustellen list + detail)"
```

---

## Task 10: Desktop Page — Split-Panel Baustellen + Aufmaße

**Files:**
- Create: `app/desktop/aufmasse/page.tsx`

Split: Links Baustellen-Liste, rechts Aufmaße der ausgewählten Baustelle. Sheets für create.

- [ ] **Schritt 1: app/desktop/aufmasse/page.tsx erstellen**

```typescript
'use client'

import { useState } from 'react'
import { Plus, HardHat, FileText, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BaustelleFormSheet } from '@/components/aufmasse/BaustelleFormSheet'
import { AufmassFormSheet } from '@/components/aufmasse/AufmassFormSheet'
import {
  useBaustellen,
  useDeleteBaustelle,
} from '@/hooks/use-baustellen'
import { useAufmasse, useDeleteAufmass } from '@/hooks/use-aufmasse'
import type { Aufmass, Baustelle } from '@/types'
import { cn } from '@/lib/utils'

export default function DesktopAufmassePage(): React.JSX.Element {
  const [selectedBaustelle, setSelectedBaustelle] =
    useState<Baustelle | null>(null)
  const [baustelleSheetOpen, setBaustelleSheetOpen] = useState(false)
  const [editBaustelle, setEditBaustelle] = useState<Baustelle | null>(null)
  const [aufmassSheetOpen, setAufmassSheetOpen] = useState(false)

  const {
    data: baustellen,
    isLoading: baustellenLoading,
    isError: baustellenError,
    refetch: refetchBaustellen,
  } = useBaustellen()
  const deleteBaustelleMutation = useDeleteBaustelle()

  function handleNewBaustelle(): void {
    setEditBaustelle(null)
    setBaustelleSheetOpen(true)
  }

  function handleEditBaustelle(b: Baustelle): void {
    setEditBaustelle(b)
    setBaustelleSheetOpen(true)
  }

  async function handleDeleteBaustelle(b: Baustelle): Promise<void> {
    try {
      const result = await deleteBaustelleMutation.mutateAsync(b.id)
      if (!result.error && selectedBaustelle?.id === b.id) {
        setSelectedBaustelle(null)
      }
    } catch {
      // onError in useDeleteBaustelle handles rollback and toast
    }
  }

  return (
    <div className="flex h-full">
      {/* Linke Spalte: Baustellen */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <h2 className="font-semibold">Baustellen</h2>
          <Button size="sm" onClick={handleNewBaustelle} className="gap-1">
            <Plus className="h-4 w-4" />
            Neu
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {baustellenLoading ? (
            <DesktopListeSkeleton />
          ) : baustellenError ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Fehler beim Laden.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetchBaustellen()}
              >
                Erneut versuchen
              </Button>
            </div>
          ) : !baustellen?.length ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <HardHat className="h-8 w-8 text-accent" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                Noch keine Baustellen
              </p>
            </div>
          ) : (
            <ul>
              {baustellen.map((b) => (
                <li key={b.id}>
                  <div
                    className={cn(
                      'flex items-center border-b border-border group',
                      selectedBaustelle?.id === b.id && 'bg-accent/10'
                    )}
                  >
                    <button
                      onClick={() => setSelectedBaustelle(b)}
                      className="flex-1 min-w-0 text-left px-4 py-3 hover:bg-secondary transition-colors"
                    >
                      <p className="font-medium text-sm truncate">{b.name}</p>
                      {b.adresse && (
                        <p className="text-xs text-muted-foreground truncate">
                          {b.adresse}
                        </p>
                      )}
                    </button>
                    <div className="flex shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditBaustelle(b)}
                        aria-label={`${b.name} bearbeiten`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => void handleDeleteBaustelle(b)}
                        disabled={
                          deleteBaustelleMutation.isPending &&
                          deleteBaustelleMutation.variables === b.id
                        }
                        aria-label={`${b.name} löschen`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Rechte Seite: Aufmaße der gewählten Baustelle */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {selectedBaustelle ? (
          <AufmassePanel
            baustelle={selectedBaustelle}
            onErfassen={() => setAufmassSheetOpen(true)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Baustelle auswählen oder neue anlegen
          </div>
        )}
      </div>

      <BaustelleFormSheet
        open={baustelleSheetOpen}
        onOpenChange={setBaustelleSheetOpen}
        editBaustelle={editBaustelle}
      />
      {selectedBaustelle && (
        <AufmassFormSheet
          open={aufmassSheetOpen}
          onOpenChange={setAufmassSheetOpen}
          baustelleId={selectedBaustelle.id}
        />
      )}
    </div>
  )
}

function AufmassePanel({
  baustelle,
  onErfassen,
}: {
  baustelle: Baustelle
  onErfassen: () => void
}): React.JSX.Element {
  const { data: aufmasse, isLoading, isError, refetch } = useAufmasse(
    baustelle.id
  )
  const deleteAufmassMutation = useDeleteAufmass()

  return (
    <>
      <div className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
        <h2 className="font-semibold truncate">{baustelle.name}</h2>
        <Button size="sm" onClick={onErfassen} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" />
          Aufmaß erfassen
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <AufmasseRechtsSeiteListeSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aufmaße konnten nicht geladen werden.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
            >
              Erneut versuchen
            </Button>
          </div>
        ) : !aufmasse?.length ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center py-12">
            <FileText className="h-8 w-8 text-accent" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              Noch keine Aufmaße — klicke auf &quot;Aufmaß erfassen&quot;
            </p>
          </div>
        ) : (
          <ul>
            {aufmasse.map((a) => (
              <DesktopAufmassItem
                key={a.id}
                aufmass={a}
                onDelete={() =>
                  deleteAufmassMutation.mutate({
                    id: a.id,
                    baustelleId: baustelle.id,
                  })
                }
                isDeleting={
                  deleteAufmassMutation.isPending &&
                  deleteAufmassMutation.variables?.id === a.id
                }
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function DesktopAufmassItem({
  aufmass,
  onDelete,
  isDeleting,
}: {
  aufmass: Aufmass
  onDelete: () => void
  isDeleting: boolean
}): React.JSX.Element {
  return (
    <li className="flex items-start px-6 py-4 border-b border-border gap-4 group">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{aufmass.element_name}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
          {aufmass.positionen_werte.map((w, i) => (
            <span key={i} className="text-xs text-muted-foreground">
              {w.name}:{' '}
              <span className="text-foreground">
                {w.wert !== null ? `${w.wert} ${w.einheit}` : '—'}
              </span>
            </span>
          ))}
        </div>
        {aufmass.notiz && (
          <p className="text-xs text-muted-foreground mt-1 italic">
            {aufmass.notiz}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={`${aufmass.element_name} löschen`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  )
}

function DesktopListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2, 3].map((i) => (
        <li key={i} className="px-4 py-3 border-b border-border space-y-1">
          <div className="h-4 bg-muted rounded animate-pulse w-36" />
          <div className="h-3 bg-muted rounded animate-pulse w-24" />
        </li>
      ))}
    </ul>
  )
}

function AufmasseRechtsSeiteListeSkeleton(): React.JSX.Element {
  return (
    <ul>
      {[1, 2].map((i) => (
        <li key={i} className="px-6 py-4 border-b border-border space-y-2">
          <div className="h-4 bg-muted rounded animate-pulse w-32" />
          <div className="flex gap-4">
            <div className="h-3 bg-muted rounded animate-pulse w-20" />
            <div className="h-3 bg-muted rounded animate-pulse w-20" />
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Schritt 2: Typ-Check**

```bash
pnpm tsc --noEmit
```

Erwartete Ausgabe: 0 Fehler.

- [ ] **Schritt 3: Build-Check**

```bash
pnpm build
```

Erwartete Ausgabe: Erfolgreicher Build, `/desktop/aufmasse` erscheint in der Route-Übersicht.

- [ ] **Schritt 4: Commit**

```bash
git add app/desktop/aufmasse/page.tsx
git commit -m "feat: add desktop Aufmasse split-panel page"
```

---

## Self-Review

**Spec-Abdeckung:**
- ✅ Baustellen CRUD (create, update, delete, list)
- ✅ Aufmaße erfassen (template auswählen → werte eintragen → speichern)
- ✅ Aufmaße löschen
- ✅ Mobile: 2-Level-Navigation (Baustellen → Aufmaße)
- ✅ Desktop: Split-Panel
- ✅ RLS auf beiden Tabellen
- ✅ Zod-Validierung Client + Server
- ✅ Loading/Error/Empty States überall
- ✅ Touch Targets 56px mobile
- ✅ Optimistic Delete auf Baustellen + Aufmaße
- ✅ Per-item delete disabled (nicht alle blockieren)
- ✅ element_name als Snapshot (Template-Löschung-sicher)

**Typ-Konsistenz:**
- `AufmassFormData` (lib/validations/aufmass.ts) → verwendet in actions/aufmasse.ts + hooks/use-aufmasse.ts + AufmassFormSheet.tsx ✅
- `BaustelleFormData` (lib/validations/baustelle.ts) → verwendet in actions/baustellen.ts + hooks/use-baustellen.ts + BaustelleFormSheet.tsx ✅
- `AufmassPositionWert` (types/index.ts) → verwendet in AufmassWerteEditor + AufmassFormSheet ✅
- `aufmasseQueryKey(baustelleId)` → konsistent in useAufmasse + useCreateAufmass + useDeleteAufmass ✅

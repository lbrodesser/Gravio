# LV / Abrechnung / Excel-Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LV-Import aus Excel, automatische Abrechnung pro Aufmaß, und Excel-Export mit Vorlage — vollständig in Gravio's Next.js 15 / Server Actions Architektur.

**Architecture:** LV-Gruppen (Leistungsverzeichnisse) werden per Excel-Upload importiert. Baukasten-Elemente (ElementTemplate.positionen) erhalten einen `lv_position_id` Link — sobald ein Aufmaß erstellt wird, ist die LV-Zuordnung bereits bekannt. Eine Abrechnung wird automatisch pro Aufmaß generiert. Export via Supabase Edge Function `export-excel`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Supabase SSR + Storage, TanStack Query v5, React Hook Form + Zod, xlsx-js-style (client-side Excel parsing), exceljs (Edge Function Excel filling), Lucide React, Sonner

---

## File Map

### New files
| File | Verantwortlichkeit |
|---|---|
| `supabase/migrations/YYYYMMDD_lv_abrechnung.sql` | 5 neue Tabellen + RLS |
| `types/lv.ts` | TS interfaces: LvGruppe, LvPosition, Abrechnung, AbrechnungPosition, Abrechnungsvorlage |
| `lib/validations/lv.ts` | Zod schemas für LV |
| `lib/validations/abrechnung.ts` | Zod schemas für Abrechnung |
| `actions/lv.ts` | Server Actions: CRUD LV-Gruppen + Positionen |
| `actions/abrechnungen.ts` | Server Actions: CRUD Abrechnungen + Positionen |
| `actions/abrechnungsvorlagen.ts` | Server Action: Vorlage-Upload zu Supabase Storage |
| `hooks/use-lv.ts` | TanStack Query hooks für LV |
| `hooks/use-abrechnungen.ts` | TanStack Query hooks für Abrechnungen |
| `components/lv/LvImportDialog.tsx` | Excel-Import Dialog (client, xlsx-js-style) |
| `components/lv/EinheitenFaktorenDialog.tsx` | Faktoren nach Import zuweisen |
| `components/lv/LvGruppeCard.tsx` | LV-Gruppe mit ausgeklappten Positionen |
| `components/lv/LvPositionRow.tsx` | Einzelne LV-Position (inline edit) |
| `components/abrechnung/AbrechnungCard.tsx` | Abrechnung-Übersicht (Positionen, Gesamtpreis) |
| `components/abrechnung/AbrechnungPositionRow.tsx` | Einzelne Zeile (Menge editierbar) |
| `components/abrechnung/ExportButton.tsx` | Export-Button mit Download-Logik |
| `app/mobile/lv/page.tsx` | Mobile LV-Verwaltung |
| `app/desktop/lv/page.tsx` | Desktop LV split-panel |
| `supabase/functions/export-excel/index.ts` | Edge Function: Excel-Export |

### Modified files
| File | Was ändert sich |
|---|---|
| `types/index.ts` | `Position` + `AufmassPositionWert` erhalten `lv_position_id: string \| null` |
| `lib/validations/element-template.ts` | `PositionSchema` + `AufmassPositionWertSchema` erhalten `lv_position_id` |
| `lib/validations/aufmass.ts` | `AufmassPositionWertSchema` erhält `lv_position_id` |
| `components/elemente/PositionenEditor.tsx` | LV-Position Selector pro Zeile |
| `components/elemente/ElementFormSheet.tsx` | LV-Gruppe prop übergeben |
| `components/elemente/ElementDetailPanel.tsx` | LV-Gruppe prop übergeben |
| `components/aufmasse/AufmassFormSheet.tsx` | Snapshots `lv_position_id` beim Erstellen |
| `app/mobile/aufmasse/[id]/page.tsx` | Abrechnung-Sektion anzeigen |
| `app/desktop/aufmasse/page.tsx` | Abrechnung-Panel rechts |
| `app/mobile/layout.tsx` | LV-Navigationspunkt |
| `app/desktop/layout.tsx` | LV-Navigationspunkt |

---

## Task 1: Supabase Migration — 5 neue Tabellen

**Files:**
- Create: `supabase/migrations/20260328120000_lv_abrechnung.sql`

- [ ] **Schritt 1: Migration schreiben**

```sql
-- lv_gruppen: Leistungsverzeichnis-Gruppen (eine pro Import)
CREATE TABLE IF NOT EXISTS lv_gruppen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  einheiten_faktoren jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- lv_positionen: Artikel/Positionen eines LV
CREATE TABLE IF NOT EXISTS lv_positionen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lv_gruppe_id uuid NOT NULL REFERENCES lv_gruppen(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artikelnr text,
  kurztext text NOT NULL,
  einheit text NOT NULL,
  einheitspreis numeric(12,4) NOT NULL DEFAULT 0,
  faktor numeric(12,4) NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- baustellen: lv_gruppe_id FK hinzufügen
ALTER TABLE baustellen
  ADD COLUMN IF NOT EXISTS lv_gruppe_id uuid REFERENCES lv_gruppen(id) ON DELETE SET NULL;

-- abrechnungen: eine pro Aufmaß
CREATE TABLE IF NOT EXISTS abrechnungen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aufmass_id uuid NOT NULL UNIQUE REFERENCES aufmasse(id) ON DELETE CASCADE,
  baustelle_id uuid NOT NULL REFERENCES baustellen(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'abgeschlossen')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- abrechnung_positionen: Zeilen einer Abrechnung
CREATE TABLE IF NOT EXISTS abrechnung_positionen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  abrechnung_id uuid NOT NULL REFERENCES abrechnungen(id) ON DELETE CASCADE,
  lv_position_id uuid REFERENCES lv_positionen(id) ON DELETE SET NULL,
  positionsname text NOT NULL,
  einheit text NOT NULL,
  menge numeric(12,4) NOT NULL DEFAULT 0,
  einheitspreis numeric(12,4) NOT NULL DEFAULT 0,
  faktor numeric(12,4) NOT NULL DEFAULT 1,
  gesamtpreis numeric(12,4) GENERATED ALWAYS AS (menge * einheitspreis * faktor) STORED,
  created_at timestamptz DEFAULT now()
);

-- abrechnungsvorlagen: Excel-Vorlagen in Storage
CREATE TABLE IF NOT EXISTS abrechnungsvorlagen (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS für alle neuen Tabellen
ALTER TABLE lv_gruppen ENABLE ROW LEVEL SECURITY;
ALTER TABLE lv_positionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE abrechnungen ENABLE ROW LEVEL SECURITY;
ALTER TABLE abrechnung_positionen ENABLE ROW LEVEL SECURITY;
ALTER TABLE abrechnungsvorlagen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lv_gruppen_own" ON lv_gruppen
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "lv_positionen_own" ON lv_positionen
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "abrechnungen_own" ON abrechnungen
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "abrechnung_positionen_own" ON abrechnung_positionen
  USING (
    EXISTS (
      SELECT 1 FROM abrechnungen a
      WHERE a.id = abrechnung_positionen.abrechnung_id
        AND a.user_id = auth.uid()
    )
  );

CREATE POLICY "abrechnungsvorlagen_own" ON abrechnungsvorlagen
  FOR ALL USING (auth.uid() = user_id);

-- Supabase Storage Bucket für Vorlagen
INSERT INTO storage.buckets (id, name, public)
  VALUES ('vorlagen', 'vorlagen', false)
  ON CONFLICT DO NOTHING;

CREATE POLICY "vorlagen_own_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vorlagen' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "vorlagen_own_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'vorlagen' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "vorlagen_own_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'vorlagen' AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

- [ ] **Schritt 2: Migration anwenden**

```bash
npx supabase db push
# oder via Supabase MCP: apply_migration
```

Expected: alle 5 Tabellen + RLS Policies angelegt, kein Fehler.

- [ ] **Schritt 3: TypeScript Typen generieren**

```bash
npx supabase gen types typescript --local > types/supabase.ts
```

- [ ] **Schritt 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add lv_gruppen, lv_positionen, abrechnungen, abrechnung_positionen, abrechnungsvorlagen tables with RLS"
```

---

## Task 2: TypeScript Interfaces + Zod Schemas

**Files:**
- Create: `types/lv.ts`
- Modify: `types/index.ts`
- Create: `lib/validations/lv.ts`
- Create: `lib/validations/abrechnung.ts`
- Modify: `lib/validations/element-template.ts`
- Modify: `lib/validations/aufmass.ts`

- [ ] **Schritt 1: `types/lv.ts` erstellen**

```typescript
export interface LvGruppe {
  id: string
  user_id: string
  name: string
  einheiten_faktoren: Record<string, number>
  created_at: string
}

export interface LvPosition {
  id: string
  lv_gruppe_id: string
  user_id: string
  artikelnr: string | null
  kurztext: string
  einheit: string
  einheitspreis: number
  faktor: number
  created_at: string
}

export type AbrechnungStatus = 'offen' | 'abgeschlossen'

export interface Abrechnung {
  id: string
  user_id: string
  aufmass_id: string
  baustelle_id: string
  name: string
  status: AbrechnungStatus
  created_at: string
  updated_at: string
}

export interface AbrechnungPosition {
  id: string
  abrechnung_id: string
  lv_position_id: string | null
  positionsname: string
  einheit: string
  menge: number
  einheitspreis: number
  faktor: number
  gesamtpreis: number
  created_at: string
}

export interface Abrechnungsvorlage {
  id: string
  user_id: string
  name: string
  storage_path: string
  created_at: string
}

// Aggregierter Typ für die Anzeige
export interface AbrechnungMitPositionen extends Abrechnung {
  positionen: AbrechnungPosition[]
  gesamtsumme: number
}
```

- [ ] **Schritt 2: `types/index.ts` — `Position` und `AufmassPositionWert` erweitern**

In `types/index.ts` die bestehenden Interfaces ergänzen:

```typescript
// Position (in ElementTemplate.positionen JSONB)
export interface Position {
  id: string
  name: string
  einheit: Einheit
  menge: number | null
  lv_position_id: string | null  // NEU: Link zur LV-Position
}

// AufmassPositionWert (Snapshot bei Aufnahme)
export interface AufmassPositionWert {
  name: string
  einheit: Einheit
  wert: number | null
  lv_position_id: string | null  // NEU: Snapshot des LV-Links
}

// Baustelle — lv_gruppe_id hinzufügen
export interface Baustelle {
  id: string
  user_id: string
  name: string
  adresse: string | null
  lv_gruppe_id: string | null  // NEU
  created_at: string
  updated_at: string
}
```

- [ ] **Schritt 3: `lib/validations/lv.ts` erstellen**

```typescript
import { z } from 'zod'

export const LvGruppeFormSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
})

export const LvPositionFormSchema = z.object({
  artikelnr: z.string().max(50).nullable().optional(),
  kurztext: z.string().min(1, 'Kurztext ist erforderlich').max(500),
  einheit: z.string().min(1, 'Einheit ist erforderlich').max(20),
  einheitspreis: z.preprocess(
    (v) => (v === '' || v === undefined ? null : Number(v)),
    z.number({ invalid_type_error: 'Muss eine Zahl sein' }).min(0).nullable()
  ),
  faktor: z.preprocess(
    (v) => (v === '' || v === undefined ? 1 : Number(v)),
    z.number().min(0).default(1)
  ),
})

export const LvImportRowSchema = z.object({
  artikelnr: z.string().nullable().optional(),
  kurztext: z.string().min(1),
  einheit: z.string().min(1),
  einheitspreis: z.number().min(0),
  faktor: z.number().min(0).default(1),
})

export const LvImportSchema = z.object({
  gruppenname: z.string().min(1),
  positionen: z.array(LvImportRowSchema).min(1, 'Mindestens eine Position erforderlich'),
  einheiten_faktoren: z.record(z.string(), z.number()).default({}),
})

export type LvGruppeFormData = z.infer<typeof LvGruppeFormSchema>
export type LvPositionFormData = z.infer<typeof LvPositionFormSchema>
export type LvImportData = z.infer<typeof LvImportSchema>
```

- [ ] **Schritt 4: `lib/validations/abrechnung.ts` erstellen**

```typescript
import { z } from 'zod'

const nullablePositiveNumber = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : Number(v)),
  z.number().min(0).nullable()
)

export const AbrechnungPositionFormSchema = z.object({
  positionsname: z.string().min(1),
  einheit: z.string().min(1),
  menge: nullablePositiveNumber,
  einheitspreis: nullablePositiveNumber,
  faktor: z.preprocess(
    (v) => (v === '' || v === undefined ? 1 : Number(v)),
    z.number().min(0).default(1)
  ),
  lv_position_id: z.string().uuid().nullable().optional(),
})

export type AbrechnungPositionFormData = z.infer<typeof AbrechnungPositionFormSchema>
```

- [ ] **Schritt 5: `lib/validations/element-template.ts` — `PositionSchema` erweitern**

```typescript
// PositionSchema um lv_position_id ergänzen:
export const PositionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name ist erforderlich'),
  einheit: EinheitSchema,
  menge: nullableNumber,
  lv_position_id: z.string().uuid().nullable().optional(),
})
```

- [ ] **Schritt 6: `lib/validations/aufmass.ts` — `AufmassPositionWertSchema` erweitern**

```typescript
export const AufmassPositionWertSchema = z.object({
  name: z.string().min(1),
  einheit: EinheitSchema,
  wert: nullableNumber,
  lv_position_id: z.string().uuid().nullable().optional(),
})
```

- [ ] **Schritt 7: TypeScript check**

```bash
pnpm tsc --noEmit
```

Expected: 0 Fehler.

- [ ] **Schritt 8: Commit**

```bash
git add types/ lib/validations/
git commit -m "feat: add LV/Abrechnung types and Zod schemas"
```

---

## Task 3: Server Actions — LV-Gruppen + Positionen

**Files:**
- Create: `actions/lv.ts`

- [ ] **Schritt 1: `actions/lv.ts` erstellen**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { LvGruppeFormSchema, LvImportSchema } from '@/lib/validations/lv'
import type { LvGruppe, LvPosition } from '@/types/lv'

export async function getLvGruppen(): Promise<{ data: LvGruppe[] | null; error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Nicht angemeldet' }

  const { data, error } = await supabase
    .from('lv_gruppen')
    .select('id, user_id, name, einheiten_faktoren, created_at')
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  return { data: data as LvGruppe[], error: null }
}

export async function getLvPositionen(
  gruppeId: string
): Promise<{ data: LvPosition[] | null; error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Nicht angemeldet' }

  const { data, error } = await supabase
    .from('lv_positionen')
    .select('id, lv_gruppe_id, user_id, artikelnr, kurztext, einheit, einheitspreis, faktor, created_at')
    .eq('lv_gruppe_id', gruppeId)
    .order('created_at', { ascending: true })

  if (error) return { data: null, error: error.message }
  return { data: data as LvPosition[], error: null }
}

export async function importLv(
  rawData: unknown
): Promise<{ error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht angemeldet' }

  const parsed = LvImportSchema.safeParse(rawData)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Ungültige Daten' }

  const { gruppenname, positionen, einheiten_faktoren } = parsed.data

  const { data: gruppe, error: gruppeError } = await supabase
    .from('lv_gruppen')
    .insert({ user_id: user.id, name: gruppenname, einheiten_faktoren })
    .select('id')
    .single()

  if (gruppeError || !gruppe) return { error: gruppeError?.message ?? 'Fehler beim Erstellen' }

  // Batch-Insert in Chunks von 100
  const CHUNK = 100
  for (let i = 0; i < positionen.length; i += CHUNK) {
    const chunk = positionen.slice(i, i + CHUNK).map((p) => ({
      lv_gruppe_id: gruppe.id,
      user_id: user.id,
      artikelnr: p.artikelnr ?? null,
      kurztext: p.kurztext,
      einheit: p.einheit,
      einheitspreis: p.einheitspreis,
      faktor: p.faktor,
    }))
    const { error: posError } = await supabase.from('lv_positionen').insert(chunk)
    if (posError) return { error: posError.message }
  }

  revalidatePath('/mobile/lv')
  revalidatePath('/desktop/lv')
  return { error: null }
}

export async function deleteLvGruppe(
  id: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht angemeldet' }

  const { error } = await supabase
    .from('lv_gruppen')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/mobile/lv')
  revalidatePath('/desktop/lv')
  return { error: null }
}

export async function updateLvPosition(
  id: string,
  rawData: unknown
): Promise<{ error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht angemeldet' }

  const { LvPositionFormSchema } = await import('@/lib/validations/lv')
  const parsed = LvPositionFormSchema.safeParse(rawData)
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Ungültige Daten' }

  const { error } = await supabase
    .from('lv_positionen')
    .update(parsed.data)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/desktop/lv')
  return { error: null }
}
```

- [ ] **Schritt 2: TypeScript check**

```bash
pnpm tsc --noEmit
```

- [ ] **Schritt 3: Commit**

```bash
git add actions/lv.ts
git commit -m "feat: add LV server actions (getLvGruppen, importLv, deleteLvGruppe, updateLvPosition)"
```

---

## Task 4: Server Actions — Abrechnungen

**Files:**
- Create: `actions/abrechnungen.ts`

- [ ] **Schritt 1: `actions/abrechnungen.ts` erstellen**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import type { Abrechnung, AbrechnungMitPositionen, AbrechnungPosition } from '@/types/lv'
import type { AufmassPositionWert } from '@/types/index'

export async function getAbrechnungFuerAufmass(
  aufmassId: string
): Promise<{ data: AbrechnungMitPositionen | null; error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Nicht angemeldet' }

  const { data, error } = await supabase
    .from('abrechnungen')
    .select(`
      id, user_id, aufmass_id, baustelle_id, name, status, created_at, updated_at,
      abrechnung_positionen (
        id, abrechnung_id, lv_position_id, positionsname, einheit,
        menge, einheitspreis, faktor, gesamtpreis, created_at
      )
    `)
    .eq('aufmass_id', aufmassId)
    .single()

  if (error && error.code === 'PGRST116') return { data: null, error: null } // not found = ok
  if (error) return { data: null, error: error.message }

  const positionen = (data.abrechnung_positionen ?? []) as AbrechnungPosition[]
  const gesamtsumme = positionen.reduce((sum, p) => sum + (p.gesamtpreis ?? 0), 0)

  return {
    data: { ...(data as unknown as Abrechnung), positionen, gesamtsumme },
    error: null,
  }
}

export async function getAbrechnungenFuerBaustelle(
  baustelleId: string
): Promise<{ data: AbrechnungMitPositionen[] | null; error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Nicht angemeldet' }

  const { data, error } = await supabase
    .from('abrechnungen')
    .select(`
      id, user_id, aufmass_id, baustelle_id, name, status, created_at, updated_at,
      abrechnung_positionen (
        id, abrechnung_id, lv_position_id, positionsname, einheit,
        menge, einheitspreis, faktor, gesamtpreis, created_at
      )
    `)
    .eq('baustelle_id', baustelleId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }

  const result = (data ?? []).map((d) => {
    const positionen = (d.abrechnung_positionen ?? []) as AbrechnungPosition[]
    const gesamtsumme = positionen.reduce((sum, p) => sum + (p.gesamtpreis ?? 0), 0)
    return { ...(d as unknown as Abrechnung), positionen, gesamtsumme }
  })

  return { data: result, error: null }
}

interface CreateAbrechnungInput {
  aufmassId: string
  baustelleId: string
  aufmassName: string
  positionenWerte: AufmassPositionWert[]
  lvPositionen: Array<{
    id: string
    kurztext: string
    einheit: string
    einheitspreis: number
    faktor: number
  }>
}

export async function createAbrechnungFuerAufmass(
  input: CreateAbrechnungInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Nicht angemeldet' }

  const { data: abrechnung, error: abrError } = await supabase
    .from('abrechnungen')
    .insert({
      user_id: user.id,
      aufmass_id: input.aufmassId,
      baustelle_id: input.baustelleId,
      name: input.aufmassName,
      status: 'offen',
    })
    .select('id')
    .single()

  if (abrError || !abrechnung) return { data: null, error: abrError?.message ?? 'Fehler' }

  // Positionen aus positionenWerte generieren
  const lvMap = new Map(input.lvPositionen.map((p) => [p.id, p]))

  const positionen = input.positionenWerte
    .filter((pw) => pw.wert !== null && pw.wert !== undefined)
    .map((pw) => {
      const lvPos = pw.lv_position_id ? lvMap.get(pw.lv_position_id) : undefined
      return {
        abrechnung_id: abrechnung.id,
        lv_position_id: pw.lv_position_id ?? null,
        positionsname: pw.name,
        einheit: pw.einheit,
        menge: pw.wert ?? 0,
        einheitspreis: lvPos?.einheitspreis ?? 0,
        faktor: lvPos?.faktor ?? 1,
      }
    })

  if (positionen.length > 0) {
    const { error: posError } = await supabase
      .from('abrechnung_positionen')
      .insert(positionen)
    if (posError) return { data: null, error: posError.message }
  }

  revalidatePath(`/mobile/aufmasse/${input.baustelleId}`)
  revalidatePath('/desktop/aufmasse')
  return { data: { id: abrechnung.id }, error: null }
}

export async function updateAbrechnungPosition(
  id: string,
  menge: number
): Promise<{ error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht angemeldet' }

  const { error } = await supabase
    .from('abrechnung_positionen')
    .update({ menge })
    .eq('id', id)

  if (error) return { error: error.message }
  return { error: null }
}

export async function deleteAbrechnung(
  id: string,
  baustelleId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Nicht angemeldet' }

  const { error } = await supabase.from('abrechnungen').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath(`/mobile/aufmasse/${baustelleId}`)
  revalidatePath('/desktop/aufmasse')
  return { error: null }
}
```

- [ ] **Schritt 2: TypeScript check + Commit**

```bash
pnpm tsc --noEmit
git add actions/abrechnungen.ts
git commit -m "feat: add Abrechnung server actions (create, get, update, delete)"
```

---

## Task 5: TanStack Query Hooks

**Files:**
- Create: `hooks/use-lv.ts`
- Create: `hooks/use-abrechnungen.ts`

- [ ] **Schritt 1: `hooks/use-lv.ts` erstellen**

```typescript
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getLvGruppen,
  getLvPositionen,
  importLv,
  deleteLvGruppe,
  updateLvPosition,
} from '@/actions/lv'
import type { LvGruppe, LvPosition } from '@/types/lv'
import type { LvImportData } from '@/lib/validations/lv'

export function useLvGruppen(): ReturnType<typeof useQuery<LvGruppe[]>> {
  return useQuery({
    queryKey: ['lv-gruppen'],
    queryFn: async () => {
      const { data, error } = await getLvGruppen()
      if (error) throw new Error(error)
      return data ?? []
    },
  })
}

export function useLvPositionen(gruppeId: string | null): ReturnType<typeof useQuery<LvPosition[]>> {
  return useQuery({
    queryKey: ['lv-positionen', gruppeId],
    queryFn: async () => {
      if (!gruppeId) return []
      const { data, error } = await getLvPositionen(gruppeId)
      if (error) throw new Error(error)
      return data ?? []
    },
    enabled: !!gruppeId,
  })
}

export function useImportLv(): ReturnType<typeof useMutation> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: LvImportData) => importLv(data),
    onSuccess: (result) => {
      if ((result as { error: string | null }).error) {
        toast.error((result as { error: string }).error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['lv-gruppen'] })
      toast.success('Leistungsverzeichnis importiert')
    },
    onError: () => toast.error('Import fehlgeschlagen'),
  })
}

export function useDeleteLvGruppe(): ReturnType<typeof useMutation> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteLvGruppe(id),
    onSuccess: (result, id) => {
      if ((result as { error: string | null }).error) {
        toast.error((result as { error: string }).error)
        return
      }
      queryClient.setQueryData<LvGruppe[]>(['lv-gruppen'], (old) =>
        old?.filter((g) => g.id !== id) ?? []
      )
      toast.success('Leistungsverzeichnis gelöscht')
    },
    onError: () => toast.error('Löschen fehlgeschlagen'),
  })
}

export function useUpdateLvPosition(): ReturnType<typeof useMutation> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => updateLvPosition(id, data),
    onSuccess: (result, { id }) => {
      if ((result as { error: string | null }).error) {
        toast.error((result as { error: string }).error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['lv-positionen'] })
      toast.success('Position aktualisiert')
    },
    onError: () => toast.error('Aktualisierung fehlgeschlagen'),
  })
}
```

- [ ] **Schritt 2: `hooks/use-abrechnungen.ts` erstellen**

```typescript
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getAbrechnungFuerAufmass,
  getAbrechnungenFuerBaustelle,
  createAbrechnungFuerAufmass,
  updateAbrechnungPosition,
  deleteAbrechnung,
} from '@/actions/abrechnungen'
import type { AbrechnungMitPositionen } from '@/types/lv'

export function useAbrechnungFuerAufmass(aufmassId: string | null) {
  return useQuery<AbrechnungMitPositionen | null>({
    queryKey: ['abrechnung-aufmass', aufmassId],
    queryFn: async () => {
      if (!aufmassId) return null
      const { data, error } = await getAbrechnungFuerAufmass(aufmassId)
      if (error) throw new Error(error)
      return data
    },
    enabled: !!aufmassId,
  })
}

export function useAbrechnungenFuerBaustelle(baustelleId: string | null) {
  return useQuery<AbrechnungMitPositionen[]>({
    queryKey: ['abrechnungen-baustelle', baustelleId],
    queryFn: async () => {
      if (!baustelleId) return []
      const { data, error } = await getAbrechnungenFuerBaustelle(baustelleId)
      if (error) throw new Error(error)
      return data ?? []
    },
    enabled: !!baustelleId,
  })
}

export function useCreateAbrechnung() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof createAbrechnungFuerAufmass>[0]) =>
      createAbrechnungFuerAufmass(input),
    onSuccess: (result, input) => {
      if ((result as { error: string | null }).error) {
        toast.error((result as { error: string }).error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['abrechnung-aufmass', input.aufmassId] })
      queryClient.invalidateQueries({ queryKey: ['abrechnungen-baustelle', input.baustelleId] })
      toast.success('Abrechnung erstellt')
    },
    onError: () => toast.error('Fehler beim Erstellen der Abrechnung'),
  })
}

export function useUpdateAbrechnungPosition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, menge }: { id: string; menge: number; aufmassId: string }) =>
      updateAbrechnungPosition(id, menge),
    onSuccess: (result, { aufmassId }) => {
      if ((result as { error: string | null }).error) {
        toast.error((result as { error: string }).error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['abrechnung-aufmass', aufmassId] })
    },
    onError: () => toast.error('Aktualisierung fehlgeschlagen'),
  })
}

export function useDeleteAbrechnung() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, baustelleId }: { id: string; baustelleId: string }) =>
      deleteAbrechnung(id, baustelleId),
    onSuccess: (result, { baustelleId }) => {
      if ((result as { error: string | null }).error) {
        toast.error((result as { error: string }).error)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['abrechnungen-baustelle', baustelleId] })
      toast.success('Abrechnung gelöscht')
    },
    onError: () => toast.error('Löschen fehlgeschlagen'),
  })
}
```

- [ ] **Schritt 3: Commit**

```bash
pnpm tsc --noEmit
git add hooks/use-lv.ts hooks/use-abrechnungen.ts
git commit -m "feat: add TanStack Query hooks for LV and Abrechnungen"
```

---

## Task 6: xlsx-js-style installieren + LV-Import Dialog

**Files:**
- Modify: `package.json` (via pnpm)
- Create: `components/lv/LvImportDialog.tsx`
- Create: `components/lv/EinheitenFaktorenDialog.tsx`

- [ ] **Schritt 1: xlsx-js-style installieren**

```bash
pnpm add xlsx-js-style
```

- [ ] **Schritt 2: `components/lv/LvImportDialog.tsx` erstellen**

Dieser Dialog parst die Excel-Datei client-seitig und ruft dann den Server Action auf.

```typescript
'use client'

import { useRef, useState } from 'react'
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

export function LvImportDialog({ open, onOpenChange }: Props): JSX.Element {
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
        const headers = Object.keys(rows[0]).map(normalizeHeader)
        const rawHeaders = Object.keys(rows[0])

        const findCol = (keywords: string[]): string | undefined =>
          rawHeaders.find((h) => keywords.some((k) => normalizeHeader(h).includes(k)))

        const artCol = findCol(['artkel', 'artikelnr', 'pos', 'nr'])
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
    if (!(result as { error: string | null }).error) {
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
            <Button variant="outline" onClick={() => onOpenChange(false)}>
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
```

- [ ] **Schritt 3: `components/lv/EinheitenFaktorenDialog.tsx` erstellen**

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  einheiten: string[]
  onConfirm: (faktoren: Record<string, number>) => Promise<void>
  onCancel: () => void
  isLoading: boolean
}

export function EinheitenFaktorenDialog({
  open,
  einheiten,
  onConfirm,
  onCancel,
  isLoading,
}: Props): JSX.Element {
  const [faktoren, setFaktoren] = useState<Record<string, string>>(
    Object.fromEntries(einheiten.map((e) => [e, '1']))
  )

  function handleChange(einheit: string, value: string): void {
    setFaktoren((prev) => ({ ...prev, [einheit]: value }))
  }

  async function handleConfirm(): Promise<void> {
    const numericFaktoren: Record<string, number> = {}
    for (const [e, v] of Object.entries(faktoren)) {
      numericFaktoren[e] = parseFloat(v.replace(',', '.')) || 1
    }
    await onConfirm(numericFaktoren)
  }

  return (
    <Dialog open={open} onOpenChange={() => !isLoading && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Einheiten-Faktoren</DialogTitle>
          <DialogDescription>
            Multiplikator pro Einheit (z. B. 1.05 für 5% Zuschlag)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {einheiten.map((einheit) => (
            <div key={einheit} className="flex items-center gap-3">
              <Label className="w-16 shrink-0 font-mono">{einheit}</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={faktoren[einheit] ?? '1'}
                onChange={(e) => handleChange(einheit, e.target.value)}
                className="h-14"
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Zurück
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading} className="h-14">
            {isLoading ? 'Importiere…' : 'Importieren'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Schritt 4: TypeScript check + Commit**

```bash
pnpm tsc --noEmit
git add components/lv/ package.json pnpm-lock.yaml
git commit -m "feat: add LV import dialog with Excel parsing and Einheiten-Faktoren"
```

---

## Task 7: LV-Verwaltung Pages (Desktop + Mobile)

**Files:**
- Create: `components/lv/LvGruppeCard.tsx`
- Create: `app/mobile/lv/page.tsx`
- Create: `app/desktop/lv/page.tsx`

- [ ] **Schritt 1: `components/lv/LvGruppeCard.tsx` erstellen**

```typescript
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDeleteLvGruppe, useLvPositionen } from '@/hooks/use-lv'
import type { LvGruppe } from '@/types/lv'

interface Props {
  gruppe: LvGruppe
}

export function LvGruppeCard({ gruppe }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { data: positionen, isLoading } = useLvPositionen(expanded ? gruppe.id : null)
  const deleteGruppe = useDeleteLvGruppe()

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 min-h-[56px]">
        <button
          type="button"
          className="flex-1 flex items-center gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium">{gruppe.name}</span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-destructive hover:text-destructive"
          onClick={() => deleteGruppe.mutate(gruppe.id)}
          disabled={deleteGruppe.isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t bg-muted/30">
          {isLoading && (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted animate-pulse" />
              ))}
            </div>
          )}
          {!isLoading && positionen && positionen.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Keine Positionen</p>
          )}
          {!isLoading && positionen && positionen.length > 0 && (
            <div className="divide-y">
              {positionen.map((pos) => (
                <div key={pos.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  {pos.artikelnr && (
                    <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">
                      {pos.artikelnr}
                    </span>
                  )}
                  <span className="flex-1">{pos.kurztext}</span>
                  <span className="text-muted-foreground shrink-0">{pos.einheit}</span>
                  <span className="font-mono shrink-0">
                    {pos.einheitspreis.toLocaleString('de-DE', {
                      style: 'currency',
                      currency: 'EUR',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Schritt 2: `app/mobile/lv/page.tsx` erstellen**

```typescript
import { useState } from 'react'  // Note: this needs 'use client' since it has state
```

Actually this page needs interactivity, so:

```typescript
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLvGruppen } from '@/hooks/use-lv'
import { LvGruppeCard } from '@/components/lv/LvGruppeCard'
import { LvImportDialog } from '@/components/lv/LvImportDialog'

export default function MobileLvPage(): JSX.Element {
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

        {!isLoading &&
          gruppen?.map((g) => <LvGruppeCard key={g.id} gruppe={g} />)}
      </div>

      <LvImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
```

- [ ] **Schritt 3: `app/desktop/lv/page.tsx` erstellen**

```typescript
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLvGruppen, useLvPositionen } from '@/hooks/use-lv'
import { LvImportDialog } from '@/components/lv/LvImportDialog'
import type { LvGruppe } from '@/types/lv'

export default function DesktopLvPage(): JSX.Element {
  const [importOpen, setImportOpen] = useState(false)
  const [selectedGruppe, setSelectedGruppe] = useState<LvGruppe | null>(null)
  const { data: gruppen, isLoading } = useLvGruppen()
  const { data: positionen, isLoading: posLoading } = useLvPositionen(
    selectedGruppe?.id ?? null
  )

  return (
    <div className="flex h-full">
      {/* Linke Spalte: LV-Gruppen */}
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
            <p className="text-sm text-muted-foreground p-2">Kein LV vorhanden</p>
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
      </aside>

      {/* Rechte Spalte: Positionen */}
      <main className="flex-1 overflow-y-auto">
        {!selectedGruppe && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            LV auswählen
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

- [ ] **Schritt 4: Navigation ergänzen**

In den Layout-Dateien (`app/mobile/layout.tsx` und `app/desktop/layout.tsx`) einen Navigationspunkt "Leistungsverzeichnis" mit Route `/mobile/lv` bzw. `/desktop/lv` hinzufügen. Pattern aus bestehenden Navigationspunkten folgen (z. B. neben "Elemente").

- [ ] **Schritt 5: pnpm build + Commit**

```bash
pnpm tsc --noEmit && pnpm build
git add app/mobile/lv/ app/desktop/lv/ components/lv/
git commit -m "feat: add LV management pages (mobile + desktop) with import dialog"
```

---

## Task 8: ElementTemplate → LV-Position verknüpfen

**Files:**
- Modify: `components/elemente/PositionenEditor.tsx`

- [ ] **Schritt 1: `PositionenEditor.tsx` — LV-Position Selector pro Zeile**

Der `PositionenEditor` bekommt eine optionale `lvPositionen` prop. Pro Position-Zeile erscheint ein `<select>` zum Verknüpfen mit einer LV-Position.

```typescript
// PositionenEditor.tsx — neue Props hinzufügen:
interface LvPositionOption {
  id: string
  kurztext: string
  einheit: string
}

interface Props {
  positionen: Position[]
  onChange: (positionen: Position[]) => void
  lvPositionen?: LvPositionOption[]  // NEU: optional
}
```

In der Zeile pro Position, nach dem Einheit-Select, folgendes hinzufügen (nur wenn `lvPositionen` vorhanden):

```tsx
{lvPositionen && lvPositionen.length > 0 && (
  <select
    value={position.lv_position_id ?? ''}
    onChange={(e) =>
      handleChange(position.id, 'lv_position_id', e.target.value || null)
    }
    className="h-14 rounded-md border border-input bg-background px-3 text-sm flex-1"
  >
    <option value="">— kein LV —</option>
    {lvPositionen.map((lv) => (
      <option key={lv.id} value={lv.id}>
        {lv.kurztext} ({lv.einheit})
      </option>
    ))}
  </select>
)}
```

`handleChange` muss `lv_position_id` unterstützen:

```typescript
function handleChange(
  id: string,
  field: keyof Position,
  value: string | number | null
): void {
  onChange(
    positionen.map((p) => (p.id === id ? { ...p, [field]: value } : p))
  )
}
```

- [ ] **Schritt 2: `ElementFormSheet.tsx` + `ElementDetailPanel.tsx` — LV-Positionen übergeben**

Beide Komponenten erhalten eine `lvPositionen?: LvPositionOption[]` prop und leiten sie an `PositionenEditor` weiter.

- [ ] **Schritt 3: `AufmassFormSheet.tsx` — lv_position_id beim Snapshot mitspeichern**

In `AufmassFormSheet` werden `positionen_werte` aus dem Template gebaut. Sicherstellen, dass `lv_position_id` aus der Template-Position in den Snapshot übernommen wird:

```typescript
// Beim Befüllen von positionen_werte aus dem Template:
const positionenWerte: AufmassPositionWert[] = template.positionen.map((p) => ({
  name: p.name,
  einheit: p.einheit,
  wert: p.menge,
  lv_position_id: p.lv_position_id ?? null,  // NEU: Snapshot
}))
```

- [ ] **Schritt 4: TypeScript check + Commit**

```bash
pnpm tsc --noEmit
git add components/elemente/ components/aufmasse/AufmassFormSheet.tsx
git commit -m "feat: link ElementTemplate positions to LV positions, snapshot lv_position_id in Aufmaß"
```

---

## Task 9: Abrechnung-UI (AbrechnungCard + ExportButton)

**Files:**
- Create: `components/abrechnung/AbrechnungCard.tsx`
- Create: `components/abrechnung/ExportButton.tsx`
- Modify: `app/mobile/aufmasse/[id]/page.tsx`
- Modify: `app/desktop/aufmasse/page.tsx`

- [ ] **Schritt 1: `components/abrechnung/AbrechnungCard.tsx` erstellen**

```typescript
'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useAbrechnungFuerAufmass,
  useCreateAbrechnung,
} from '@/hooks/use-abrechnungen'
import { useLvPositionen } from '@/hooks/use-lv'
import { ExportButton } from './ExportButton'
import type { Aufmass } from '@/types/index'
import type { LvGruppe } from '@/types/lv'

interface Props {
  aufmass: Aufmass
  lvGruppe: LvGruppe | null
}

export function AbrechnungCard({ aufmass, lvGruppe }: Props): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const { data: abrechnung, isLoading } = useAbrechnungFuerAufmass(aufmass.id)
  const { data: lvPositionen } = useLvPositionen(lvGruppe?.id ?? null)
  const createAbrechnung = useCreateAbrechnung()

  function handleCreate(): void {
    createAbrechnung.mutate({
      aufmassId: aufmass.id,
      baustelleId: aufmass.baustelle_id,
      aufmassName: aufmass.element_name,
      positionenWerte: aufmass.positionen_werte,
      lvPositionen: lvPositionen ?? [],
    })
  }

  if (isLoading) {
    return <div className="h-16 rounded-lg bg-muted animate-pulse" />
  }

  if (!abrechnung) {
    return (
      <div className="border rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span className="text-sm">Keine Abrechnung</span>
        </div>
        <Button
          size="sm"
          className="h-14"
          onClick={handleCreate}
          disabled={createAbrechnung.isPending}
        >
          <Plus className="mr-1 h-4 w-4" />
          Abrechnung erstellen
        </Button>
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 p-4 min-h-[56px] text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1">
          <div className="font-medium">{abrechnung.name}</div>
          <div className="text-sm text-muted-foreground">
            Gesamt:{' '}
            {abrechnung.gesamtsumme.toLocaleString('de-DE', {
              style: 'currency',
              currency: 'EUR',
            })}
          </div>
        </div>
        <ExportButton abrechnungId={abrechnung.id} />
      </button>

      {expanded && (
        <div className="border-t divide-y bg-muted/30">
          {abrechnung.positionen.map((pos) => (
            <div key={pos.id} className="px-4 py-3 flex items-center gap-3 text-sm">
              <span className="flex-1">{pos.positionsname}</span>
              <span className="text-muted-foreground">{pos.menge} {pos.einheit}</span>
              <span className="font-mono text-right shrink-0">
                {pos.gesamtpreis.toLocaleString('de-DE', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Schritt 2: `components/abrechnung/ExportButton.tsx` erstellen**

```typescript
'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { createClientClient } from '@/lib/supabase/client'

interface Props {
  abrechnungId: string
  label?: string
}

export function ExportButton({ abrechnungId, label = 'Export' }: Props): JSX.Element {
  const [isLoading, setIsLoading] = useState(false)

  async function handleExport(e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    setIsLoading(true)
    try {
      const supabase = createClientClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Nicht angemeldet')
        return
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/export-excel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ abrechnung_id: abrechnungId }),
        }
      )

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Unbekannter Fehler' }))
        toast.error(err.message ?? 'Export fehlgeschlagen')
        return
      }

      const { download_url } = await res.json() as { download_url: string }
      window.open(download_url, '_blank')
    } catch {
      toast.error('Export fehlgeschlagen')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-10 shrink-0"
      onClick={handleExport}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-1" />
      )}
      {label}
    </Button>
  )
}
```

- [ ] **Schritt 3: Abrechnung-Sektion in mobile Baustellen-Detail-Seite integrieren**

In `app/mobile/aufmasse/[id]/page.tsx` für jedes Aufmaß eine `<AbrechnungCard aufmass={aufmass} lvGruppe={baustelle.lv_gruppe ?? null} />` anzeigen. Die `baustelle` muss nun auch `lv_gruppe_id` laden (Server Action `getBaustelle` ggf. anpassen).

- [ ] **Schritt 4: Gesamtkosten-Summe im Baustellen-Header**

In der mobilen Baustellen-Liste und der Desktop-Übersicht: `useAbrechnungenFuerBaustelle(baustelleId)` aufrufen und alle `gesamtsumme` aufaddieren. Anzeige als "Gesamtkosten: 12.340,50 €" im Baustellen-Card.

- [ ] **Schritt 5: TypeScript check + Commit**

```bash
pnpm tsc --noEmit
git add components/abrechnung/
git commit -m "feat: add AbrechnungCard and ExportButton components"
```

---

## Task 10: Supabase Edge Function — export-excel

**Files:**
- Create: `supabase/functions/export-excel/index.ts`

Benötigt: `exceljs` als Dependency in der Edge Function. Alternativ: `SheetJS` (xlsx) da es keine npm install braucht — importierbar per CDN/esm.sh in Deno.

- [ ] **Schritt 1: Edge Function erstellen**

```typescript
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
```

- [ ] **Schritt 2: Edge Function deployen**

```bash
npx supabase functions deploy export-excel
```

Expected: "Deployed export-excel"

- [ ] **Schritt 3: Storage Policy für exports erweitern**

Die bestehende Storage-Policy in der Migration erlaubt bereits `{user_id}/...` — der exports-Pfad `{user_id}/exports/...` ist damit abgedeckt.

- [ ] **Schritt 4: Commit**

```bash
git add supabase/functions/export-excel/
git commit -m "feat: add export-excel Edge Function (generates XLSX from Abrechnung data)"
```

---

## Task 11: Navigation + Baustellen lv_gruppe_id UI

**Files:**
- Modify: `app/mobile/layout.tsx` (Navigation)
- Modify: `app/desktop/layout.tsx` (Navigation)
- Modify: `components/aufmasse/BaustelleFormSheet.tsx` (LV-Gruppe Selector)

- [ ] **Schritt 1: Navigation**

In den bestehenden Navigation-Arrays beider Layouts folgenden Eintrag hinzufügen:

```typescript
// Mobile:
{ label: 'Leistungsverzeichnis', href: '/mobile/lv', icon: FileText }

// Desktop:
{ label: 'Leistungsverzeichnis', href: '/desktop/lv', icon: FileText }
```

`FileText` aus `lucide-react` importieren.

- [ ] **Schritt 2: BaustelleFormSheet — LV-Gruppe Selector**

In `BaustelleFormSheet.tsx` ein `<select>` für `lv_gruppe_id` hinzufügen:

- Props um `lvGruppen: LvGruppe[]` erweitern
- Im Formular unterhalb des Adressfeldes ein Select mit allen verfügbaren LV-Gruppen
- `BaustelleFormSchema` um `lv_gruppe_id: z.string().uuid().nullable().optional()` erweitern
- Server Action `createBaustelle` / `updateBaustelle` um das Feld erweitern
- Das explizite `.select()` in `use-baustellen.ts` um `lv_gruppe_id` ergänzen

- [ ] **Schritt 3: Finaler Build**

```bash
pnpm tsc --noEmit && pnpm lint && pnpm build
```

Expected: 0 Fehler, 0 Warnungen, Build erfolgreich.

- [ ] **Schritt 4: Final Commit**

```bash
git add .
git commit -m "feat: add LV navigation + BaustelleFormSheet LV-Gruppe Selector"
```

---

## Self-Review

### Spec Coverage
- ✅ Excel LV-Import mit xlsx-js-style (Task 6)
- ✅ Einheiten-Faktoren Dialog nach Import (Task 6)
- ✅ 1 Abrechnung pro Aufmaß (Tasks 4+9)
- ✅ Gesamtkosten pro Baustelle aggregiert (Task 9)
- ✅ Baustelle gesamt exportieren (Task 10: `baustelle_id` param)
- ✅ LV-Positionen automatisch verknüpft über ElementTemplate (Task 8)
- ✅ Excel Export via Edge Function (Task 10)
- ✅ RLS auf allen Tabellen (Task 1)
- ✅ Mobile + Desktop LV-Seiten (Task 7)
- ✅ Vorlage-Storage-Bucket (Task 1 Migration)

### Noch nicht implementiert (bewusst ausgelassen)
- Abrechnungsvorlage-Upload (eigene Excel-Vorlage als Template) — der Export in Task 10 generiert eine einfache XLSX ohne Template. Template-basierter Export kann als separates Feature nachgezogen werden.
- Whisper Voice-Input — separates Feature
- Abrechnung-Status (`offen` → `abgeschlossen`) Toggle — UI kann trivial in AbrechnungCard ergänzt werden

### Typ-Konsistenz
- `LvPosition` in `types/lv.ts` ↔ `useLvPositionen` Hook ↔ `getLvPositionen` Action: alle nutzen `LvPosition[]`
- `AbrechnungMitPositionen` in `types/lv.ts` ↔ `useAbrechnungFuerAufmass` ↔ `AbrechnungCard`: konsistent
- `createAbrechnungFuerAufmass` Input Interface definiert in `actions/abrechnungen.ts` ↔ `useCreateAbrechnung` mutationFn: konsistent

# Gravio — Phase 1: Baukasten (Element Library)

**Datum:** 2026-03-28
**Status:** Genehmigt
**Scope:** Datenbankschema + TypeScript Types + TanStack Query Hooks + Mobile UI + Desktop UI

---

## Ziel

Nutzer können eigene Bauelemente (z.B. Muffengrube, Hausanschluss) mit optionalen Standardmaßen und Aufmaßpositionen definieren, bearbeiten und löschen. Diese Elemente werden später in Phase 2 auf der Skizzen-Canvas platziert.

---

## Out of Scope (Phase 1)

- Keine globalen/Admin-Vorlagen
- Keine organization_id / Multi-Tenant
- Keine UI-Politur — funktionierendes Grundgerüst reicht
- Kein Voice Input
- Kein Export
- Canvas/Skizze (Phase 2)

---

## Datenbankschema

### Tabelle: `element_templates`

| Feld | Typ | Nullable | Default |
|---|---|---|---|
| id | uuid | nein | gen_random_uuid() |
| created_at | timestamptz | nein | now() |
| name | text | nein | — |
| description | text | ja | null |
| laenge | numeric(10,2) | ja | null |
| breite | numeric(10,2) | ja | null |
| tiefe | numeric(10,2) | ja | null |
| positionen | jsonb | nein | '[]' |
| created_by | uuid → auth.users(id) | nein | — |

### Positionen JSONB-Struktur

```ts
[
  {
    "id": "uuid",
    "name": "Ausgraben",
    "einheit": "m³" | "m²" | "m" | "Stk" | "t",
    "menge": number | null
  }
]
```

### RLS Policies

- **SELECT:** `auth.uid() IS NOT NULL` — alle eingeloggten User sehen alle Templates
- **INSERT:** `auth.uid() IS NOT NULL` — jeder User darf eigene erstellen
- **UPDATE:** `auth.uid() = created_by` — nur eigene bearbeiten
- **DELETE:** `auth.uid() = created_by` — nur eigene löschen

---

## TypeScript Types (Erweiterung von types/index.ts)

```ts
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

---

## Architektur

```
supabase/migrations/
  YYYYMMDDHHMMSS_create_element_templates.sql

types/index.ts                        ← erweitern (bestehende Typen bleiben)

lib/
  validations/element-template.ts     ← Zod Schema

actions/
  element-templates.ts                ← Server Actions (create, update, delete)

hooks/
  use-element-templates.ts            ← TanStack Query hooks

components/elemente/
  ElementListe.tsx                    ← Shared list component
  ElementFormSheet.tsx                ← Mobile: Bottom Sheet create/edit
  ElementDetailPanel.tsx              ← Desktop: right panel create/edit
  PositionenEditor.tsx                ← Shared: add/remove/edit positions

app/
  mobile/elemente/page.tsx
  desktop/elemente/page.tsx
```

---

## Server Actions

- `createElementTemplate(data)` → insert + revalidate
- `updateElementTemplate(id, data)` → update + revalidate
- `deleteElementTemplate(id)` → delete + revalidate

---

## TanStack Query Hooks

- `useElementTemplates()` — fetch alle Templates des Users
- `useCreateTemplate()` — mutation wrapper
- `useUpdateTemplate()` — mutation wrapper
- `useDeleteTemplate()` — optimistic delete

---

## Mobile UI (/mobile/elemente)

- Liste aller eigenen Templates (72px Listenelemente, Name + Positionsanzahl)
- FAB "+" unten rechts → öffnet Bottom Sheet
- Bottom Sheet: Formular mit Name, Beschreibung, Maße (optional), Positionen
- Kein Feinschliff — funktional

## Desktop UI (/desktop/elemente)

- Zwei-Spalten: Liste links (320px) + Detailpanel rechts
- Inline-Bearbeitung im Detailpanel
- "Neues Element" Button über der Liste

---

## Entscheidungen & Begründungen

- **Kein `is_global`:** YAGNI — Admin-Vorlagen kommen erst wenn Rollen implementiert sind
- **`laenge/breite/tiefe` nullable:** User gibt Standardwerte optional vor; Pflichtangabe erst auf der Skizze
- **`menge` in positionen nullable:** Richtwert optional; Pflicht erst auf der Skizze
- **UI-Qualität:** Grundgerüst first, Politur in separatem Schritt

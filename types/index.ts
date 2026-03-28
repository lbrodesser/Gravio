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
  lv_position_id?: string | null
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
  lv_gruppe_id: string | null
  created_at: string
  updated_at: string
}

export interface AufmassPositionWert {
  name: string
  einheit: Einheit
  wert: number | null
  lv_position_id?: string | null
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

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

export interface Aufmass {
  id: string
  skizze_id: string
  bezeichnung: string
  wert: number
  einheit: string
  notiz: string | null
  erstellt_am: string
}

export type NutzerRolle = 'admin' | 'vorarbeiter' | 'bauleiter'

export interface Nutzer {
  id: string
  email: string
  rolle: NutzerRolle
  anzeigename: string | null
  erstellt_am: string
}

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

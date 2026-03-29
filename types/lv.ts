// types/lv.ts

export interface LvGruppe {
  id: string
  user_id: string
  name: string
  einheiten_faktoren: Record<string, number> | null
  created_at: string
}

export interface LvPosition {
  id: string
  lv_gruppe_id: string
  user_id: string
  artikelnr: string | null // Always NULL from view, kept for completeness
  kurztext: string
  einheit: string
  einheitspreis: number
  faktor: number
  created_at: string
}

export type AbrechnungStatus = 'offen' | 'abgeschlossen'

export interface Abrechnung {
  id: string
  user_id: string | null // nullable in DB
  aufmass_id: string | null // nullable in DB
  baustelle_id: string
  name: string
  status: AbrechnungStatus
  datum_von: string | null // date type stored as string
  datum_bis: string | null // date type stored as string
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
  gesamtpreis: number | null // generated column, nullable
  created_at: string | null
}

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

// Aggregated type for display
export interface AbrechnungMitPositionen extends Abrechnung {
  positionen: AbrechnungPosition[]
  gesamtsumme: number
}

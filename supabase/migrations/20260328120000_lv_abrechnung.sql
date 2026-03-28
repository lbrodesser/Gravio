-- ─── lv_gruppen: View über preislisten_gruppen ────────────────────────────────
-- preislisten_gruppen existiert bereits mit RLS; lv_gruppen ist ein Alias
CREATE OR REPLACE VIEW lv_gruppen AS
  SELECT
    id,
    user_id,
    name,
    einheiten_faktoren,
    created_at
  FROM preislisten_gruppen;

-- ─── lv_positionen: View über preisliste ──────────────────────────────────────
-- preisliste existiert bereits mit RLS; lv_positionen ist ein Alias
CREATE OR REPLACE VIEW lv_positionen AS
  SELECT
    id,
    preisliste_gruppe_id   AS lv_gruppe_id,
    user_id,
    NULL::text             AS artikelnr,
    artikel                AS kurztext,
    einheit,
    preis                  AS einheitspreis,
    faktor,
    created_at
  FROM preisliste;

-- ─── baustellen: lv_gruppe_id FK hinzufügen ───────────────────────────────────
ALTER TABLE baustellen
  ADD COLUMN IF NOT EXISTS lv_gruppe_id uuid REFERENCES preislisten_gruppen(id) ON DELETE SET NULL;

-- ─── abrechnungen: fehlende Spalten ergänzen ──────────────────────────────────
ALTER TABLE abrechnungen
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS aufmass_id uuid REFERENCES aufmasse(id) ON DELETE CASCADE;

-- Eindeutigkeit auf aufmass_id (eine Abrechnung pro Aufmaß)
CREATE UNIQUE INDEX IF NOT EXISTS abrechnungen_aufmass_id_key ON abrechnungen(aufmass_id);

-- status CHECK-Constraint sicherstellen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'abrechnungen_status_check'
  ) THEN
    ALTER TABLE abrechnungen
      ADD CONSTRAINT abrechnungen_status_check
      CHECK (status IN ('offen', 'abgeschlossen'));
  END IF;
END;
$$;

-- RLS-Policy für user_id auf abrechnungen (nur anlegen falls noch nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'abrechnungen' AND policyname = 'abrechnungen_own'
  ) THEN
    CREATE POLICY "abrechnungen_own" ON abrechnungen
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END;
$$;

-- ─── abrechnung_positionen: Zeilen einer Abrechnung ──────────────────────────
CREATE TABLE IF NOT EXISTS abrechnung_positionen (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  abrechnung_id    uuid NOT NULL REFERENCES abrechnungen(id) ON DELETE CASCADE,
  lv_position_id   uuid REFERENCES preisliste(id) ON DELETE SET NULL,
  positionsname    text NOT NULL,
  einheit          text NOT NULL,
  menge            numeric(12,4) NOT NULL DEFAULT 0,
  einheitspreis    numeric(12,4) NOT NULL DEFAULT 0,
  faktor           numeric(12,4) NOT NULL DEFAULT 1,
  gesamtpreis      numeric(12,4) GENERATED ALWAYS AS (menge * einheitspreis * faktor) STORED,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE abrechnung_positionen ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'abrechnung_positionen' AND policyname = 'abrechnung_positionen_own'
  ) THEN
    CREATE POLICY "abrechnung_positionen_own" ON abrechnung_positionen
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM abrechnungen a
          WHERE a.id = abrechnung_positionen.abrechnung_id
            AND a.user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

-- ─── abrechnungsvorlagen: Excel-Vorlagen in Storage ──────────────────────────
CREATE TABLE IF NOT EXISTS abrechnungsvorlagen (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  storage_path text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE abrechnungsvorlagen ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'abrechnungsvorlagen' AND policyname = 'abrechnungsvorlagen_own'
  ) THEN
    CREATE POLICY "abrechnungsvorlagen_own" ON abrechnungsvorlagen
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END;
$$;

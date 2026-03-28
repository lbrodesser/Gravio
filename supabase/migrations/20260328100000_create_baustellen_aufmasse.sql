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

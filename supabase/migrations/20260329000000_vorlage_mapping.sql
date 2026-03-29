-- supabase/migrations/20260329000000_vorlage_mapping.sql

ALTER TABLE abrechnungsvorlagen
  ADD COLUMN IF NOT EXISTS mapping jsonb,
  ADD COLUMN IF NOT EXISTS analysiert boolean NOT NULL DEFAULT false;

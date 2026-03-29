-- supabase/migrations/20260329100000_element_templates_lv.sql

-- lv_gruppe_id verweist auf preislisten_gruppen (lv_gruppen ist nur ein View)
ALTER TABLE public.element_templates
  ADD COLUMN IF NOT EXISTS lv_gruppe_id uuid
    REFERENCES public.preislisten_gruppen(id) ON DELETE SET NULL;

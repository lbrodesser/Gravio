-- supabase/migrations/20260328000000_create_element_templates.sql

create table public.element_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  description text,
  laenge numeric(10,2),
  breite numeric(10,2),
  tiefe numeric(10,2),
  positionen jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id) on delete cascade
);

alter table public.element_templates enable row level security;

create policy "Authentifizierte Nutzer koennen alle Templates lesen"
  on public.element_templates for select
  to authenticated
  using (auth.uid() is not null);

create policy "Nutzer koennen eigene Templates erstellen"
  on public.element_templates for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Nutzer koennen nur eigene Templates bearbeiten"
  on public.element_templates for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "Nutzer koennen nur eigene Templates loeschen"
  on public.element_templates for delete
  to authenticated
  using (auth.uid() = created_by);

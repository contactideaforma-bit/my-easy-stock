-- ============================================================
-- MY EASY STOCK — Migration 004 : Profil société (facturation)
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

create table public.company_settings (
  id int primary key default 1 check (id = 1),   -- une seule ligne
  name text not null default 'Ma Société',
  legal_form text,                                -- SARL, EI, auto-entrepreneur…
  address text,
  phone text,
  email text,
  siret text,
  vat_number text,                                -- n° TVA intracommunautaire
  vat_rate numeric(4,2) not null default 20,      -- 0 si franchise en base (art. 293 B)
  iban text,
  bic text,
  invoice_footer text,                            -- mentions complémentaires
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id) values (1) on conflict do nothing;

alter table public.company_settings enable row level security;
create policy "authenticated_all_company_settings" on public.company_settings
  for all to authenticated using (true) with check (true);

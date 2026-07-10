-- ============================================================
-- MY EASY STOCK — Migration 007 : Fiches clients + factures personnalisées
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

-- Fiche client complète (name = nom de famille pour les nouveaux clients)
alter table public.customers add column first_name text;
alter table public.customers add column email text;
alter table public.customers add column address text;

-- Personnalisation des factures
alter table public.company_settings add column logo_url text;
alter table public.company_settings add column invoice_color text not null default '#257ceb';
alter table public.company_settings add column invoice_theme text not null default 'classique'
  check (invoice_theme in ('classique','moderne','minimal'));

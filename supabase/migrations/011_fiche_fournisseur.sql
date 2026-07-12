-- ============================================================
-- MY EASY STOCK — Migration 011 : Fiche fournisseur complète
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

alter table public.suppliers add column contact_name text; -- interlocuteur habituel
alter table public.suppliers add column address text;      -- adresse (dépôt, showroom…)

comment on column public.suppliers.contact_name is 'Nom de l''interlocuteur chez le fournisseur';
comment on column public.suppliers.address is 'Adresse du fournisseur';

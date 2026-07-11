-- ============================================================
-- MY EASY STOCK — Migration 009 : Fourchette de prix par produit
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

-- Prix de vente minimum et maximum conseillés pour chaque produit.
-- Le prix reste libre à la saisie (vente ou remise de lot), mais
-- l'application signale visuellement tout prix hors fourchette.
alter table public.products add column price_min numeric(10,2);
alter table public.products add column price_max numeric(10,2);

comment on column public.products.price_min is 'Prix de vente minimum conseillé (alerte si prix saisi en dessous)';
comment on column public.products.price_max is 'Prix de vente maximum conseillé (alerte si prix saisi au-dessus)';

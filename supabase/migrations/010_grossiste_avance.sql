-- ============================================================
-- MY EASY STOCK — Migration 010 : Fonctions avancées grossiste
-- Échéances de reversement, paiements rattachés aux lots,
-- paliers de prix par quantité, colisage (cartons),
-- réservations de marchandise, détection du stock dormant.
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

-- ---------- Échéance de reversement sur un lot ----------
alter table public.allocations add column due_date date;
comment on column public.allocations.due_date is 'Date limite convenue pour le reversement du lot';

-- ---------- Paiement rattachable à un lot précis ----------
alter table public.vendor_payments add column allocation_id uuid references public.allocations(id) on delete set null;
create index idx_vendor_payments_allocation on public.vendor_payments(allocation_id);

-- ---------- Colisage : nombre de pièces par carton ----------
alter table public.products add column pack_size int check (pack_size is null or pack_size > 0);
comment on column public.products.pack_size is 'Pièces par carton/pack (vente en gros par colis)';

-- ---------- Paliers de prix par quantité ----------
create table public.product_price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  min_qty int not null check (min_qty > 0),
  price numeric(10,2) not null check (price >= 0),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  unique (product_id, min_qty)
);
alter table public.product_price_tiers enable row level security;
create policy "owner_all_product_price_tiers" on public.product_price_tiers
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create index idx_price_tiers_product on public.product_price_tiers(product_id);
create index idx_price_tiers_owner on public.product_price_tiers(owner_id);

-- ---------- Réservations de marchandise ----------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  qty int not null check (qty > 0),
  note text,
  status text not null default 'active' check (status in ('active','fulfilled','canceled')),
  created_at timestamptz not null default now(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade
);
alter table public.reservations enable row level security;
create policy "owner_all_reservations" on public.reservations
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create index idx_reservations_vendor on public.reservations(vendor_id);
create index idx_reservations_variant on public.reservations(variant_id);
create index idx_reservations_owner on public.reservations(owner_id);

-- ---------- Stock dormant : variantes en stock sans mouvement depuis N jours ----------
-- security invoker : les politiques RLS par compte s'appliquent naturellement.
create or replace function public.get_dormant_stock(p_days int default 60)
returns table (
  variant_id uuid,
  product_id uuid,
  product_name text,
  size text,
  color text,
  stock int,
  purchase_price numeric,
  last_move timestamptz
)
language sql stable as $$
  select
    pv.id as variant_id,
    p.id as product_id,
    p.name as product_name,
    pv.size,
    pv.color,
    pv.stock,
    p.purchase_price,
    m.last_move
  from product_variants pv
  join products p on p.id = pv.product_id
  left join lateral (
    select max(created_at) as last_move from stock_movements sm where sm.variant_id = pv.id
  ) m on true
  where p.archived = false
    and pv.stock > 0
    and coalesce(m.last_move, p.created_at) < now() - make_interval(days => p_days)
  order by coalesce(m.last_move, p.created_at) asc;
$$;

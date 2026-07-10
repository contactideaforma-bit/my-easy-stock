-- ============================================================
-- MY EASY STOCK — Schéma initial
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

-- ---------- PROFILS & RÔLES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'vendeur' check (role in ('admin','vendeur')),
  created_at timestamptz not null default now()
);

-- Création automatique du profil à l'inscription (1er compte = admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'vendeur' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- CATALOGUE ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  brand text,
  image_url text,
  purchase_price numeric(10,2) not null default 0,
  sale_price numeric(10,2) not null default 0,
  low_stock_threshold int not null default 3,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text,
  color text,
  sku text unique,
  barcode text unique,
  stock int not null default 0,
  unique (product_id, size, color)
);
create index idx_variants_barcode on public.product_variants(barcode);
create index idx_variants_product on public.product_variants(product_id);

-- ---------- CLIENTS ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric(10,2) not null,
  method text not null default 'especes' check (method in ('especes','carte')),
  note text,
  created_at timestamptz not null default now()
);

-- ---------- VENTES ----------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  seller_id uuid references public.profiles(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  total numeric(10,2) not null default 0,
  payment_method text not null check (payment_method in ('especes','carte','credit')),
  paid_amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index idx_sales_created on public.sales(created_at);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_label text,
  qty int not null check (qty > 0),
  unit_price numeric(10,2) not null,
  purchase_price numeric(10,2) not null default 0
);

-- ---------- ACHATS FOURNISSEURS ----------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'en_attente' check (status in ('en_attente','recue','annulee')),
  note text,
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  qty int not null check (qty > 0),
  unit_cost numeric(10,2) not null default 0
);

-- ---------- MOUVEMENTS DE STOCK (traçabilité) ----------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  qty_change int not null,
  reason text not null check (reason in ('vente','achat','inventaire','ajustement','retour')),
  ref_id uuid,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_movements_variant on public.stock_movements(variant_id);

-- ---------- INVENTAIRE ----------
create table public.inventory_sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'en_cours' check (status in ('en_cours','cloturee')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.inventory_counts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.inventory_sessions(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  counted_qty int not null default 0,
  expected_qty int not null default 0,
  unique (session_id, variant_id)
);

-- ============================================================
-- FONCTIONS ATOMIQUES (RPC)
-- ============================================================

-- Encaisser une vente : crée la vente + lignes + décrémente le stock
create or replace function public.process_sale(
  p_items jsonb,              -- [{variant_id, qty, unit_price}]
  p_payment_method text,
  p_customer_id uuid default null,
  p_paid_amount numeric default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid;
  v_total numeric := 0;
  it jsonb;
  v_variant record;
  v_qty int;
  v_price numeric;
begin
  -- total
  for it in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (it->>'qty')::int * (it->>'unit_price')::numeric;
  end loop;

  insert into sales (seller_id, customer_id, total, payment_method, paid_amount)
  values (
    auth.uid(), p_customer_id, v_total, p_payment_method,
    coalesce(p_paid_amount, case when p_payment_method = 'credit' then 0 else v_total end)
  ) returning id into v_sale_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    v_price := (it->>'unit_price')::numeric;

    select pv.*, p.name as product_name, p.purchase_price
      into v_variant
      from product_variants pv join products p on p.id = pv.product_id
      where pv.id = (it->>'variant_id')::uuid
      for update;

    if v_variant.id is null then
      raise exception 'Variante introuvable';
    end if;
    if v_variant.stock < v_qty then
      raise exception 'Stock insuffisant pour % (%)', v_variant.product_name, coalesce(v_variant.size,'') || ' ' || coalesce(v_variant.color,'');
    end if;

    insert into sale_items (sale_id, variant_id, product_name, variant_label, qty, unit_price, purchase_price)
    values (
      v_sale_id, v_variant.id, v_variant.product_name,
      nullif(btrim(coalesce(v_variant.size,'') || ' · ' || coalesce(v_variant.color,''), ' ·'), ''),
      v_qty, v_price, v_variant.purchase_price
    );

    update product_variants set stock = stock - v_qty where id = v_variant.id;

    insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
    values (v_variant.id, -v_qty, 'vente', v_sale_id, auth.uid());
  end loop;

  return v_sale_id;
end $$;

-- Ajuster manuellement le stock d'une variante
create or replace function public.adjust_stock(
  p_variant_id uuid,
  p_qty_change int,
  p_reason text default 'ajustement'
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update product_variants set stock = greatest(0, stock + p_qty_change) where id = p_variant_id;
  insert into stock_movements (variant_id, qty_change, reason, user_id)
  values (p_variant_id, p_qty_change, p_reason, auth.uid());
end $$;

-- Réceptionner une commande fournisseur : incrémente le stock
create or replace function public.receive_purchase(p_purchase_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  update purchases set status = 'recue', received_at = now()
  where id = p_purchase_id and status = 'en_attente';
  if not found then
    raise exception 'Commande déjà traitée ou introuvable';
  end if;

  for it in select * from purchase_items where purchase_id = p_purchase_id loop
    update product_variants set stock = stock + it.qty where id = it.variant_id;
    insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
    values (it.variant_id, it.qty, 'achat', p_purchase_id, auth.uid());
  end loop;
end $$;

-- Clôturer un inventaire : ajuste le stock aux quantités comptées
create or replace function public.close_inventory(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare it record; v_diff int;
begin
  update inventory_sessions set status = 'cloturee', closed_at = now()
  where id = p_session_id and status = 'en_cours';
  if not found then
    raise exception 'Session déjà clôturée ou introuvable';
  end if;

  for it in select ic.*, pv.stock from inventory_counts ic
            join product_variants pv on pv.id = ic.variant_id
            where ic.session_id = p_session_id loop
    v_diff := it.counted_qty - it.stock;
    if v_diff <> 0 then
      update product_variants set stock = it.counted_qty where id = it.variant_id;
      insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
      values (it.variant_id, v_diff, 'inventaire', p_session_id, auth.uid());
    end if;
  end loop;
end $$;

-- ============================================================
-- SÉCURITÉ (RLS) — accès réservé aux utilisateurs connectés
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','suppliers','products','product_variants',
    'customers','customer_payments','sales','sale_items',
    'purchases','purchase_items','stock_movements',
    'inventory_sessions','inventory_counts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "authenticated_all_%s" on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- ============================================================
-- STOCKAGE — photos produits
-- ============================================================
insert into storage.buckets (id, name, public) values ('produits', 'produits', true)
on conflict (id) do nothing;

create policy "produits_read" on storage.objects for select using (bucket_id = 'produits');
create policy "produits_write" on storage.objects for insert to authenticated with check (bucket_id = 'produits');
create policy "produits_update" on storage.objects for update to authenticated using (bucket_id = 'produits');
create policy "produits_delete" on storage.objects for delete to authenticated using (bucket_id = 'produits');

-- ============================================================
-- DONNÉES DE DÉPART
-- ============================================================
insert into public.categories (name) values
  ('T-shirts'), ('Pantalons'), ('Robes'), ('Vestes'),
  ('Baskets'), ('Chaussures ville'), ('Sandales'), ('Accessoires');

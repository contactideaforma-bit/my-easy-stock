-- ============================================================
-- MY EASY STOCK — Migration 002 : Vendeurs & lots en dépôt
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

-- ---------- VENDEURS ----------
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Stock détenu par chaque vendeur (par variante)
create table public.vendor_stock (
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  qty int not null default 0,
  primary key (vendor_id, variant_id)
);

-- Lots donnés / retournés
create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  direction text not null default 'sortie' check (direction in ('sortie','retour')),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.allocation_items (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references public.allocations(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  qty int not null check (qty > 0)
);

-- Ventes rattachées à un vendeur (null = vente du dépôt)
alter table public.sales add column vendor_id uuid references public.vendors(id) on delete set null;
create index idx_sales_vendor on public.sales(vendor_id);

-- Nouvelles raisons de mouvement
alter table public.stock_movements drop constraint stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check
  check (reason in ('vente','achat','inventaire','ajustement','retour','affectation','retour_vendeur'));

-- ---------- RPC : donner / reprendre un lot ----------
create or replace function public.allocate_to_vendor(
  p_vendor_id uuid,
  p_items jsonb,            -- [{variant_id, qty}]
  p_direction text default 'sortie'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_alloc_id uuid;
  it jsonb;
  v_variant record;
  v_qty int;
  v_vqty int;
begin
  if p_direction not in ('sortie','retour') then
    raise exception 'Direction invalide';
  end if;

  insert into allocations (vendor_id, direction, created_by)
  values (p_vendor_id, p_direction, auth.uid())
  returning id into v_alloc_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;

    select pv.*, p.name as product_name into v_variant
      from product_variants pv join products p on p.id = pv.product_id
      where pv.id = (it->>'variant_id')::uuid
      for update;

    if v_variant.id is null then
      raise exception 'Variante introuvable';
    end if;

    if p_direction = 'sortie' then
      if v_variant.stock < v_qty then
        raise exception 'Stock dépôt insuffisant pour %', v_variant.product_name;
      end if;
      update product_variants set stock = stock - v_qty where id = v_variant.id;
      insert into vendor_stock (vendor_id, variant_id, qty)
        values (p_vendor_id, v_variant.id, v_qty)
        on conflict (vendor_id, variant_id) do update set qty = vendor_stock.qty + excluded.qty;
      insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
        values (v_variant.id, -v_qty, 'affectation', v_alloc_id, auth.uid());
    else
      select qty into v_vqty from vendor_stock
        where vendor_id = p_vendor_id and variant_id = v_variant.id for update;
      if coalesce(v_vqty, 0) < v_qty then
        raise exception 'Le vendeur ne détient pas assez de « % »', v_variant.product_name;
      end if;
      update vendor_stock set qty = qty - v_qty
        where vendor_id = p_vendor_id and variant_id = v_variant.id;
      update product_variants set stock = stock + v_qty where id = v_variant.id;
      insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
        values (v_variant.id, v_qty, 'retour_vendeur', v_alloc_id, auth.uid());
    end if;

    insert into allocation_items (allocation_id, variant_id, qty)
      values (v_alloc_id, v_variant.id, v_qty);
  end loop;

  return v_alloc_id;
end $$;

-- ---------- RPC : process_sale v2 (vente dépôt OU vente vendeur) ----------
drop function if exists public.process_sale(jsonb, text, uuid, numeric);

create or replace function public.process_sale(
  p_items jsonb,            -- [{variant_id, qty, unit_price}]
  p_payment_method text,
  p_customer_id uuid default null,
  p_paid_amount numeric default null,
  p_vendor_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid;
  v_total numeric := 0;
  it jsonb;
  v_variant record;
  v_qty int;
  v_price numeric;
  v_vqty int;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (it->>'qty')::int * (it->>'unit_price')::numeric;
  end loop;

  insert into sales (seller_id, customer_id, vendor_id, total, payment_method, paid_amount)
  values (
    auth.uid(), p_customer_id, p_vendor_id, v_total, p_payment_method,
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

    if p_vendor_id is null then
      -- vente depuis le dépôt
      if v_variant.stock < v_qty then
        raise exception 'Stock dépôt insuffisant pour %', v_variant.product_name;
      end if;
      update product_variants set stock = stock - v_qty where id = v_variant.id;
      insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
        values (v_variant.id, -v_qty, 'vente', v_sale_id, auth.uid());
    else
      -- vente depuis le stock du vendeur
      select qty into v_vqty from vendor_stock
        where vendor_id = p_vendor_id and variant_id = v_variant.id for update;
      if coalesce(v_vqty, 0) < v_qty then
        raise exception 'Stock vendeur insuffisant pour %', v_variant.product_name;
      end if;
      update vendor_stock set qty = qty - v_qty
        where vendor_id = p_vendor_id and variant_id = v_variant.id;
    end if;

    insert into sale_items (sale_id, variant_id, product_name, variant_label, qty, unit_price, purchase_price)
    values (
      v_sale_id, v_variant.id, v_variant.product_name,
      nullif(btrim(coalesce(v_variant.size,'') || ' · ' || coalesce(v_variant.color,''), ' ·'), ''),
      v_qty, v_price, v_variant.purchase_price
    );
  end loop;

  return v_sale_id;
end $$;

-- ---------- SÉCURITÉ (RLS) ----------
do $$
declare t text;
begin
  foreach t in array array['vendors','vendor_stock','allocations','allocation_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "authenticated_all_%s" on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

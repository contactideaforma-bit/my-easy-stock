-- ============================================================
-- MY EASY STOCK — Migration 005 : Remises & prix convenus
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

-- Remise globale sur une vente (en euros, déduite du total)
alter table public.sales add column discount numeric(10,2) not null default 0;

-- Prix convenu avec le vendeur (fixé lors de la remise d'un lot,
-- proposé par défaut lors de l'enregistrement de ses ventes)
alter table public.vendor_stock add column agreed_price numeric(10,2);
alter table public.allocation_items add column agreed_price numeric(10,2);

-- ---------- allocate_to_vendor v2 : accepte un prix convenu ----------
create or replace function public.allocate_to_vendor(
  p_vendor_id uuid,
  p_items jsonb,            -- [{variant_id, qty, agreed_price?}]
  p_direction text default 'sortie'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_alloc_id uuid;
  it jsonb;
  v_variant record;
  v_qty int;
  v_vqty int;
  v_price numeric;
begin
  if p_direction not in ('sortie','retour') then
    raise exception 'Direction invalide';
  end if;

  insert into allocations (vendor_id, direction, created_by)
  values (p_vendor_id, p_direction, auth.uid())
  returning id into v_alloc_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    v_price := nullif(it->>'agreed_price','')::numeric;

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
      insert into vendor_stock (vendor_id, variant_id, qty, agreed_price)
        values (p_vendor_id, v_variant.id, v_qty, v_price)
        on conflict (vendor_id, variant_id) do update
          set qty = vendor_stock.qty + excluded.qty,
              agreed_price = coalesce(excluded.agreed_price, vendor_stock.agreed_price);
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

    insert into allocation_items (allocation_id, variant_id, qty, agreed_price)
      values (v_alloc_id, v_variant.id, v_qty, v_price);
  end loop;

  return v_alloc_id;
end $$;

-- ---------- process_sale v3 : remise globale ----------
drop function if exists public.process_sale(jsonb, text, uuid, numeric, uuid);

create or replace function public.process_sale(
  p_items jsonb,            -- [{variant_id, qty, unit_price}]
  p_payment_method text,
  p_customer_id uuid default null,
  p_paid_amount numeric default null,
  p_vendor_id uuid default null,
  p_discount numeric default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_sale_id uuid;
  v_total numeric := 0;
  v_discount numeric := greatest(0, coalesce(p_discount, 0));
  it jsonb;
  v_variant record;
  v_qty int;
  v_price numeric;
  v_vqty int;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    v_total := v_total + (it->>'qty')::int * (it->>'unit_price')::numeric;
  end loop;
  v_discount := least(v_discount, v_total);
  v_total := v_total - v_discount;

  insert into sales (seller_id, customer_id, vendor_id, total, discount, payment_method, paid_amount)
  values (
    auth.uid(), p_customer_id, p_vendor_id, v_total, v_discount, p_payment_method,
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
      if v_variant.stock < v_qty then
        raise exception 'Stock dépôt insuffisant pour %', v_variant.product_name;
      end if;
      update product_variants set stock = stock - v_qty where id = v_variant.id;
      insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
        values (v_variant.id, -v_qty, 'vente', v_sale_id, auth.uid());
    else
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

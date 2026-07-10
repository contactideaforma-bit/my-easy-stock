-- ============================================================
-- MY EASY STOCK — Migration 006 : Reversement défini sur le lot
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

-- Mode de reversement convenu avec le revendeur pour ce lot :
--  'ventes'      : au réel — le dû suit les ventes enregistrées (comportement historique)
--  'montant'     : forfait — le revendeur doit un montant fixe pour ce lot
--  'pourcentage' : forfait — % de la valeur du lot (dû figé à la remise du lot)
alter table public.allocations add column due_type text not null default 'ventes'
  check (due_type in ('ventes','montant','pourcentage'));
alter table public.allocations add column due_rate numeric(5,2);    -- % saisi (si pourcentage)
alter table public.allocations add column due_amount numeric(10,2); -- dû en € (forfaits)

-- ---------- allocate_to_vendor v3 : mode de reversement ----------
drop function if exists public.allocate_to_vendor(uuid, jsonb, text);

create or replace function public.allocate_to_vendor(
  p_vendor_id uuid,
  p_items jsonb,            -- [{variant_id, qty, agreed_price?}]
  p_direction text default 'sortie',
  p_due_type text default 'ventes',
  p_due_rate numeric default null,
  p_due_amount numeric default null
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
  if p_due_type not in ('ventes','montant','pourcentage') then
    raise exception 'Mode de reversement invalide';
  end if;

  insert into allocations (vendor_id, direction, created_by, due_type, due_rate, due_amount)
  values (
    p_vendor_id, p_direction, auth.uid(),
    case when p_direction = 'retour' then 'ventes' else p_due_type end,
    p_due_rate,
    case when p_direction = 'retour' then null else p_due_amount end
  )
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

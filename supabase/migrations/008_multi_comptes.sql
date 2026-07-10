-- ============================================================
-- MY EASY STOCK — Migration 008 : CLOISONNEMENT PAR COMPTE
-- Chaque utilisateur ne voit et ne modifie QUE ses propres données.
-- Les données existantes sont rattachées au compte le plus ancien.
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

do $$
declare
  v_first uuid;
  t text;
begin
  -- Compte le plus ancien = propriétaire des données existantes
  select id into v_first from public.profiles order by created_at asc limit 1;

  foreach t in array array[
    'categories','suppliers','products','product_variants',
    'customers','customer_payments','sales','sale_items',
    'purchases','purchase_items','stock_movements',
    'inventory_sessions','inventory_counts',
    'vendors','vendor_stock','allocations','allocation_items','vendor_payments'
  ] loop
    execute format('alter table public.%I add column owner_id uuid references auth.users(id) on delete cascade', t);
    if v_first is not null then
      execute format('update public.%I set owner_id = %L where owner_id is null', t, v_first);
    else
      execute format('delete from public.%I where owner_id is null', t);
    end if;
    execute format('alter table public.%I alter column owner_id set not null', t);
    execute format('alter table public.%I alter column owner_id set default auth.uid()', t);
    execute format('drop policy if exists "authenticated_all_%s" on public.%I', t, t);
    execute format(
      'create policy "owner_all_%s" on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      t, t
    );
    execute format('create index if not exists idx_%s_owner on public.%I(owner_id)', t, t);
  end loop;

  -- ---------- company_settings : une fiche par compte ----------
  alter table public.company_settings drop constraint if exists company_settings_id_check;
  alter table public.company_settings add column owner_id uuid references auth.users(id) on delete cascade;
  if v_first is not null then
    update public.company_settings set owner_id = v_first where owner_id is null;
  end if;
  delete from public.company_settings where owner_id is null;
  alter table public.company_settings alter column owner_id set not null;
  alter table public.company_settings alter column owner_id set default auth.uid();
  alter table public.company_settings drop constraint company_settings_pkey;
  alter table public.company_settings add primary key (owner_id);
  alter table public.company_settings drop column id;
  drop policy if exists "authenticated_all_company_settings" on public.company_settings;
  create policy "owner_all_company_settings" on public.company_settings
    for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
end $$;

-- ---------- profils : chacun ne voit que le sien ----------
drop policy if exists "authenticated_all_profiles" on public.profiles;
create policy "owner_all_profiles" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- unicités par compte (et non plus globales) ----------
alter table public.categories drop constraint if exists categories_name_key;
alter table public.categories add constraint categories_owner_name_key unique (owner_id, name);
alter table public.product_variants drop constraint if exists product_variants_sku_key;
alter table public.product_variants add constraint variants_owner_sku_key unique (owner_id, sku);
alter table public.product_variants drop constraint if exists product_variants_barcode_key;
alter table public.product_variants add constraint variants_owner_barcode_key unique (owner_id, barcode);

-- ---------- nouveau compte : admin de sa propre boutique, prêt à l'emploi ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'admin');

  insert into public.categories (name, owner_id)
  select unnest(array['T-shirts','Pantalons','Robes','Vestes','Baskets','Chaussures ville','Sandales','Accessoires']), new.id;

  insert into public.company_settings (owner_id, name) values (new.id, 'Ma Société');
  return new;
end $$;

-- ============================================================
-- FONCTIONS MÉTIER v4 : verrouillées sur le compte appelant
-- ============================================================

create or replace function public.process_sale(
  p_items jsonb,
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
  if p_vendor_id is not null and not exists (select 1 from vendors where id = p_vendor_id and owner_id = auth.uid()) then
    raise exception 'Vendeur introuvable';
  end if;
  if p_customer_id is not null and not exists (select 1 from customers where id = p_customer_id and owner_id = auth.uid()) then
    raise exception 'Client introuvable';
  end if;

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
      where pv.id = (it->>'variant_id')::uuid and pv.owner_id = auth.uid()
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
        where vendor_id = p_vendor_id and variant_id = v_variant.id and owner_id = auth.uid() for update;
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

create or replace function public.adjust_stock(
  p_variant_id uuid,
  p_qty_change int,
  p_reason text default 'ajustement'
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update product_variants set stock = greatest(0, stock + p_qty_change)
  where id = p_variant_id and owner_id = auth.uid();
  if not found then
    raise exception 'Variante introuvable';
  end if;
  insert into stock_movements (variant_id, qty_change, reason, user_id)
  values (p_variant_id, p_qty_change, p_reason, auth.uid());
end $$;

create or replace function public.receive_purchase(p_purchase_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare it record;
begin
  update purchases set status = 'recue', received_at = now()
  where id = p_purchase_id and status = 'en_attente' and owner_id = auth.uid();
  if not found then
    raise exception 'Commande déjà traitée ou introuvable';
  end if;

  for it in select * from purchase_items where purchase_id = p_purchase_id loop
    update product_variants set stock = stock + it.qty where id = it.variant_id and owner_id = auth.uid();
    insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
    values (it.variant_id, it.qty, 'achat', p_purchase_id, auth.uid());
  end loop;
end $$;

create or replace function public.close_inventory(p_session_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare it record; v_diff int;
begin
  update inventory_sessions set status = 'cloturee', closed_at = now()
  where id = p_session_id and status = 'en_cours' and owner_id = auth.uid();
  if not found then
    raise exception 'Session déjà clôturée ou introuvable';
  end if;

  for it in select ic.*, pv.stock from inventory_counts ic
            join product_variants pv on pv.id = ic.variant_id
            where ic.session_id = p_session_id and pv.owner_id = auth.uid() loop
    v_diff := it.counted_qty - it.stock;
    if v_diff <> 0 then
      update product_variants set stock = it.counted_qty where id = it.variant_id;
      insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
      values (it.variant_id, v_diff, 'inventaire', p_session_id, auth.uid());
    end if;
  end loop;
end $$;

create or replace function public.allocate_to_vendor(
  p_vendor_id uuid,
  p_items jsonb,
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
  if not exists (select 1 from vendors where id = p_vendor_id and owner_id = auth.uid()) then
    raise exception 'Vendeur introuvable';
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
      where pv.id = (it->>'variant_id')::uuid and pv.owner_id = auth.uid()
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
        where vendor_id = p_vendor_id and variant_id = v_variant.id and owner_id = auth.uid() for update;
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

create or replace function public.cancel_sale(p_sale_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sale record;
  it record;
begin
  select * into v_sale from sales where id = p_sale_id and owner_id = auth.uid() for update;
  if v_sale.id is null then
    raise exception 'Vente introuvable';
  end if;
  if v_sale.canceled_at is not null then
    raise exception 'Cette vente est déjà annulée';
  end if;

  for it in select * from sale_items where sale_id = p_sale_id and variant_id is not null loop
    if v_sale.vendor_id is null then
      update product_variants set stock = stock + it.qty where id = it.variant_id and owner_id = auth.uid();
      insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
      values (it.variant_id, it.qty, 'retour', p_sale_id, auth.uid());
    else
      insert into vendor_stock (vendor_id, variant_id, qty)
      values (v_sale.vendor_id, it.variant_id, it.qty)
      on conflict (vendor_id, variant_id) do update set qty = vendor_stock.qty + excluded.qty;
    end if;
  end loop;

  update sales set canceled_at = now(), canceled_by = auth.uid() where id = p_sale_id;
end $$;

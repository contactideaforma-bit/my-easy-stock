-- ============================================================
-- MY EASY STOCK — Migration 003 : Reversements vendeurs + Annulation de vente
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

-- ---------- REVERSEMENTS VENDEURS ----------
-- Ce que le vendeur remet au grossiste sur ses ventes
create table public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_vendor_payments_vendor on public.vendor_payments(vendor_id);

alter table public.vendor_payments enable row level security;
create policy "authenticated_all_vendor_payments" on public.vendor_payments
  for all to authenticated using (true) with check (true);

-- ---------- ANNULATION DE VENTE ----------
alter table public.sales add column canceled_at timestamptz;
alter table public.sales add column canceled_by uuid references public.profiles(id) on delete set null;

-- Annule une vente : remet la marchandise en stock (dépôt ou vendeur)
create or replace function public.cancel_sale(p_sale_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sale record;
  it record;
begin
  select * into v_sale from sales where id = p_sale_id for update;
  if v_sale.id is null then
    raise exception 'Vente introuvable';
  end if;
  if v_sale.canceled_at is not null then
    raise exception 'Cette vente est déjà annulée';
  end if;

  for it in select * from sale_items where sale_id = p_sale_id and variant_id is not null loop
    if v_sale.vendor_id is null then
      -- retour au dépôt
      update product_variants set stock = stock + it.qty where id = it.variant_id;
      insert into stock_movements (variant_id, qty_change, reason, ref_id, user_id)
      values (it.variant_id, it.qty, 'retour', p_sale_id, auth.uid());
    else
      -- retour dans le stock du vendeur
      insert into vendor_stock (vendor_id, variant_id, qty)
      values (v_sale.vendor_id, it.variant_id, it.qty)
      on conflict (vendor_id, variant_id) do update set qty = vendor_stock.qty + excluded.qty;
    end if;
  end loop;

  update sales set canceled_at = now(), canceled_by = auth.uid() where id = p_sale_id;
end $$;

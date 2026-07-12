-- ============================================================
-- MY EASY STOCK — Remise à zéro du compte démo
-- Supprime TOUTES les données du compte indiqué (produits, ventes,
-- revendeurs, clients, achats, réservations…) en conservant le compte,
-- ses catégories et son profil société.
-- À exécuter AVANT de relancer seed_demo.sql pour repartir propre.
-- ============================================================

do $$
declare
  v_demo_email text := 'webideaforma@gmail.com';   -- ⬅️ EMAIL DU COMPTE DÉMO
  v_owner uuid;
begin
  select id into v_owner from auth.users where email = v_demo_email;
  if v_owner is null then
    raise exception 'Utilisateur % introuvable.', v_demo_email;
  end if;

  -- Ordre : d'abord les tables qui référencent, puis les tables mères
  delete from sale_items        where owner_id = v_owner;
  delete from sales             where owner_id = v_owner;
  delete from vendor_payments   where owner_id = v_owner;
  delete from allocation_items  where owner_id = v_owner;
  delete from allocations       where owner_id = v_owner;
  delete from vendor_stock      where owner_id = v_owner;
  delete from reservations      where owner_id = v_owner;
  delete from purchase_items    where owner_id = v_owner;
  delete from purchases         where owner_id = v_owner;
  delete from inventory_counts  where owner_id = v_owner;
  delete from inventory_sessions where owner_id = v_owner;
  delete from stock_movements   where owner_id = v_owner;
  delete from customer_payments where owner_id = v_owner;
  delete from product_price_tiers where owner_id = v_owner;
  delete from product_variants  where owner_id = v_owner;
  delete from products          where owner_id = v_owner;
  delete from customers         where owner_id = v_owner;
  delete from vendors           where owner_id = v_owner;
  delete from suppliers         where owner_id = v_owner;

  raise notice 'Compte démo % vidé — relancez seed_demo.sql.', v_demo_email;
end $$;

-- ============================================================
-- MY EASY STOCK — Jeu de données DÉMO « Maison Riviera »
-- À exécuter dans Supabase : SQL Editor > New query > Run
--
-- ⚠️ Ce script AJOUTE des données fictives (~100 produits, clients,
--    revendeurs, ventes, achats) à la base actuelle, aux côtés des
--    données existantes. Il remplace aussi le profil société par la
--    société fictive « Maison Riviera » (re-personnalisable ensuite
--    depuis Plus > Profil société).
-- Images : loremflickr.com (photos Flickr sous licence Creative Commons).
--
-- MULTI-COMPTES : les données créées appartiennent au compte démo.
-- 1) Créez d'abord l'utilisateur démo (Authentication → Users → Add user)
-- 2) Remplacez l'email ci-dessous par le sien, puis exécutez le script.
-- ============================================================

do $$
declare
  v_demo_email text := 'demo@ideaforma.fr';   -- ⬅️ EMAIL DU COMPTE DÉMO
  v_owner uuid;
  cat record;
  kw text;
  pnames text[];
  brands text[] := array['Riviera','Milano','Urban Nord','Atelier 12','Costa','Nova','Saint-Louis','Belleface'];
  colors_all text[] := array['Noir','Blanc','Beige','Bleu marine','Bleu','Rouge','Vert','Rose','Gris','Marron','Kaki','Bordeaux'];
  sizes_v text[];
  n text;
  i int := 0;
  j int;
  k int;
  v_pid uuid;
  v_purchase numeric;
  v_sale numeric;
  c1 text; c2 text;
  -- vendeurs / clients / ventes
  vend_ids uuid[] := '{}';
  cust_ids uuid[] := '{}';
  v_vid uuid;
  v_cid uuid;
  v_variant record;
  v_sale_id uuid;
  v_total numeric;
  v_disc numeric;
  v_date timestamptz;
  v_method text;
  v_stock_val numeric;
  sup_ids uuid[] := '{}';
  v_sup uuid;
  v_purch uuid;
begin
  -- ---------- COMPTE PROPRIÉTAIRE ----------
  select id into v_owner from auth.users where email = v_demo_email;
  if v_owner is null then
    raise exception 'Utilisateur % introuvable — créez-le d''abord (Authentication → Users → Add user).', v_demo_email;
  end if;
  -- Toutes les insertions ci-dessous seront rattachées à ce compte
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);

  -- ---------- SOCIÉTÉ FICTIVE ----------
  insert into company_settings (owner_id) values (v_owner) on conflict (owner_id) do nothing;
  update company_settings set
    name = 'Maison Riviera',
    legal_form = 'SARL au capital de 10 000 €',
    address = e'14 rue du Textile\n13001 Marseille',
    phone = '04 91 00 00 00',
    email = 'contact@maison-riviera.demo',
    siret = '123 456 789 00012',
    vat_number = 'FR12 123456789',
    vat_rate = 20,
    iban = 'FR76 3000 0000 0000 0000 0000 000',
    bic = 'DEMOFRPP',
    invoice_footer = 'Document de démonstration — données fictives.',
    invoice_color = '#0f766e',
    invoice_theme = 'moderne'
  where owner_id = v_owner;

  -- Catégories de base si le compte n'en a pas encore
  insert into categories (name, owner_id)
  select unnest(array['T-shirts','Pantalons','Robes','Vestes','Baskets','Chaussures ville','Sandales','Accessoires']), v_owner
  where not exists (select 1 from categories where owner_id = v_owner);

  -- ---------- PRODUITS (~100) ----------
  for cat in select * from categories where owner_id = v_owner order by name loop
    kw := case cat.name
      when 'T-shirts' then 'tshirt'
      when 'Pantalons' then 'jeans'
      when 'Robes' then 'dress'
      when 'Vestes' then 'jacket'
      when 'Baskets' then 'sneakers'
      when 'Chaussures ville' then 'shoes'
      when 'Sandales' then 'sandals'
      when 'Accessoires' then 'handbag'
      else 'clothes' end;

    pnames := case cat.name
      when 'T-shirts' then array['T-shirt coton bio','T-shirt col V','T-shirt oversize','T-shirt rayé marin','T-shirt imprimé palme','Polo piqué','T-shirt manches longues','T-shirt sport respirant','T-shirt col roulé léger','T-shirt poche poitrine','T-shirt délavé vintage','T-shirt enfant licorne','Débardeur côtelé']
      when 'Pantalons' then array['Jean slim brut','Jean regular délavé','Chino beige','Pantalon cargo','Jogging molleton','Pantalon tailleur','Jean mom taille haute','Short en jean','Pantalon lin été','Legging sport','Jean skinny noir','Pantalon large fluide','Bermuda cargo']
      when 'Robes' then array['Robe été fleurie','Robe longue bohème','Robe portefeuille','Robe pull côtelée','Robe chemise','Robe de soirée satinée','Robe midi plissée','Robe droite bureau','Robe volants','Robe dos nu','Robe tricot hiver','Robe enfant princesse','Combinaison pantalon']
      when 'Vestes' then array['Veste en jean','Blouson bomber','Doudoune légère','Manteau long laine','Blazer cintré','Veste simili cuir','Coupe-vent pliable','Gilet sans manches','Cardigan grosse maille','Trench beige','Parka fourrée','Veste de survêtement','Kimono léger']
      when 'Baskets' then array['Baskets Runner','Baskets toile basses','Baskets montantes','Baskets running pro','Baskets plateforme','Baskets cuir blanches','Baskets enfant scratch','Baskets slip-on','Baskets trail','Baskets rétro 90s','Baskets chaussette','Baskets éco-recyclées']
      when 'Chaussures ville' then array['Derbies cuir','Mocassins souples','Bottines Chelsea','Richelieu vernis','Bottes cavalières','Escarpins 7 cm','Ballerines classiques','Chaussures bateau','Boots desert','Babies vernies','Mules talon carré','Bottines lacets']
      when 'Sandales' then array['Sandales plates cuir','Sandales compensées','Tongs plage','Sandales bride cheville','Claquettes sport','Sandales enfant','Espadrilles unies','Sandales talon bloc','Mules plates','Sandales randonnée','Nu-pieds perles','Sabots été']
      when 'Accessoires' then array['Sac à main cuir','Sac banane','Ceinture réversible','Écharpe laine','Casquette brodée','Bonnet pompon','Portefeuille zippé','Sac cabas toile','Foulard soie','Gants tactiles','Chaussettes lot de 5','Cabas paille','Pochette soirée']
      else array['Article'] end;

    sizes_v := case
      when cat.name in ('Baskets','Chaussures ville') then array['39','40','41','42','43','44']
      when cat.name = 'Sandales' then array['36','37','38','39','40','41']
      when cat.name = 'Robes' then array['36','38','40','42']
      when cat.name = 'Pantalons' then array['38','40','42','44']
      when cat.name = 'Accessoires' then array[]::text[]
      else array['S','M','L','XL'] end;

    foreach n in array pnames loop
      i := i + 1;
      v_purchase := round((3 + random() * 22)::numeric, 2);
      v_sale := round((v_purchase * (1.9 + random() * 1.1))::numeric / 0.5) * 0.5;

      insert into products (name, brand, category_id, purchase_price, sale_price, low_stock_threshold, image_url)
      values (
        n,
        brands[1 + floor(random() * array_length(brands, 1))::int],
        cat.id,
        v_purchase,
        v_sale,
        3,
        'https://loremflickr.com/480/480/' || kw || '?lock=' || i
      )
      returning id into v_pid;

      -- 2 couleurs distinctes
      c1 := colors_all[1 + floor(random() * 12)::int];
      loop
        c2 := colors_all[1 + floor(random() * 12)::int];
        exit when c2 <> c1;
      end loop;

      if array_length(sizes_v, 1) is null then
        insert into product_variants (product_id, size, color, sku, stock)
        values
          (v_pid, null, c1, 'DEMO-' || i || '-A', 3 + floor(random() * 10)::int),
          (v_pid, null, c2, 'DEMO-' || i || '-B', 3 + floor(random() * 10)::int);
      else
        for j in 1 .. array_length(sizes_v, 1) loop
          insert into product_variants (product_id, size, color, sku, stock)
          values
            (v_pid, sizes_v[j], c1, 'DEMO-' || i || '-' || j || 'A', 1 + floor(random() * 8)::int),
            (v_pid, sizes_v[j], c2, 'DEMO-' || i || '-' || j || 'B', 1 + floor(random() * 8)::int);
        end loop;
      end if;
    end loop;
  end loop;

  -- ---------- CLIENTS (12) ----------
  insert into customers (name, first_name, phone, email, address) values
    ('Martin','Claire','06 11 22 33 01','claire.martin@mail.demo','8 rue des Lilas, 13005 Marseille'),
    ('Benali','Yasmine','06 11 22 33 02','y.benali@mail.demo','22 av. de la Plage, 13008 Marseille'),
    ('Rossi','Marco','06 11 22 33 03','marco.rossi@mail.demo','3 place du Marché, 13002 Marseille'),
    ('Dubois','Pauline','06 11 22 33 04','pauline.d@mail.demo','15 bd Longchamp, 13001 Marseille'),
    ('N''Diaye','Awa','06 11 22 33 05','awa.ndiaye@mail.demo','40 rue de Rome, 13006 Marseille'),
    ('Garcia','Lucas','06 11 22 33 06','l.garcia@mail.demo','7 rue Paradis, 13001 Marseille'),
    ('Petit','Emma','06 11 22 33 07','emma.petit@mail.demo','12 cours Julien, 13006 Marseille'),
    ('Haddad','Karim','06 11 22 33 08','k.haddad@mail.demo','5 rue d''Endoume, 13007 Marseille'),
    ('Leroy','Sophie','06 11 22 33 09','s.leroy@mail.demo','30 av. du Prado, 13008 Marseille'),
    ('Nguyen','Linh','06 11 22 33 10','linh.n@mail.demo','18 rue Sainte, 13001 Marseille'),
    ('Moreau','Julien','06 11 22 33 11','j.moreau@mail.demo','2 rue Consolat, 13001 Marseille'),
    ('Kone','Fatou','06 11 22 33 12','fatou.k@mail.demo','25 bd Baille, 13005 Marseille');
  select array_agg(id) into cust_ids from customers where owner_id = v_owner;

  -- ---------- REVENDEURS (6) + stock confié + forfaits ----------
  insert into vendors (name, phone) values
    ('Amina', '06 20 00 00 01'), ('Karim', '06 20 00 00 02'), ('Fatou', '06 20 00 00 03'),
    ('Mehdi', '06 20 00 00 04'), ('Sonia', '06 20 00 00 05'), ('Ibrahim','06 20 00 00 06');
  select array_agg(id order by name) into vend_ids from vendors where owner_id = v_owner;

  for j in 1 .. array_length(vend_ids, 1) loop
    v_vid := vend_ids[j];
    v_stock_val := 0;

    for v_variant in
      select pv.id, p.sale_price from product_variants pv
      join products p on p.id = pv.product_id
      where pv.stock > 2 and pv.owner_id = v_owner
      order by random() limit 10
    loop
      k := 1 + floor(random() * 4)::int;
      insert into vendor_stock (vendor_id, variant_id, qty, agreed_price)
      values (v_vid, v_variant.id, k, round(v_variant.sale_price * 0.8 / 0.5) * 0.5)
      on conflict (vendor_id, variant_id) do nothing;
      update product_variants set stock = greatest(0, stock - k) where id = v_variant.id;
      v_stock_val := v_stock_val + k * round(v_variant.sale_price * 0.8 / 0.5) * 0.5;
    end loop;

    -- un lot « historique » par vendeur, modes variés
    insert into allocations (vendor_id, direction, due_type, due_rate, due_amount, created_at)
    values (
      v_vid, 'sortie',
      case j % 3 when 0 then 'ventes' when 1 then 'pourcentage' else 'montant' end,
      case j % 3 when 1 then 60 else null end,
      case j % 3 when 0 then null when 1 then round(v_stock_val * 0.6) else round(v_stock_val * 0.55) end,
      now() - interval '25 days'
    );
  end loop;

  -- ---------- VENTES (48 sur 60 jours) ----------
  for j in 1 .. 48 loop
    v_date := now() - (random() * 60 || ' days')::interval;
    v_total := 0;
    v_disc := case when random() < 0.25 then round((2 + random() * 8)::numeric) else 0 end;
    v_method := (array['especes','especes','carte','carte','especes'])[1 + floor(random() * 5)::int];

    if j % 2 = 0 then
      v_vid := vend_ids[1 + floor(random() * 6)::int];
      v_cid := null;
    else
      v_vid := null;
      v_cid := case when random() < 0.5 then cust_ids[1 + floor(random() * 12)::int] else null end;
      if j % 9 = 0 and v_cid is not null then v_method := 'credit'; end if;
    end if;

    insert into sales (customer_id, vendor_id, total, discount, payment_method, paid_amount, created_at)
    values (v_cid, v_vid, 0, v_disc, v_method, 0, v_date)
    returning id into v_sale_id;

    for v_variant in
      select pv.id, pv.size, pv.color, p.name, p.sale_price, p.purchase_price
      from product_variants pv join products p on p.id = pv.product_id
      where pv.owner_id = v_owner
      order by random() limit 1 + floor(random() * 3)::int
    loop
      k := 1 + floor(random() * 2)::int;
      insert into sale_items (sale_id, variant_id, product_name, variant_label, qty, unit_price, purchase_price)
      values (
        v_sale_id, v_variant.id, v_variant.name,
        nullif(btrim(coalesce(v_variant.size,'') || ' · ' || coalesce(v_variant.color,''), ' ·'), ''),
        k, v_variant.sale_price, v_variant.purchase_price
      );
      v_total := v_total + k * v_variant.sale_price;
    end loop;

    v_disc := least(v_disc, v_total);
    update sales set
      total = v_total - v_disc,
      discount = v_disc,
      paid_amount = case when v_method = 'credit' then 0 else v_total - v_disc end
    where id = v_sale_id;
  end loop;

  -- ---------- REVERSEMENTS partiels ----------
  insert into vendor_payments (vendor_id, amount, created_at)
  select vend_ids[gs], round((40 + random() * 120)::numeric), now() - (random() * 20 || ' days')::interval
  from generate_series(1, 4) as gs;

  -- ---------- FOURNISSEURS + ACHATS reçus ----------
  insert into suppliers (name, phone, email) values
    ('Textile Import Sud','04 91 55 00 01','contact@tis.demo'),
    ('Grossiste Chauss''Pro','04 91 55 00 02','pro@chausspro.demo'),
    ('Milano Fashion Export','04 91 55 00 03','export@milanofashion.demo');
  select array_agg(id) into sup_ids from suppliers where owner_id = v_owner;

  for j in 1 .. 3 loop
    insert into purchases (supplier_id, status, created_at, received_at)
    values (sup_ids[j], 'recue', now() - ((30 + j * 8) || ' days')::interval, now() - ((28 + j * 8) || ' days')::interval)
    returning id into v_purch;

    for v_variant in
      select pv.id, p.purchase_price from product_variants pv
      join products p on p.id = pv.product_id
      where pv.owner_id = v_owner order by random() limit 4
    loop
      insert into purchase_items (purchase_id, variant_id, qty, unit_cost)
      values (v_purch, v_variant.id, 5 + floor(random() * 10)::int, v_variant.purchase_price);
    end loop;
  end loop;

  raise notice 'Seed démo terminé : % produits créés.', i;
end $$;

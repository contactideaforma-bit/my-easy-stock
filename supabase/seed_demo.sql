-- ============================================================
-- MY EASY STOCK — Jeu de données DÉMO « Maison Riviera »
-- À exécuter dans Supabase : SQL Editor > New query > Run
--
-- ⚠️ Ce script AJOUTE des données fictives (10 références × ~350
--    déclinaisons, plusieurs milliers de pièces, clients, revendeurs,
--    ventes, achats) à la base actuelle, aux côtés des
--    données existantes. Il remplace aussi le profil société par la
--    société fictive « Maison Riviera » (re-personnalisable ensuite
--    depuis Plus > Profil société).
-- Images : photos Unsplash sélectionnées par catégorie (URLs fixes et
--          vérifiées, correspondant au type d'article représenté).
--
-- MULTI-COMPTES : les données créées appartiennent au compte démo.
-- 1) Créez d'abord l'utilisateur démo (Authentication → Users → Add user)
-- 2) Remplacez l'email ci-dessous par le sien, puis exécutez le script.
-- ============================================================

do $$
declare
  v_demo_email text := 'webideaforma@gmail.com';   -- ⬅️ EMAIL DU COMPTE DÉMO
  v_owner uuid;
  cat record;
  spec jsonb;
  v_cat uuid;
  v_color text;
  v_size text;
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

  -- ---------- PRODUITS : 10 références × nombreuses déclinaisons ----------
  -- Structure type grossiste : peu de modèles, beaucoup de couleurs et tailles,
  -- 10 à 50 pièces par déclinaison (plusieurs milliers de pièces au total).
  for spec in select * from jsonb_array_elements('[
    {"name":"Baskets Runner X","brand":"Nova","cat":"Baskets","purchase":12.50,"sale":29.50,"min":25,"max":35,"pack":12,"qty":20,
     "sizes":["35","36","37","38","39","40"],
     "colors":["Noir","Blanc","Rouge","Bleu","Bleu marine","Vert","Gris","Rose","Jaune","Bordeaux"],
     "img":"photo-1542291026-7eec264c27ff"},
    {"name":"Baskets toile basses","brand":"Urban Nord","cat":"Baskets","purchase":8.90,"sale":22.00,"min":18,"max":26,"pack":12,"qty":20,
     "sizes":["36","37","38","39","40","41"],
     "colors":["Noir","Blanc","Beige","Bleu","Rouge","Kaki","Rose","Gris"],
     "img":"photo-1549298916-b41d501d3772"},
    {"name":"Sandales plates été","brand":"Costa","cat":"Sandales","purchase":6.40,"sale":16.50,"min":13,"max":19,"pack":10,"qty":15,
     "sizes":["36","37","38","39","40","41"],
     "colors":["Noir","Doré","Argenté","Beige","Blanc","Marron"],
     "img":"photo-1603487742131-4160ec999306"},
    {"name":"T-shirt coton premium","brand":"Riviera","cat":"T-shirts","purchase":3.20,"sale":9.50,"min":7.5,"max":12,"pack":25,"qty":30,
     "sizes":["XS","S","M","L","XL","XXL"],
     "colors":["Blanc","Noir","Gris","Bleu marine","Rouge","Vert","Jaune","Rose"],
     "img":"photo-1521572163474-6864f9cf17ab"},
    {"name":"Jean slim stretch","brand":"Milano","cat":"Pantalons","purchase":11.50,"sale":27.00,"min":23,"max":32,"pack":10,"qty":25,
     "sizes":["36","38","40","42","44","46"],
     "colors":["Bleu","Bleu marine","Noir","Gris"],
     "img":"photo-1541099649105-f69ad21f3246"},
    {"name":"Robe été fleurie","brand":"Belleface","cat":"Robes","purchase":8.40,"sale":21.50,"min":18,"max":25,"pack":8,"qty":15,
     "sizes":["36","38","40","42","44"],
     "colors":["Multicolore","Rose","Bleu","Rouge","Blanc","Vert"],
     "img":"photo-1595777457583-95e059d581b8"},
    {"name":"Sweat capuche molleton","brand":"Urban Nord","cat":"T-shirts","purchase":9.60,"sale":24.00,"min":20,"max":28,"pack":12,"qty":25,
     "sizes":["S","M","L","XL","XXL"],
     "colors":["Noir","Gris","Bordeaux","Bleu marine","Kaki","Blanc"],
     "img":"photo-1576566588028-4147f3842f27"},
    {"name":"Veste simili cuir","brand":"Saint-Louis","cat":"Vestes","purchase":18.90,"sale":45.00,"min":39,"max":55,"pack":6,"qty":10,
     "sizes":["S","M","L","XL"],
     "colors":["Noir","Marron","Bordeaux"],
     "img":"photo-1551028719-00167b16eac5"},
    {"name":"Sac à main city","brand":"Riviera","cat":"Accessoires","purchase":7.80,"sale":19.50,"min":16,"max":24,"pack":10,"qty":40,
     "sizes":[],
     "colors":["Noir","Marron","Beige","Rouge","Bleu marine","Doré","Blanc","Rose"],
     "img":"photo-1584917865442-de89df76afd3"},
    {"name":"Casquette brodée","brand":"Nova","cat":"Accessoires","purchase":2.60,"sale":8.00,"min":6,"max":10,"pack":24,"qty":50,
     "sizes":[],
     "colors":["Noir","Blanc","Rouge","Bleu","Bleu marine","Vert","Gris","Rose","Jaune","Kaki"],
     "img":"photo-1553062407-98eeb64c6a62"}
  ]'::jsonb) loop
    i := i + 1;

    select id into v_cat from categories where owner_id = v_owner and name = spec->>'cat' limit 1;

    insert into products (name, brand, category_id, purchase_price, sale_price, price_min, price_max, pack_size, low_stock_threshold, image_url)
    values (
      spec->>'name',
      spec->>'brand',
      v_cat,
      (spec->>'purchase')::numeric,
      (spec->>'sale')::numeric,
      (spec->>'min')::numeric,
      (spec->>'max')::numeric,
      (spec->>'pack')::int,
      5,
      'https://images.unsplash.com/' || (spec->>'img') || '?w=480&q=80&auto=format&fit=crop'
    )
    returning id into v_pid;

    -- Une variante par couleur × taille, avec la même quantité de départ
    j := 0;
    for v_color in select jsonb_array_elements_text(spec->'colors') loop
      if jsonb_array_length(spec->'sizes') = 0 then
        j := j + 1;
        insert into product_variants (product_id, size, color, sku, stock)
        values (v_pid, null, v_color, 'DEMO-' || i || '-' || j, (spec->>'qty')::int);
      else
        for v_size in select jsonb_array_elements_text(spec->'sizes') loop
          j := j + 1;
          insert into product_variants (product_id, size, color, sku, stock)
          values (v_pid, v_size, v_color, 'DEMO-' || i || '-' || j, (spec->>'qty')::int);
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

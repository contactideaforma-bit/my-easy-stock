-- ============================================================
-- MY EASY STOCK — Correctif photos du compte démo existant
-- À exécuter dans Supabase si le seed a déjà été lancé avec les
-- anciennes images aléatoires (loremflickr) : remplace chaque photo
-- par une image Unsplash fixe correspondant à la catégorie du produit.
-- Ne touche que les produits dont l'image vient de loremflickr.
-- ============================================================

do $$
declare
  p record;
  imgs text[];
  i int := 0;
begin
  for p in
    select pr.id, c.name as cat_name
    from products pr
    left join categories c on c.id = pr.category_id
    where pr.image_url like '%loremflickr%'
    order by pr.created_at
  loop
    i := i + 1;
    imgs := case p.cat_name
      when 'T-shirts' then array['photo-1521572163474-6864f9cf17ab','photo-1576566588028-4147f3842f27']
      when 'Pantalons' then array['photo-1541099649105-f69ad21f3246','photo-1542272604-787c3835535d']
      when 'Robes' then array['photo-1595777457583-95e059d581b8','photo-1496747611176-843222e1e57c']
      when 'Vestes' then array['photo-1551028719-00167b16eac5','photo-1539533018447-63fcce2678e3']
      when 'Baskets' then array['photo-1542291026-7eec264c27ff','photo-1549298916-b41d501d3772','photo-1560769629-975ec94e6a86','photo-1595950653106-6c9ebd614d3a','photo-1600185365483-26d7a4cc7519']
      when 'Chaussures ville' then array['photo-1543163521-1bf539c55dd2','photo-1560343090-f0409e92791a']
      when 'Sandales' then array['photo-1603487742131-4160ec999306']
      when 'Accessoires' then array['photo-1584917865442-de89df76afd3','photo-1553062407-98eeb64c6a62']
      else array['photo-1521572163474-6864f9cf17ab'] end;

    update products
    set image_url = 'https://images.unsplash.com/' || imgs[1 + (i % array_length(imgs, 1))] || '?w=480&q=80&auto=format&fit=crop'
    where id = p.id;
  end loop;

  raise notice '% photo(s) de produit corrigée(s).', i;
end $$;

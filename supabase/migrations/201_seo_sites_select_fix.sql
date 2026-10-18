-- Correctif : le propriétaire doit voir le site qu'il vient de créer (insert ... returning).
alter policy seo_sites_select on public.seo_sites using (owner_id = (select auth.uid()) or public.seo_can_read(id));
alter policy seo_sites_update on public.seo_sites using (owner_id = (select auth.uid()) or public.seo_can_write(id)) with check (owner_id = (select auth.uid()) or public.seo_can_write(id));

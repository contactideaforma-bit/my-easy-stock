-- MyEasy SEO : tables préfixées seo_ (n'affecte pas les anciennes tables). Appliquée le 18/10/2026.
create table public.seo_sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, url text not null, client_name text, notes text, color text default '#7aa7ff',
  created_at timestamptz not null default now()
);
create table public.seo_site_members (
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer','editor')),
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);
create table public.seo_audits (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  created_by uuid default auth.uid(), score int, pages_crawled int default 0,
  summary jsonb not null default '{}'::jsonb, site_checks jsonb not null default '{}'::jsonb,
  pages jsonb not null default '[]'::jsonb, issues jsonb not null default '[]'::jsonb,
  performance jsonb, ai_summary text, created_at timestamptz not null default now()
);
create index seo_audits_site_idx on public.seo_audits(site_id, created_at desc);
create table public.seo_keywords (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  keyword text not null, target_url text, location text default 'France', intent text, priority int default 2,
  created_at timestamptz not null default now(), unique (site_id, keyword)
);
create table public.seo_keyword_positions (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references public.seo_keywords(id) on delete cascade,
  position int, found_url text, source text default 'manual', checked_at timestamptz not null default now()
);
create index seo_kwpos_idx on public.seo_keyword_positions(keyword_id, checked_at desc);
create table public.seo_ai_items (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  kind text not null, input jsonb not null default '{}'::jsonb, output text, created_at timestamptz not null default now()
);

create or replace function public.seo_can_read(p_site uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from seo_sites s where s.id = p_site and s.owner_id = auth.uid())
      or exists (select 1 from seo_site_members m where m.site_id = p_site and m.user_id = auth.uid());
$$;
create or replace function public.seo_can_write(p_site uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from seo_sites s where s.id = p_site and s.owner_id = auth.uid())
      or exists (select 1 from seo_site_members m where m.site_id = p_site and m.user_id = auth.uid() and m.role = 'editor');
$$;
revoke execute on function public.seo_can_read(uuid) from anon, public;
revoke execute on function public.seo_can_write(uuid) from anon, public;
grant execute on function public.seo_can_read(uuid) to authenticated;
grant execute on function public.seo_can_write(uuid) to authenticated;

alter table public.seo_sites enable row level security;
alter table public.seo_site_members enable row level security;
alter table public.seo_audits enable row level security;
alter table public.seo_keywords enable row level security;
alter table public.seo_keyword_positions enable row level security;
alter table public.seo_ai_items enable row level security;

create policy seo_sites_select on public.seo_sites for select to authenticated using (public.seo_can_read(id));
create policy seo_sites_insert on public.seo_sites for insert to authenticated with check (owner_id = (select auth.uid()));
create policy seo_sites_update on public.seo_sites for update to authenticated using (public.seo_can_write(id));
create policy seo_sites_delete on public.seo_sites for delete to authenticated using (owner_id = (select auth.uid()));
create policy seo_members_select on public.seo_site_members for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.seo_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy seo_members_write on public.seo_site_members for all to authenticated using (exists (select 1 from public.seo_sites s where s.id = site_id and s.owner_id = (select auth.uid()))) with check (exists (select 1 from public.seo_sites s where s.id = site_id and s.owner_id = (select auth.uid())));
create policy seo_audits_select on public.seo_audits for select to authenticated using (public.seo_can_read(site_id));
create policy seo_audits_write on public.seo_audits for all to authenticated using (public.seo_can_write(site_id)) with check (public.seo_can_write(site_id));
create policy seo_keywords_select on public.seo_keywords for select to authenticated using (public.seo_can_read(site_id));
create policy seo_keywords_write on public.seo_keywords for all to authenticated using (public.seo_can_write(site_id)) with check (public.seo_can_write(site_id));
create policy seo_kwpos_select on public.seo_keyword_positions for select to authenticated using (exists (select 1 from public.seo_keywords k where k.id = keyword_id and public.seo_can_read(k.site_id)));
create policy seo_kwpos_write on public.seo_keyword_positions for all to authenticated using (exists (select 1 from public.seo_keywords k where k.id = keyword_id and public.seo_can_write(k.site_id))) with check (exists (select 1 from public.seo_keywords k where k.id = keyword_id and public.seo_can_write(k.site_id)));
create policy seo_ai_select on public.seo_ai_items for select to authenticated using (public.seo_can_read(site_id));
create policy seo_ai_write on public.seo_ai_items for all to authenticated using (public.seo_can_write(site_id)) with check (public.seo_can_write(site_id));

create index seo_sites_owner_idx on public.seo_sites(owner_id);
create index seo_members_user_idx on public.seo_site_members(user_id);
create index seo_keywords_site_idx on public.seo_keywords(site_id);
create index seo_ai_site_idx on public.seo_ai_items(site_id, created_at desc);

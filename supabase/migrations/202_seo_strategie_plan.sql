-- Stratégie IA, plan d'action et suivi automatique hebdomadaire (19/10/2026)
alter table public.seo_sites add column if not exists auto_weekly boolean not null default true, add column if not exists last_auto_at timestamptz;
create table if not exists public.seo_strategies (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  inputs jsonb not null default '{}'::jsonb, content jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create index if not exists seo_strategies_site_idx on public.seo_strategies(site_id, created_at desc);
create table if not exists public.seo_tasks (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.seo_sites(id) on delete cascade,
  strategy_id uuid references public.seo_strategies(id) on delete set null,
  source text not null default 'manual' check (source in ('audit','strategy','manual')),
  issue_id text, title text not null, detail text, category text not null default 'contenu',
  priority int not null default 2, impact int not null default 2, effort int not null default 2,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  due_date date, target_url text, keyword text, auto_note text, done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists seo_tasks_site_idx on public.seo_tasks(site_id, status);
create index if not exists seo_tasks_strategy_idx on public.seo_tasks(strategy_id);
alter table public.seo_strategies enable row level security;
alter table public.seo_tasks enable row level security;
create policy seo_strat_select on public.seo_strategies for select to authenticated using (public.seo_can_read(site_id));
create policy seo_strat_write on public.seo_strategies for all to authenticated using (public.seo_can_write(site_id)) with check (public.seo_can_write(site_id));
create policy seo_tasks_select on public.seo_tasks for select to authenticated using (public.seo_can_read(site_id));
create policy seo_tasks_write on public.seo_tasks for all to authenticated using (public.seo_can_write(site_id)) with check (public.seo_can_write(site_id));

-- ============================================================
-- MY ASSISTANAD — Migration 101
--  • Lien de paiement de la banque, configurable
--  • Calendrier fiscal automatique (tâches générées par client)
--  • Lettres de mission avec signature électronique
--  • Code couleur « payeur » par client (vert → rouge)
-- À exécuter APRÈS 100_my_assistanad.sql (SQL Editor > New query > Run)
-- ============================================================

-- ---------- Paramètres cabinet ----------
alter table public.mya_cabinets
  add column if not exists payment_link_template text,
  add column if not exists payment_link_label text not null default 'Payer en ligne',
  add column if not exists fiscal_calendar boolean not null default true,
  add column if not exists vat_due_day int not null default 15 check (vat_due_day between 1 and 28),
  add column if not exists engagement_template text;

-- ---------- Calendrier fiscal : une échéance = une tâche, jamais en double ----------
alter table public.mya_tasks add column if not exists fiscal_key text;
alter table public.mya_tasks drop constraint if exists mya_tasks_fiscal_uniq;
alter table public.mya_tasks add constraint mya_tasks_fiscal_uniq unique (client_id, fiscal_key);

-- ---------- Lettres de mission ----------
create table if not exists public.mya_engagements (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.mya_cabinets(id) on delete cascade,
  client_id uuid not null references public.mya_clients(id) on delete cascade,
  title text not null default 'Lettre de mission',
  content text not null,
  status text not null default 'brouillon' check (status in ('brouillon','envoyee','signee','annulee')),
  public_token uuid not null default gen_random_uuid(),
  sent_at timestamptz,
  signed_at timestamptz,
  signer_name text,
  signer_ip text,
  signer_ua text,
  signature text,          -- image de la signature (data URL PNG)
  content_hash text,       -- empreinte SHA-256 du texte signé (preuve d'intégrité)
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_mya_eng_token on public.mya_engagements(public_token);
create index if not exists idx_mya_eng_client on public.mya_engagements(client_id);
alter table public.mya_engagements enable row level security;
drop policy if exists mya_engagements_member_all on public.mya_engagements;
create policy mya_engagements_member_all on public.mya_engagements for all to authenticated
  using (public.mya_is_member(cabinet_id)) with check (public.mya_is_member(cabinet_id));

-- Une lettre signée ne peut plus être modifiée (seul le statut « annulée » reste possible)
create or replace function public.mya_engagement_lock()
returns trigger language plpgsql as $$
begin
  if old.status = 'signee' and auth.role() <> 'service_role' then
    if new.content is distinct from old.content or new.signature is distinct from old.signature
       or new.signed_at is distinct from old.signed_at or new.signer_name is distinct from old.signer_name
       or new.content_hash is distinct from old.content_hash then
      raise exception 'Une lettre de mission signée ne peut plus être modifiée';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists mya_engagement_lock_trg on public.mya_engagements;
create trigger mya_engagement_lock_trg before update on public.mya_engagements
  for each row execute function public.mya_engagement_lock();

-- Journal : nouveaux types d'envoi
alter table public.mya_reminders_log drop constraint if exists mya_reminders_log_kind_check;
alter table public.mya_reminders_log add constraint mya_reminders_log_kind_check
  check (kind in ('envoi_facture','relance','rappel_rdv','recap','lettre_mission'));
alter table public.mya_reminders_log add column if not exists engagement_id uuid references public.mya_engagements(id) on delete cascade;

-- ---------- Code couleur payeur ----------
-- Pour chaque facture (12 dernières par client) on mesure l'effort de recouvrement :
--   0 = payée à l'heure · 1 = ≤ 7 j de retard · 2 = ≤ 20 j · 3 = ≤ 45 j · 4 = au-delà
-- Le niveau du client = moyenne arrondie, relevé si un impayé en cours est très ancien.
create or replace view public.mya_client_payer with (security_invoker = true) as
with inv as (
  select client_id, cabinet_id, status,
    case when status = 'payee' then greatest(0, coalesce(paid_at, current_date) - due_date)
         else greatest(0, current_date - due_date) end as late,
    row_number() over (partition by client_id order by issue_date desc) as rn
  from public.mya_invoices
  where status = 'payee' or (status = 'envoyee' and due_date < current_date)
), agg as (
  select client_id, cabinet_id, count(*)::int as nb,
    avg(case when late = 0 then 0 when late <= 7 then 1 when late <= 20 then 2 when late <= 45 then 3 else 4 end) as score,
    coalesce(max(case when status = 'envoyee' then late end), 0) as max_open_late
  from inv where rn <= 12
  group by client_id, cabinet_id
)
select client_id, cabinet_id, nb, round(score, 2) as score, max_open_late,
  least(4, greatest(
    round(score)::int,
    case when max_open_late > 45 then 4 when max_open_late > 20 then 3 when max_open_late > 7 then 2 else 0 end
  )) as level
from agg;

grant select on public.mya_client_payer to authenticated;

-- ---------- Thème rose : couleur par défaut des membres ----------
alter table public.mya_members alter column color set default '#cc3a73';
update public.mya_members set color = '#cc3a73' where color = '#2f7d6d';

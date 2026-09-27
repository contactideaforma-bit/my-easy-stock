-- ============================================================
-- MY ASSISTANAD — Schéma complet (assistant personnel + suivi des paiements
-- pour cabinet comptable). Toutes les tables sont préfixées « mya_ » :
-- elles cohabitent avec les anciennes tables My Easy Stock (archivé) sans
-- rien toucher.
-- À exécuter dans Supabase : SQL Editor > New query > Run
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- CABINET ----------
create table public.mya_cabinets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  siret text,
  address text,
  email text,
  phone text,
  website text,
  iban text,
  bic text,
  vat_number text,
  logo_url text,
  invoice_prefix text not null default 'F',
  next_invoice_number int not null default 1,
  payment_terms_days int not null default 30,
  default_vat_rate numeric not null default 20,
  invoice_footer text default 'En cas de retard de paiement, une pénalité égale à 3 fois le taux d''intérêt légal sera exigible, ainsi qu''une indemnité forfaitaire pour frais de recouvrement de 40 €.',
  reminders_enabled boolean not null default true,
  appointment_reminders boolean not null default true,
  daily_digest boolean not null default true,
  recurring_mode text not null default 'brouillon' check (recurring_mode in ('brouillon','auto')),
  sms_sender text default 'Cabinet',
  created_at timestamptz not null default now()
);

create table public.mya_members (
  cabinet_id uuid not null references public.mya_cabinets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'collaborateur' check (role in ('titulaire','collaborateur')),
  full_name text not null,
  email text,
  color text not null default '#2f7d6d',
  created_at timestamptz not null default now(),
  primary key (cabinet_id, user_id)
);
create index idx_mya_members_user on public.mya_members(user_id);

-- Fonctions d'accès (security definer : évite la récursion RLS)
create or replace function public.mya_is_member(cab uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mya_members where cabinet_id = cab and user_id = auth.uid());
$$;

create or replace function public.mya_is_owner(cab uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mya_members where cabinet_id = cab and user_id = auth.uid() and role = 'titulaire');
$$;

-- ---------- CLIENTS (dossiers) ----------
create table public.mya_clients (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.mya_cabinets(id) on delete cascade,
  kind text not null default 'societe' check (kind in ('societe','entreprise_individuelle','particulier','association','sci')),
  name text not null,
  legal_form text,
  siren text,
  contact_name text,
  email text,
  phone text,
  address text,
  activity text,
  tax_regime text,
  vat_regime text check (vat_regime in ('mensuel','trimestriel','annuel','franchise') or vat_regime is null),
  fiscal_year_end text default '12-31',
  mission text,
  fee_amount numeric,
  fee_frequency text not null default 'ponctuel' check (fee_frequency in ('mensuel','trimestriel','annuel','ponctuel')),
  fee_label text,
  fee_next_date date,
  payment_method text,
  owner_member uuid references auth.users(id) on delete set null,
  status text not null default 'actif' check (status in ('actif','prospect','archive')),
  reminders_paused boolean not null default false,
  preferred_channel text not null default 'email' check (preferred_channel in ('email','sms','whatsapp')),
  notes text,
  created_at timestamptz not null default now()
);
create index idx_mya_clients_cab on public.mya_clients(cabinet_id);

-- ---------- SOLLICITATIONS (tout ce qui arrive : appels, mails, WhatsApp…) ----------
create table public.mya_requests (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.mya_cabinets(id) on delete cascade,
  client_id uuid references public.mya_clients(id) on delete set null,
  contact_name text,
  channel text not null default 'telephone' check (channel in ('telephone','email','whatsapp','sms','visite','autre')),
  subject text not null,
  details text,
  priority text not null default 'normale' check (priority in ('basse','normale','haute','urgente')),
  status text not null default 'nouvelle' check (status in ('nouvelle','en_cours','attente_client','traitee')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_date date,
  received_at timestamptz not null default now(),
  done_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index idx_mya_requests_cab on public.mya_requests(cabinet_id, status);

-- ---------- TÂCHES ----------
create table public.mya_tasks (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.mya_cabinets(id) on delete cascade,
  client_id uuid references public.mya_clients(id) on delete cascade,
  request_id uuid references public.mya_requests(id) on delete set null,
  title text not null,
  notes text,
  category text not null default 'autre' check (category in ('saisie','tva','bilan','social','juridique','fiscal','admin','relance','autre')),
  due_date date,
  priority text not null default 'normale' check (priority in ('basse','normale','haute','urgente')),
  status text not null default 'a_faire' check (status in ('a_faire','en_cours','fait')),
  assigned_to uuid references auth.users(id) on delete set null,
  recurrence text not null default 'aucune' check (recurrence in ('aucune','hebdo','mensuelle','trimestrielle','annuelle')),
  done_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index idx_mya_tasks_cab on public.mya_tasks(cabinet_id, status, due_date);

-- Tâche récurrente terminée → la suivante est créée automatiquement
create or replace function public.mya_task_recur()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_next date;
begin
  if new.status = 'fait' and coalesce(old.status,'') <> 'fait' then
    new.done_at := coalesce(new.done_at, now());
    if new.recurrence <> 'aucune' and new.due_date is not null then
      v_next := case new.recurrence
        when 'hebdo' then new.due_date + 7
        when 'mensuelle' then (new.due_date + interval '1 month')::date
        when 'trimestrielle' then (new.due_date + interval '3 months')::date
        when 'annuelle' then (new.due_date + interval '1 year')::date
      end;
      insert into public.mya_tasks (cabinet_id, client_id, title, notes, category, due_date, priority, assigned_to, recurrence, created_by)
      values (new.cabinet_id, new.client_id, new.title, new.notes, new.category, v_next, new.priority, new.assigned_to, new.recurrence, new.created_by);
    end if;
  elsif new.status <> 'fait' then
    new.done_at := null;
  end if;
  return new;
end $$;
create trigger mya_task_recur_trg before update on public.mya_tasks
  for each row execute function public.mya_task_recur();

-- ---------- RENDEZ-VOUS ----------
create table public.mya_appointments (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.mya_cabinets(id) on delete cascade,
  client_id uuid references public.mya_clients(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  kind text not null default 'cabinet' check (kind in ('cabinet','visio','telephone','chez_client')),
  location text,
  notes text,
  member_id uuid references auth.users(id) on delete set null,
  remind_client boolean not null default true,
  reminded_at timestamptz,
  status text not null default 'prevu' check (status in ('prevu','fait','annule','absent')),
  created_at timestamptz not null default now()
);
create index idx_mya_appts_cab on public.mya_appointments(cabinet_id, starts_at);

-- ---------- FACTURES D'HONORAIRES ----------
create table public.mya_invoices (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.mya_cabinets(id) on delete cascade,
  client_id uuid not null references public.mya_clients(id) on delete restrict,
  number text,
  issue_date date not null default current_date,
  due_date date not null default (current_date + 30),
  label text not null default 'Honoraires',
  lines jsonb not null default '[]'::jsonb,
  vat_rate numeric not null default 20,
  amount_ht numeric not null default 0,
  amount_ttc numeric not null default 0,
  paid_amount numeric not null default 0,
  status text not null default 'brouillon' check (status in ('brouillon','envoyee','payee','annulee')),
  sent_at timestamptz,
  paid_at date,
  reminder_level int not null default 0,
  last_reminder_at timestamptz,
  reminders_paused boolean not null default false,
  payment_link text,
  notes text,
  is_recurring boolean not null default false,
  public_token uuid not null default gen_random_uuid(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index idx_mya_invoices_cab on public.mya_invoices(cabinet_id, status, due_date);
create unique index idx_mya_invoices_token on public.mya_invoices(public_token);

create table public.mya_payments (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.mya_cabinets(id) on delete cascade,
  invoice_id uuid not null references public.mya_invoices(id) on delete cascade,
  amount numeric not null check (amount > 0),
  paid_on date not null default current_date,
  method text not null default 'virement' check (method in ('virement','prelevement','cheque','especes','carte','autre')),
  note text,
  created_at timestamptz not null default now()
);
create index idx_mya_payments_inv on public.mya_payments(invoice_id);

-- Encaissement → mise à jour automatique du solde et du statut de la facture
create or replace function public.mya_sync_invoice_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_inv uuid; v_paid numeric; v_last date;
begin
  v_inv := coalesce(new.invoice_id, old.invoice_id);
  select coalesce(sum(amount),0), max(paid_on) into v_paid, v_last from public.mya_payments where invoice_id = v_inv;
  update public.mya_invoices set
    paid_amount = v_paid,
    status = case
      when status = 'annulee' then status
      when v_paid >= amount_ttc - 0.005 and amount_ttc > 0 then 'payee'
      when status = 'payee' then 'envoyee'
      else status end,
    paid_at = case when v_paid >= amount_ttc - 0.005 and amount_ttc > 0 then v_last else null end
  where id = v_inv;
  return null;
end $$;
create trigger mya_payments_sync after insert or update or delete on public.mya_payments
  for each row execute function public.mya_sync_invoice_paid();

-- Numérotation continue et sans trou (obligation légale) : F-2026-0001
create or replace function public.mya_next_invoice_number(cab uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_n int; v_prefix text;
begin
  if not public.mya_is_member(cab) and auth.role() <> 'service_role' then
    raise exception 'Accès refusé';
  end if;
  update public.mya_cabinets set next_invoice_number = next_invoice_number + 1
    where id = cab returning next_invoice_number - 1, invoice_prefix into v_n, v_prefix;
  return v_prefix || '-' || to_char(current_date, 'YYYY') || '-' || lpad(v_n::text, 4, '0');
end $$;

-- ---------- SCÉNARIO DE RELANCES ----------
create table public.mya_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.mya_cabinets(id) on delete cascade,
  step int not null,
  offset_days int not null,          -- jours par rapport à l'échéance (négatif = avant)
  channels text[] not null default array['email'],
  tone text not null default 'courtois' check (tone in ('courtois','ferme','mise_en_demeure')),
  subject text not null,
  body text not null,
  active boolean not null default true,
  unique (cabinet_id, step)
);

create table public.mya_reminders_log (
  id uuid primary key default gen_random_uuid(),
  cabinet_id uuid not null references public.mya_cabinets(id) on delete cascade,
  invoice_id uuid references public.mya_invoices(id) on delete cascade,
  client_id uuid references public.mya_clients(id) on delete cascade,
  appointment_id uuid references public.mya_appointments(id) on delete cascade,
  kind text not null default 'relance' check (kind in ('envoi_facture','relance','rappel_rdv','recap')),
  step int,
  channel text not null check (channel in ('email','sms','whatsapp')),
  status text not null check (status in ('envoye','echec','prepare')),
  recipient text,
  subject text,
  message text,
  error text,
  automatic boolean not null default false,
  sent_by uuid,
  created_at timestamptz not null default now()
);
create index idx_mya_log_cab on public.mya_reminders_log(cabinet_id, created_at desc);

-- Scénario par défaut (modifiable dans l'appli)
create or replace function public.mya_default_rules(cab uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.mya_reminder_rules (cabinet_id, step, offset_days, channels, tone, subject, body) values
  (cab, 1, -3, array['email'], 'courtois',
   'Petit rappel : facture {numero} à régler le {echeance}',
   E'Bonjour {contact},\n\nPetit rappel amical : la facture {numero} d''un montant de {reste} arrive à échéance le {echeance}.\n\nVous pouvez la consulter et la régler ici : {lien}\n\nSi le règlement est déjà parti, merci d''ignorer ce message.\n\nBien cordialement,\n{cabinet}'),
  (cab, 2, 3, array['email','sms'], 'courtois',
   'Facture {numero} : échéance dépassée',
   E'Bonjour {contact},\n\nSauf erreur de notre part, la facture {numero} ({reste}) arrivée à échéance le {echeance} n''a pas encore été réglée.\n\nLien de consultation et de paiement : {lien}\nIBAN : {iban}\n\nMerci d''avance,\n{cabinet}'),
  (cab, 3, 10, array['email','sms'], 'ferme',
   'Relance : facture {numero} impayée depuis {jours_retard} jours',
   E'Bonjour {contact},\n\nMalgré notre précédent rappel, la facture {numero} d''un montant de {reste} reste impayée ({jours_retard} jours de retard).\n\nNous vous remercions de procéder au règlement sous 8 jours : {lien}\nIBAN : {iban}\n\nEn cas de difficulté, appelez-nous au {tel_cabinet} : nous trouverons une solution ensemble (échéancier possible).\n\n{cabinet}'),
  (cab, 4, 25, array['email','sms'], 'mise_en_demeure',
   'Dernier rappel avant mise en demeure — facture {numero}',
   E'Bonjour {contact},\n\nLa facture {numero} ({reste}) demeure impayée depuis {jours_retard} jours malgré nos relances.\n\nSans règlement sous 8 jours, nous serons contraints de vous adresser une mise en demeure et de suspendre nos travaux, conformément à notre lettre de mission. Pénalités de retard et indemnité forfaitaire de 40 € applicables (art. L441-10 du Code de commerce).\n\nRèglement : {lien} — IBAN : {iban}\n\n{cabinet}')
  on conflict (cabinet_id, step) do nothing;
end $$;

-- Création du cabinet au premier login (la personne devient titulaire)
create or replace function public.mya_create_cabinet(p_name text, p_full_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_cab uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if exists (select 1 from public.mya_members where user_id = auth.uid()) then
    select cabinet_id into v_cab from public.mya_members where user_id = auth.uid() limit 1;
    return v_cab;
  end if;
  select email into v_email from auth.users where id = auth.uid();
  insert into public.mya_cabinets (name, email) values (p_name, v_email) returning id into v_cab;
  insert into public.mya_members (cabinet_id, user_id, role, full_name, email)
    values (v_cab, auth.uid(), 'titulaire', p_full_name, v_email);
  perform public.mya_default_rules(v_cab);
  return v_cab;
end $$;

-- ---------- SÉCURITÉ (Row Level Security) ----------
alter table public.mya_cabinets enable row level security;
alter table public.mya_members enable row level security;
alter table public.mya_clients enable row level security;
alter table public.mya_requests enable row level security;
alter table public.mya_tasks enable row level security;
alter table public.mya_appointments enable row level security;
alter table public.mya_invoices enable row level security;
alter table public.mya_payments enable row level security;
alter table public.mya_reminder_rules enable row level security;
alter table public.mya_reminders_log enable row level security;

create policy mya_cab_select on public.mya_cabinets for select to authenticated using (public.mya_is_member(id));
create policy mya_cab_update on public.mya_cabinets for update to authenticated using (public.mya_is_owner(id)) with check (public.mya_is_owner(id));

create policy mya_mem_select on public.mya_members for select to authenticated using (public.mya_is_member(cabinet_id));
create policy mya_mem_update on public.mya_members for update to authenticated
  using (public.mya_is_owner(cabinet_id) or user_id = auth.uid()) with check (public.mya_is_owner(cabinet_id) or user_id = auth.uid());
create policy mya_mem_delete on public.mya_members for delete to authenticated using (public.mya_is_owner(cabinet_id) and user_id <> auth.uid());

do $$
declare t text;
begin
  foreach t in array array['mya_clients','mya_requests','mya_tasks','mya_appointments','mya_invoices','mya_payments','mya_reminders_log'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.mya_is_member(cabinet_id)) with check (public.mya_is_member(cabinet_id))', t || '_member_all', t);
  end loop;
end $$;

create policy mya_rules_select on public.mya_reminder_rules for select to authenticated using (public.mya_is_member(cabinet_id));
create policy mya_rules_write on public.mya_reminder_rules for all to authenticated using (public.mya_is_owner(cabinet_id)) with check (public.mya_is_owner(cabinet_id));

grant execute on function public.mya_create_cabinet(text, text) to authenticated;
grant execute on function public.mya_next_invoice_number(uuid) to authenticated;

'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCabinet } from './Cabinet';
import { ClientSelect, Field, MemberSelect } from './Bits';
import { LABELS, todayISO } from '@/lib/utils';
import type { Appointment, Client, Request, Task } from '@/lib/types';
import { generateFiscal } from '@/lib/fiscalClient';

type Saved = () => void;

function Actions({ busy, onDelete, label = 'Enregistrer' }: { busy: boolean; onDelete?: () => void; label?: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      {onDelete && <button type="button" className="btn-danger" onClick={onDelete} disabled={busy}>Supprimer</button>}
      <button className="btn-primary ml-auto" disabled={busy}>{busy ? '…' : label}</button>
    </div>
  );
}

function Err({ e }: { e: string | null }) {
  return e ? <p className="text-sm text-clay-700 bg-clay-50 rounded-lg px-3 py-2">{e}</p> : null;
}

// ------------------------------------------------------------------
// Sollicitation : tout ce qui arrive (appel, mail, WhatsApp…) en 10 secondes
// ------------------------------------------------------------------
export function RequestForm({ initial, onSaved, defaultClient }: { initial?: Partial<Request>; onSaved: Saved; defaultClient?: string | null }) {
  const { cabinet, me, bump } = useCabinet();
  const [f, setF] = useState<Partial<Request>>({
    channel: 'telephone', priority: 'normale', status: 'nouvelle', assigned_to: me.user_id,
    client_id: defaultClient ?? null, ...initial,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Request, v: any) => setF((s) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const row = {
      cabinet_id: cabinet.id, client_id: f.client_id || null, contact_name: f.contact_name || null,
      channel: f.channel, subject: f.subject, details: f.details || null, priority: f.priority,
      status: f.status, assigned_to: f.assigned_to || null, due_date: f.due_date || null,
      done_at: f.status === 'traitee' ? (f.done_at ?? new Date().toISOString()) : null,
    };
    const q = f.id ? supabase().from('mya_requests').update(row).eq('id', f.id) : supabase().from('mya_requests').insert(row);
    const { error } = await q;
    setBusy(false);
    if (error) return setErr(error.message);
    bump(); onSaved();
  }

  async function del() {
    if (!f.id || !confirm('Supprimer cette sollicitation ?')) return;
    await supabase().from('mya_requests').delete().eq('id', f.id);
    bump(); onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(LABELS.channel).map(([k, v]) => (
          <button type="button" key={k} onClick={() => set('channel', k)} className={f.channel === k ? 'chip-ink py-1 px-3' : 'chip-gray py-1 px-3'}>{v}</button>
        ))}
      </div>
      <Field label="Client"><ClientSelect value={f.client_id ?? null} onChange={(v) => set('client_id', v)} placeholder="Nouveau contact / pas encore client" /></Field>
      {!f.client_id && <Field label="Nom du contact"><input className="input" value={f.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} placeholder="Ex. M. Durand (boulangerie)" /></Field>}
      <Field label="Objet *"><input required className="input" value={f.subject ?? ''} onChange={(e) => set('subject', e.target.value)} placeholder="Ex. Demande d'attestation pour la banque" autoFocus /></Field>
      <Field label="Détails"><textarea className="input" value={f.details ?? ''} onChange={(e) => set('details', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Priorité">
          <select className="input" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            {Object.entries(LABELS.priority).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="À traiter pour le"><input type="date" className="input" value={f.due_date ?? ''} onChange={(e) => set('due_date', e.target.value)} /></Field>
        <Field label="Qui s'en occupe"><MemberSelect value={f.assigned_to ?? null} onChange={(v) => set('assigned_to', v)} /></Field>
        <Field label="Statut">
          <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
            {Object.entries(LABELS.requestStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <Err e={err} />
      <Actions busy={busy} onDelete={f.id ? del : undefined} />
    </form>
  );
}

// ------------------------------------------------------------------
// Tâche
// ------------------------------------------------------------------
export function TaskForm({ initial, onSaved, defaultClient }: { initial?: Partial<Task>; onSaved: Saved; defaultClient?: string | null }) {
  const { cabinet, me, bump } = useCabinet();
  const [f, setF] = useState<Partial<Task>>({
    category: 'autre', priority: 'normale', status: 'a_faire', recurrence: 'aucune',
    assigned_to: me.user_id, due_date: todayISO(), client_id: defaultClient ?? null, ...initial,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Task, v: any) => setF((s) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const row = {
      cabinet_id: cabinet.id, client_id: f.client_id || null, request_id: f.request_id || null,
      title: f.title, notes: f.notes || null, category: f.category, due_date: f.due_date || null,
      priority: f.priority, status: f.status, assigned_to: f.assigned_to || null, recurrence: f.recurrence,
    };
    const { error } = f.id
      ? await supabase().from('mya_tasks').update(row).eq('id', f.id)
      : await supabase().from('mya_tasks').insert(row);
    setBusy(false);
    if (error) return setErr(error.message);
    bump(); onSaved();
  }

  async function del() {
    if (!f.id || !confirm('Supprimer cette tâche ?')) return;
    await supabase().from('mya_tasks').delete().eq('id', f.id);
    bump(); onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Field label="Tâche *"><input required className="input" value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Déclaration de TVA de septembre" autoFocus /></Field>
      <Field label="Client"><ClientSelect value={f.client_id ?? null} onChange={(v) => set('client_id', v)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Échéance"><input type="date" className="input" value={f.due_date ?? ''} onChange={(e) => set('due_date', e.target.value)} /></Field>
        <Field label="Type">
          <select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>
            {Object.entries(LABELS.category).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Priorité">
          <select className="input" value={f.priority} onChange={(e) => set('priority', e.target.value)}>
            {Object.entries(LABELS.priority).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Qui s'en occupe"><MemberSelect value={f.assigned_to ?? null} onChange={(v) => set('assigned_to', v)} /></Field>
        <Field label="Répétition" className="col-span-2">
          <select className="input" value={f.recurrence} onChange={(e) => set('recurrence', e.target.value)}>
            {Object.entries(LABELS.recurrence).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      {f.recurrence !== 'aucune' && <p className="text-xs text-ink-mute">Quand elle sera cochée, la suivante sera créée toute seule.</p>}
      <Field label="Notes"><textarea className="input" value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      <Err e={err} />
      <Actions busy={busy} onDelete={f.id ? del : undefined} />
    </form>
  );
}

// ------------------------------------------------------------------
// Rendez-vous
// ------------------------------------------------------------------
function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const DURATIONS: Record<number, string> = { 15: '15 min', 30: '30 min', 45: '45 min', 60: '1 h', 90: '1 h 30', 120: '2 h', 180: '3 h' };

export function AppointmentForm({ initial, onSaved, defaultClient }: { initial?: Partial<Appointment>; onSaved: Saved; defaultClient?: string | null }) {
  const { cabinet, me, bump } = useCabinet();
  const nextHour = new Date(); nextHour.setMinutes(0, 0, 0); nextHour.setHours(nextHour.getHours() + 1);
  const [f, setF] = useState<Partial<Appointment>>({
    kind: 'cabinet', status: 'prevu', remind_client: true, member_id: me.user_id,
    starts_at: nextHour.toISOString(), client_id: defaultClient ?? null, ...initial,
  });
  const [duration, setDuration] = useState(() => {
    if (initial?.starts_at && initial?.ends_at) return Math.round((+new Date(initial.ends_at) - +new Date(initial.starts_at)) / 60000);
    return 60;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Appointment, v: any) => setF((s) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const start = new Date(f.starts_at!);
    const row = {
      cabinet_id: cabinet.id, client_id: f.client_id || null, title: f.title, starts_at: start.toISOString(),
      ends_at: new Date(+start + duration * 60000).toISOString(), kind: f.kind, location: f.location || null,
      notes: f.notes || null, member_id: f.member_id || null, remind_client: !!f.remind_client, status: f.status,
    };
    const { error } = f.id
      ? await supabase().from('mya_appointments').update(row).eq('id', f.id)
      : await supabase().from('mya_appointments').insert(row);
    setBusy(false);
    if (error) return setErr(error.message);
    bump(); onSaved();
  }

  async function del() {
    if (!f.id || !confirm('Supprimer ce rendez-vous ?')) return;
    await supabase().from('mya_appointments').delete().eq('id', f.id);
    bump(); onSaved();
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <Field label="Objet *"><input required className="input" value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Bilan 2025 — remise des documents" autoFocus /></Field>
      <Field label="Client"><ClientSelect value={f.client_id ?? null} onChange={(v) => set('client_id', v)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date et heure"><input required type="datetime-local" className="input" value={toLocalInput(f.starts_at)} onChange={(e) => set('starts_at', new Date(e.target.value).toISOString())} /></Field>
        <Field label="Durée">
          <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {Object.entries(DURATIONS).map(([m, l]) => <option key={m} value={m}>{l}</option>)}
          </select>
        </Field>
        <Field label="Où">
          <select className="input" value={f.kind} onChange={(e) => set('kind', e.target.value)}>
            {Object.entries(LABELS.apptKind).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Avec"><MemberSelect value={f.member_id ?? null} onChange={(v) => set('member_id', v)} /></Field>
      </div>
      {(f.kind === 'visio' || f.kind === 'chez_client') && (
        <Field label={f.kind === 'visio' ? 'Lien visio' : 'Adresse'}><input className="input" value={f.location ?? ''} onChange={(e) => set('location', e.target.value)} /></Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!f.remind_client} onChange={(e) => set('remind_client', e.target.checked)} className="accent-rose-600 w-4 h-4" />
        Envoyer un rappel au client la veille (email + SMS)
      </label>
      {f.id && (
        <Field label="Statut">
          <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="prevu">Prévu</option><option value="fait">Fait</option><option value="annule">Annulé</option><option value="absent">Client absent</option>
          </select>
        </Field>
      )}
      <Field label="Notes / ordre du jour"><textarea className="input" value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      <Err e={err} />
      <Actions busy={busy} onDelete={f.id ? del : undefined} />
    </form>
  );
}

// ------------------------------------------------------------------
// Client (dossier)
// ------------------------------------------------------------------
export function ClientForm({ initial, onSaved }: { initial?: Partial<Client>; onSaved: (id: string) => void }) {
  const { cabinet, me, refreshClients, bump } = useCabinet();
  const [f, setF] = useState<Partial<Client>>({
    kind: 'societe', status: 'actif', fee_frequency: 'mensuel', preferred_channel: 'email',
    vat_regime: 'trimestriel', fiscal_year_end: '12-31', owner_member: me.user_id, ...initial,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof Client, v: any) => setF((s) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const row = {
      cabinet_id: cabinet.id, kind: f.kind, name: f.name, legal_form: f.legal_form || null, siren: f.siren || null,
      contact_name: f.contact_name || null, email: f.email || null, phone: f.phone || null, address: f.address || null,
      activity: f.activity || null, tax_regime: f.tax_regime || null, vat_regime: f.vat_regime || null,
      fiscal_year_end: f.fiscal_year_end || null, mission: f.mission || null,
      fee_amount: f.fee_amount === null || f.fee_amount === undefined || (f.fee_amount as any) === '' ? null : Number(f.fee_amount),
      fee_frequency: f.fee_frequency, fee_label: f.fee_label || null, fee_next_date: f.fee_next_date || null,
      payment_method: f.payment_method || null, owner_member: f.owner_member || null, status: f.status,
      preferred_channel: f.preferred_channel, notes: f.notes || null,
    };
    const res = f.id
      ? await supabase().from('mya_clients').update(row).eq('id', f.id).select('id').single()
      : await supabase().from('mya_clients').insert(row).select('id').single();
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    if (!f.id && cabinet.fiscal_calendar && row.status === 'actif') {
      const { data: full } = await supabase().from('mya_clients').select('*').eq('id', res.data.id).single();
      if (full) await generateFiscal(full as Client, cabinet.vat_due_day, 120).catch(() => 0);
    }
    await refreshClients(); bump();
    onSaved(res.data.id);
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <section className="space-y-3">
        <h3 className="h2">Identité</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom / raison sociale *" className="col-span-2"><input required className="input" value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
          <Field label="Type">
            <select className="input" value={f.kind} onChange={(e) => set('kind', e.target.value)}>
              {Object.entries(LABELS.kind).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Forme juridique"><input className="input" value={f.legal_form ?? ''} onChange={(e) => set('legal_form', e.target.value)} placeholder="SARL, SAS, EI…" /></Field>
          <Field label="SIREN"><input className="input" value={f.siren ?? ''} onChange={(e) => set('siren', e.target.value)} inputMode="numeric" /></Field>
          <Field label="Activité"><input className="input" value={f.activity ?? ''} onChange={(e) => set('activity', e.target.value)} /></Field>
          <Field label="Statut">
            <select className="input" value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="actif">Client actif</option><option value="prospect">Prospect</option><option value="archive">Archivé</option>
            </select>
          </Field>
          <Field label="Collaborateur référent"><MemberSelect value={f.owner_member ?? null} onChange={(v) => set('owner_member', v)} /></Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="h2">Contact</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Interlocuteur"><input className="input" value={f.contact_name ?? ''} onChange={(e) => set('contact_name', e.target.value)} placeholder="Mme Martin" /></Field>
          <Field label="Mobile"><input className="input" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="06…" /></Field>
          <Field label="Email" className="col-span-2"><input type="email" className="input" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field label="Adresse" className="col-span-2"><input className="input" value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
          <Field label="Canal préféré" className="col-span-2">
            <select className="input" value={f.preferred_channel} onChange={(e) => set('preferred_channel', e.target.value)}>
              <option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="h2">Dossier comptable</h3>
        {cabinet.fiscal_calendar && <p className="text-xs text-ink-mute -mt-1">Ces informations alimentent le calendrier fiscal automatique (TVA, IS, bilan, AG, CFE).</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Régime d'imposition"><input className="input" value={f.tax_regime ?? ''} onChange={(e) => set('tax_regime', e.target.value)} placeholder="IS, IR, micro-BIC…" /></Field>
          <Field label="TVA">
            <select className="input" value={f.vat_regime ?? ''} onChange={(e) => set('vat_regime', e.target.value || null)}>
              <option value="">—</option><option value="mensuel">Mensuelle (CA3)</option><option value="trimestriel">Trimestrielle</option><option value="annuel">Annuelle (CA12)</option><option value="franchise">Franchise en base</option>
            </select>
          </Field>
          <Field label="Clôture de l'exercice (JJ/MM)">
            <input className="input" value={f.fiscal_year_end ? f.fiscal_year_end.split('-').reverse().join('/') : ''} onChange={(e) => { const [d, m] = e.target.value.split('/'); set('fiscal_year_end', m && d ? `${m.padStart(2, '0')}-${d.padStart(2, '0')}` : e.target.value); }} placeholder="31/12" />
          </Field>
          <Field label="Mission"><input className="input" value={f.mission ?? ''} onChange={(e) => set('mission', e.target.value)} placeholder="Tenue, révision, bilan, paie…" /></Field>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="h2">Honoraires</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant HT (€)"><input type="number" step="0.01" className="input" value={f.fee_amount ?? ''} onChange={(e) => set('fee_amount', e.target.value)} /></Field>
          <Field label="Fréquence">
            <select className="input" value={f.fee_frequency} onChange={(e) => set('fee_frequency', e.target.value)}>
              {Object.entries(LABELS.freq).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          {f.fee_frequency !== 'ponctuel' && (
            <>
              <Field label="Prochaine facture le"><input type="date" className="input" value={f.fee_next_date ?? ''} onChange={(e) => set('fee_next_date', e.target.value)} /></Field>
              <Field label="Libellé"><input className="input" value={f.fee_label ?? ''} onChange={(e) => set('fee_label', e.target.value)} placeholder="Forfait comptable mensuel" /></Field>
            </>
          )}
          <Field label="Mode de paiement habituel" className="col-span-2">
            <select className="input" value={f.payment_method ?? ''} onChange={(e) => set('payment_method', e.target.value || null)}>
              <option value="">—</option>{Object.entries(LABELS.method).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
        </div>
        {f.fee_frequency !== 'ponctuel' && (
          <p className="text-xs text-ink-mute">
            La facture d'honoraires sera {cabinet.recurring_mode === 'auto' ? 'créée et envoyée automatiquement' : 'préparée automatiquement (à valider d’un clic)'} à chaque échéance.
          </p>
        )}
      </section>

      <Field label="Notes internes"><textarea className="input" value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      <Err e={err} />
      <Actions busy={busy} label={f.id ? 'Enregistrer' : 'Créer le dossier'} />
    </form>
  );
}

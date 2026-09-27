'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Avatar, Empty } from '@/components/Bits';
import { InvoiceBadge } from '@/components/InvoiceBadge';
import Modal from '@/components/Modal';
import { AppointmentForm, ClientForm, RequestForm, TaskForm } from '@/components/Forms';
import { TaskRow } from '@/components/TaskRow';
import { IconBack, IconMail, IconMessage, IconPause, IconPhone, IconPlay } from '@/components/Icons';
import { daysBetween, eur, frDate, frTime, invoiceBalance, LABELS, todayISO, whatsappLink } from '@/lib/utils';
import type { Appointment, Client, Invoice, ReminderLog, Request, Task } from '@/lib/types';

type Tab = 'suivi' | 'factures' | 'taches' | 'rdv' | 'infos';

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tick, memberName, cabinet } = useCabinet();
  const [c, setC] = useState<Client | null>(null);
  const [inv, setInv] = useState<Invoice[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reqs, setReqs] = useState<Request[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [tab, setTab] = useState<Tab>('suivi');
  const [modal, setModal] = useState<null | 'edit' | 'req' | 'task' | 'appt' | { t: 'task'; v: Task } | { t: 'req'; v: Request } | { t: 'appt'; v: Appointment }>(null);

  const load = useCallback(async () => {
    const sb = supabase();
    const [a, b, t, r, ap, l] = await Promise.all([
      sb.from('mya_clients').select('*').eq('id', id).single(),
      sb.from('mya_invoices').select('*').eq('client_id', id).order('issue_date', { ascending: false }),
      sb.from('mya_tasks').select('*, mya_clients(name)').eq('client_id', id).order('status').order('due_date'),
      sb.from('mya_requests').select('*').eq('client_id', id).order('received_at', { ascending: false }),
      sb.from('mya_appointments').select('*').eq('client_id', id).order('starts_at', { ascending: false }),
      sb.from('mya_reminders_log').select('*, mya_invoices(number)').eq('client_id', id).order('created_at', { ascending: false }).limit(50),
    ]);
    setC(a.data as Client);
    setInv((b.data ?? []) as Invoice[]);
    setTasks((t.data ?? []) as Task[]);
    setReqs((r.data ?? []) as Request[]);
    setAppts((ap.data ?? []) as Appointment[]);
    setLogs((l.data ?? []) as ReminderLog[]);
  }, [id]);

  useEffect(() => { load(); }, [load, tick]);

  if (!c) return <p className="text-ink-mute">Chargement…</p>;

  const today = todayISO();
  const open = inv.filter((i) => i.status === 'envoyee');
  const dueSum = open.reduce((s, i) => s + invoiceBalance(i), 0);
  const lateSum = open.filter((i) => i.due_date < today).reduce((s, i) => s + invoiceBalance(i), 0);
  const paid = inv.filter((i) => i.status === 'payee' && i.paid_at);
  const avgDelay = paid.length ? Math.round(paid.reduce((s, i) => s + daysBetween(i.issue_date, i.paid_at!), 0) / paid.length) : null;
  const avgLate = paid.length ? Math.round(paid.reduce((s, i) => s + Math.max(0, daysBetween(i.due_date, i.paid_at!)), 0) / paid.length) : null;
  const payer = avgLate === null ? null : avgLate <= 3 ? { l: 'Bon payeur', c: 'chip-sage' } : avgLate <= 20 ? { l: 'Payeur lent', c: 'chip-honey' } : { l: 'Mauvais payeur', c: 'chip-clay' };
  const wa = whatsappLink(c.phone, `Bonjour ${c.contact_name ?? ''}, `);

  async function togglePause() {
    await supabase().from('mya_clients').update({ reminders_paused: !c!.reminders_paused }).eq('id', c!.id);
    load();
  }

  // Fil de suivi : tout ce qui s'est passé avec ce client, du plus récent au plus ancien
  const feed = [
    ...reqs.map((r) => ({ d: r.received_at, k: 'req' as const, r })),
    ...appts.map((a) => ({ d: a.starts_at, k: 'appt' as const, a })),
    ...logs.map((l) => ({ d: l.created_at, k: 'log' as const, l })),
    ...inv.map((i) => ({ d: i.issue_date + 'T08:00:00', k: 'inv' as const, i })),
  ].sort((x, y) => (x.d < y.d ? 1 : -1)).slice(0, 60);

  return (
    <div className="space-y-5">
      <button onClick={() => router.push('/clients')} className="text-sm text-ink-mute flex items-center gap-1 hover:text-ink"><IconBack className="w-4 h-4" />Clients</button>

      <div className="card-pad">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="h1">{c.name}</h1>
              {c.status !== 'actif' && <span className="chip-gray">{c.status === 'prospect' ? 'Prospect' : 'Archivé'}</span>}
              {payer && <span className={payer.c}>{payer.l}</span>}
            </div>
            <p className="text-sm text-ink-mute mt-1">{[c.legal_form, c.siren && `SIREN ${c.siren}`, c.activity].filter(Boolean).join(' · ')}</p>
            <p className="text-sm mt-2">{c.contact_name}{c.owner_member && <span className="text-ink-mute"> · suivi par {memberName(c.owner_member)}</span>}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {c.phone && <a href={`tel:${c.phone}`} className="btn-ghost btn-sm"><IconPhone className="w-4 h-4" />{c.phone}</a>}
              {c.email && <a href={`mailto:${c.email}`} className="btn-ghost btn-sm"><IconMail className="w-4 h-4" />Email</a>}
              {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><IconMessage className="w-4 h-4" />WhatsApp</a>}
              <button onClick={() => setModal('edit')} className="btn-ghost btn-sm">Modifier la fiche</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full sm:w-auto">
            <Stat label="Reste dû" value={eur(dueSum)} tone={lateSum > 0 ? 'clay' : undefined} sub={lateSum > 0 ? `${eur(lateSum)} en retard` : undefined} />
            <Stat label="Délai de paiement" value={avgDelay === null ? '—' : `${avgDelay} j`} sub="en moyenne" />
            <Stat label="Honoraires" value={c.fee_amount ? eur(c.fee_amount) : '—'} sub={c.fee_amount ? `HT · ${LABELS.freq[c.fee_frequency].toLowerCase()}` : undefined} />
          </div>
        </div>
        <div className={`mt-4 flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${c.reminders_paused ? 'bg-honey-50' : 'bg-sage-50'}`}>
          <span className="flex-1">
            {c.reminders_paused ? 'Relances automatiques en pause pour ce client (ex. échéancier accordé).' : `Relances automatiques actives${cabinet.reminders_enabled ? '' : ' — mais désactivées pour tout le cabinet dans Paramètres'}.`}
          </span>
          <button onClick={togglePause} className="btn-ghost btn-sm">{c.reminders_paused ? <><IconPlay className="w-3.5 h-3.5" />Réactiver</> : <><IconPause className="w-3.5 h-3.5" />Mettre en pause</>}</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-paper-deep p-1 rounded-xl overflow-x-auto">
          {([['suivi', 'Suivi'], ['factures', `Factures · ${inv.length}`], ['taches', `Tâches · ${tasks.filter((t) => t.status !== 'fait').length}`], ['rdv', `RDV · ${appts.length}`], ['infos', 'Dossier']] as [Tab, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`tab ${tab === k ? 'tab-on' : ''}`}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <button className="btn-ghost btn-sm" onClick={() => setModal('req')}>+ Demande</button>
          <button className="btn-ghost btn-sm" onClick={() => setModal('task')}>+ Tâche</button>
          <button className="btn-ghost btn-sm" onClick={() => setModal('appt')}>+ RDV</button>
          <Link className="btn-primary btn-sm" href={`/factures/nouvelle?client=${c.id}`}>+ Facture</Link>
        </div>
      </div>

      {tab === 'suivi' && (
        <div className="card">
          {feed.length === 0 ? <Empty title="Aucun échange pour l'instant" /> : feed.map((e, i) => (
            <div key={i} className="row items-start">
              <span className="text-[11px] text-ink-mute w-20 shrink-0 pt-0.5">{frDate(e.d, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
              {e.k === 'req' && (
                <button onClick={() => setModal({ t: 'req', v: e.r })} className="flex-1 text-left text-sm">
                  <span className="chip-gray mr-2">{LABELS.channel[e.r.channel]}</span><b>{e.r.subject}</b>
                  <span className="text-ink-mute"> — {LABELS.requestStatus[e.r.status].toLowerCase()}</span>
                </button>
              )}
              {e.k === 'appt' && (
                <button onClick={() => setModal({ t: 'appt', v: e.a })} className="flex-1 text-left text-sm">
                  <span className="chip-sage mr-2">RDV {frTime(e.a.starts_at)}</span><b>{e.a.title}</b>
                </button>
              )}
              {e.k === 'log' && (
                <span className="flex-1 text-sm">
                  <span className={`${e.l.status === 'echec' ? 'chip-clay' : 'chip-honey'} mr-2`}>{e.l.kind === 'rappel_rdv' ? 'Rappel RDV' : e.l.kind === 'envoi_facture' ? 'Envoi' : `Relance ${e.l.step ?? ''}`} · {e.l.channel}</span>
                  {e.l.mya_invoices?.number && <>facture {e.l.mya_invoices.number} </>}
                  <span className="text-ink-mute">{e.l.status === 'echec' ? `— échec : ${e.l.error}` : e.l.automatic ? '— automatique' : ''}</span>
                </span>
              )}
              {e.k === 'inv' && (
                <Link href={`/factures/${e.i.id}`} className="flex-1 text-sm">
                  <span className="chip-ink mr-2">Facture</span><b>{e.i.number ?? 'Brouillon'}</b> · {eur(e.i.amount_ttc)} <span className="text-ink-mute">— {LABELS.invoiceStatus[e.i.status].toLowerCase()}</span>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'factures' && (
        <div className="card">
          {inv.length === 0 ? <Empty title="Aucune facture" /> : inv.map((i) => (
            <Link key={i.id} href={`/factures/${i.id}`} className="row hover:bg-paper/60">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">{i.number ?? 'Brouillon'} · {i.label}</span>
                <span className="block text-xs text-ink-mute">Émise le {frDate(i.issue_date)} · échéance {frDate(i.due_date)}</span>
              </span>
              <InvoiceBadge i={i} />
              <span className="text-sm font-bold w-24 text-right">{eur(i.amount_ttc)}</span>
            </Link>
          ))}
        </div>
      )}

      {tab === 'taches' && (
        <div className="card">
          {tasks.length === 0 ? <Empty title="Aucune tâche" /> : tasks.map((t) => (
            <TaskRow key={t.id} t={t} onOpen={() => setModal({ t: 'task', v: t })}
              onCheck={async () => { await supabase().from('mya_tasks').update({ status: t.status === 'fait' ? 'a_faire' : 'fait' }).eq('id', t.id); load(); }} />
          ))}
        </div>
      )}

      {tab === 'rdv' && (
        <div className="card">
          {appts.length === 0 ? <Empty title="Aucun rendez-vous" /> : appts.map((a) => (
            <button key={a.id} onClick={() => setModal({ t: 'appt', v: a })} className="row w-full text-left hover:bg-paper/60">
              <span className="w-28 text-xs text-ink-mute">{frDate(a.starts_at, { day: 'numeric', month: 'short', year: 'numeric' })}<br />{frTime(a.starts_at)}</span>
              <span className="flex-1 text-sm font-semibold">{a.title}</span>
              <span className="chip-gray">{a.status === 'prevu' ? LABELS.apptKind[a.kind] : a.status}</span>
              <Avatar id={a.member_id} />
            </button>
          ))}
        </div>
      )}

      {tab === 'infos' && (
        <div className="card-pad grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Info k="Type" v={LABELS.kind[c.kind]} />
          <Info k="Forme juridique" v={c.legal_form} />
          <Info k="SIREN" v={c.siren} />
          <Info k="Activité" v={c.activity} />
          <Info k="Régime d'imposition" v={c.tax_regime} />
          <Info k="TVA" v={c.vat_regime} />
          <Info k="Clôture" v={c.fiscal_year_end?.split('-').reverse().join('/')} />
          <Info k="Mission" v={c.mission} />
          <Info k="Adresse" v={c.address} />
          <Info k="Email" v={c.email} />
          <Info k="Paiement habituel" v={c.payment_method ? LABELS.method[c.payment_method] : null} />
          <Info k="Prochaine facture d'honoraires" v={c.fee_frequency !== 'ponctuel' && c.fee_next_date ? frDate(c.fee_next_date) : null} />
          {c.notes && <div className="sm:col-span-2"><p className="label">Notes internes</p><p className="whitespace-pre-wrap">{c.notes}</p></div>}
        </div>
      )}

      <Modal open={modal === 'edit'} onClose={() => setModal(null)} title="Modifier la fiche" wide>{modal === 'edit' && <ClientForm initial={c} onSaved={() => { setModal(null); load(); }} />}</Modal>
      <Modal open={modal === 'req' || (typeof modal === 'object' && modal?.t === 'req')} onClose={() => setModal(null)} title="Demande">
        {(modal === 'req' || (typeof modal === 'object' && modal?.t === 'req')) && <RequestForm defaultClient={c.id} initial={typeof modal === 'object' && modal?.t === 'req' ? modal.v : undefined} onSaved={() => setModal(null)} />}
      </Modal>
      <Modal open={modal === 'task' || (typeof modal === 'object' && modal?.t === 'task')} onClose={() => setModal(null)} title="Tâche">
        {(modal === 'task' || (typeof modal === 'object' && modal?.t === 'task')) && <TaskForm defaultClient={c.id} initial={typeof modal === 'object' && modal?.t === 'task' ? modal.v : undefined} onSaved={() => setModal(null)} />}
      </Modal>
      <Modal open={modal === 'appt' || (typeof modal === 'object' && modal?.t === 'appt')} onClose={() => setModal(null)} title="Rendez-vous">
        {(modal === 'appt' || (typeof modal === 'object' && modal?.t === 'appt')) && <AppointmentForm defaultClient={c.id} initial={typeof modal === 'object' && modal?.t === 'appt' ? modal.v : undefined} onSaved={() => setModal(null)} />}
      </Modal>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'clay' }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2.5 min-w-[110px]">
      <p className="text-[11px] font-semibold text-ink-mute">{label}</p>
      <p className={`font-display text-xl ${tone === 'clay' ? 'text-clay-600' : ''}`}>{value}</p>
      {sub && <p className="text-[11px] text-ink-mute">{sub}</p>}
    </div>
  );
}

function Info({ k, v }: { k: string; v: string | null | undefined }) {
  return <div><p className="label">{k}</p><p className="capitalize-first">{v || '—'}</p></div>;
}

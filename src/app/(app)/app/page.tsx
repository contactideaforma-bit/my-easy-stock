'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Avatar, Empty, PriorityDot } from '@/components/Bits';
import Modal from '@/components/Modal';
import { AppointmentForm, RequestForm, TaskForm } from '@/components/Forms';
import { IconAlert, IconChevron, IconPhone } from '@/components/Icons';
import { TaskRow } from '@/components/TaskRow';
import { PayerDot, usePayers } from '@/components/Payer';
import { addDays, daysBetween, eur, frDate, frTime, invoiceBalance, LABELS, todayISO } from '@/lib/utils';
import type { Appointment, Invoice, Request, Task } from '@/lib/types';

export default function Journee() {
  const { me, members, tick } = useCabinet();
  const [scope, setScope] = useState<'moi' | 'tous'>('moi');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reqs, setReqs] = useState<Request[]>([]);
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [drafts, setDrafts] = useState(0);
  const [cashed, setCashed] = useState(0);
  const [autoSent, setAutoSent] = useState(0);
  const [edit, setEdit] = useState<null | { t: 'task'; v: Task } | { t: 'req'; v: Request } | { t: 'appt'; v: Appointment }>(null);
  const today = todayISO();
  const payers = usePayers(tick);

  const load = useCallback(async () => {
    const sb = supabase();
    const monthStart = today.slice(0, 8) + '01';
    const dayStart = new Date(today + 'T00:00:00'); const dayEnd = new Date(addDays(today, 2) + 'T00:00:00');
    const mine = scope === 'moi';
    let tq = sb.from('mya_tasks').select('*, mya_clients(name)').neq('status', 'fait').lte('due_date', addDays(today, 1)).order('due_date').order('priority', { ascending: false });
    let rq = sb.from('mya_requests').select('*, mya_clients(name)').neq('status', 'traitee').order('received_at', { ascending: false }).limit(12);
    let aq = sb.from('mya_appointments').select('*, mya_clients(name,phone,email)').gte('starts_at', dayStart.toISOString()).lt('starts_at', dayEnd.toISOString()).neq('status', 'annule').order('starts_at');
    if (mine) { tq = tq.eq('assigned_to', me.user_id); rq = rq.or(`assigned_to.eq.${me.user_id},assigned_to.is.null`); aq = aq.eq('member_id', me.user_id); }
    const [t, r, a, inv, dr, pay, log] = await Promise.all([
      tq, rq, aq,
      sb.from('mya_invoices').select('*, mya_clients(name,email,phone,contact_name,reminders_paused)').eq('status', 'envoyee').order('due_date'),
      sb.from('mya_invoices').select('id', { count: 'exact', head: true }).eq('status', 'brouillon'),
      sb.from('mya_payments').select('amount').gte('paid_on', monthStart),
      sb.from('mya_reminders_log').select('id', { count: 'exact', head: true }).eq('automatic', true).eq('status', 'envoye').gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    ]);
    setTasks((t.data ?? []) as Task[]);
    setReqs((r.data ?? []) as Request[]);
    setAppts((a.data ?? []) as Appointment[]);
    setInvoices((inv.data ?? []) as Invoice[]);
    setDrafts(dr.count ?? 0);
    setCashed((pay.data ?? []).reduce((s, p) => s + Number(p.amount), 0));
    setAutoSent(log.count ?? 0);
  }, [scope, me.user_id, today]);

  useEffect(() => { load(); }, [load, tick]);

  async function toggleTask(t: Task) {
    setTasks((s) => s.filter((x) => x.id !== t.id));
    await supabase().from('mya_tasks').update({ status: 'fait' }).eq('id', t.id);
  }

  const toCollect = invoices.reduce((s, i) => s + invoiceBalance(i), 0);
  const late = invoices.filter((i) => i.due_date < today);
  const lateSum = late.reduce((s, i) => s + invoiceBalance(i), 0);
  const toCall = late.filter((i) => daysBetween(i.due_date, today) >= 30).slice(0, 5);
  const lateTasks = tasks.filter((t) => t.due_date && t.due_date < today);
  const todayTasks = tasks.filter((t) => !t.due_date || t.due_date >= today);
  const todayAppts = appts.filter((a) => todayISO(new Date(a.starts_at)) === today);
  const tomorrowAppts = appts.filter((a) => !todayAppts.includes(a));
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-mute capitalize">{frDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="h1">{hello} {me.full_name.split(' ')[0]}</h1>
          <p className="text-sm text-ink-soft mt-1">{summary(todayAppts.length, lateTasks.length + todayTasks.length, reqs.length)}</p>
        </div>
        {members.length > 1 && (
          <div className="flex gap-1 bg-paper-deep p-1 rounded-xl">
            <button onClick={() => setScope('moi')} className={`tab ${scope === 'moi' ? 'tab-on' : ''}`}>Pour moi</button>
            <button onClick={() => setScope('tous')} className={`tab ${scope === 'tous' ? 'tab-on' : ''}`}>Tout le cabinet</button>
          </div>
        )}
      </div>

      {/* Argent */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="À encaisser" value={eur(toCollect)} sub={`${invoices.length} facture${invoices.length > 1 ? 's' : ''}`} href="/factures" />
        <Kpi label="En retard" value={eur(lateSum)} sub={`${late.length} facture${late.length > 1 ? 's' : ''}`} tone={late.length ? 'clay' : undefined} href="/factures?f=retard" />
        <Kpi label="Encaissé ce mois" value={eur(cashed)} tone="sage" href="/factures?f=payee" />
        <Kpi label="Relances auto (7 j)" value={String(autoSent)} sub="envoyées pour vous" href="/relances" />
      </div>

      {drafts > 0 && (
        <Link href="/factures?f=brouillon" className="flex items-center gap-3 card-pad bg-honey-50 border-honey-100 hover:shadow-pop transition">
          <IconAlert className="w-5 h-5 text-honey-600" />
          <span className="text-sm flex-1"><b>{drafts} facture{drafts > 1 ? 's' : ''} d'honoraires prête{drafts > 1 ? 's' : ''}</b> à vérifier et envoyer.</span>
          <IconChevron className="w-4 h-4 text-ink-mute" />
        </Link>
      )}

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          {/* Agenda du jour */}
          <section className="card">
            <Head title="Rendez-vous" href="/agenda" />
            {todayAppts.length === 0 && tomorrowAppts.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-ink-mute">Aucun rendez-vous aujourd'hui ni demain.</p>
            ) : (
              <div>
                {todayAppts.map((a) => <ApptRow key={a.id} a={a} onClick={() => setEdit({ t: 'appt', v: a })} />)}
                {tomorrowAppts.length > 0 && <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Demain</p>}
                {tomorrowAppts.map((a) => <ApptRow key={a.id} a={a} onClick={() => setEdit({ t: 'appt', v: a })} />)}
              </div>
            )}
          </section>

          {/* Tâches */}
          <section className="card">
            <Head title="À faire" href="/taches" />
            {tasks.length === 0 ? (
              <Empty title="Rien d'urgent" text="Aucune tâche en retard ni prévue aujourd'hui." />
            ) : (
              <div>
                {lateTasks.length > 0 && <p className="px-4 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-clay-600">En retard</p>}
                {lateTasks.map((t) => <TaskRow key={t.id} t={t} onCheck={() => toggleTask(t)} onOpen={() => setEdit({ t: 'task', v: t })} />)}
                {todayTasks.length > 0 && lateTasks.length > 0 && <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Aujourd'hui et demain</p>}
                {todayTasks.map((t) => <TaskRow key={t.id} t={t} onCheck={() => toggleTask(t)} onOpen={() => setEdit({ t: 'task', v: t })} />)}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-2 space-y-5">
          {/* Demandes */}
          <section className="card">
            <Head title="Demandes en attente" href="/sollicitations" count={reqs.length} />
            {reqs.length === 0 ? <p className="px-4 pb-4 text-sm text-ink-mute">Boîte vide. Bravo.</p> : reqs.slice(0, 6).map((r) => (
              <button key={r.id} onClick={() => setEdit({ t: 'req', v: r })} className="row w-full text-left hover:bg-paper/60">
                <PriorityDot p={r.priority} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate">{r.subject}</span>
                  <span className="block text-xs text-ink-mute truncate">{r.mya_clients?.name ?? r.contact_name ?? '—'} · {LABELS.channel[r.channel]}</span>
                </span>
                {r.status === 'nouvelle' && <span className="chip-rose">Nouveau</span>}
              </button>
            ))}
          </section>

          {/* Clients à appeler */}
          <section className="card">
            <Head title="Impayés à appeler vous-même" href="/factures?f=retard" />
            {toCall.length === 0 ? <p className="px-4 pb-4 text-sm text-ink-mute">Aucun retard de plus de 30 jours. Les relances automatiques s'occupent du reste.</p> : toCall.map((i) => (
              <Link key={i.id} href={`/factures/${i.id}`} className="row hover:bg-paper/60">
                <span className="w-8 h-8 rounded-full bg-clay-50 text-clay-700 flex items-center justify-center"><IconPhone className="w-4 h-4" /></span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold truncate"><PayerDot p={payers[i.client_id]} />{i.mya_clients?.name}</span>
                  <span className="block text-xs text-ink-mute">{i.number} · {daysBetween(i.due_date, today)} j de retard</span>
                </span>
                <span className="text-sm font-bold text-clay-700">{eur(invoiceBalance(i))}</span>
              </Link>
            ))}
          </section>
        </div>
      </div>

      <Modal open={edit?.t === 'task'} onClose={() => setEdit(null)} title="Tâche">{edit?.t === 'task' && <TaskForm initial={edit.v} onSaved={() => setEdit(null)} />}</Modal>
      <Modal open={edit?.t === 'req'} onClose={() => setEdit(null)} title="Demande">{edit?.t === 'req' && <RequestForm initial={edit.v} onSaved={() => setEdit(null)} />}</Modal>
      <Modal open={edit?.t === 'appt'} onClose={() => setEdit(null)} title="Rendez-vous">{edit?.t === 'appt' && <AppointmentForm initial={edit.v} onSaved={() => setEdit(null)} />}</Modal>
    </div>
  );
}

function summary(appts: number, tasks: number, reqs: number) {
  const parts = [];
  parts.push(appts ? `${appts} rendez-vous` : 'aucun rendez-vous');
  parts.push(`${tasks} tâche${tasks > 1 ? 's' : ''}`);
  parts.push(`${reqs} demande${reqs > 1 ? 's' : ''} en attente`);
  return `Au programme : ${parts.join(', ')}.`;
}

function Kpi({ label, value, sub, tone, href }: { label: string; value: string; sub?: string; tone?: 'clay' | 'sage'; href: string }) {
  return (
    <Link href={href} className="card-pad hover:shadow-pop transition">
      <p className="text-xs font-semibold text-ink-mute">{label}</p>
      <p className={`kpi-num mt-1 ${tone === 'clay' ? 'text-clay-600' : tone === 'sage' ? 'text-mint-700' : ''}`}>{value}</p>
      {sub && <p className="text-xs text-ink-mute mt-0.5">{sub}</p>}
    </Link>
  );
}

function Head({ title, href, count }: { title: string; href: string; count?: number }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <h2 className="h2">{title}{count ? <span className="ml-2 chip-gray">{count}</span> : null}</h2>
      <Link href={href} className="text-xs font-semibold text-rose-700 hover:underline">Tout voir</Link>
    </div>
  );
}

function ApptRow({ a, onClick }: { a: Appointment; onClick: () => void }) {
  return (
    <button onClick={onClick} className="row w-full text-left hover:bg-paper/60">
      <span className="w-14 text-sm font-bold text-rose-700">{frTime(a.starts_at)}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate">{a.title}</span>
        <span className="block text-xs text-ink-mute truncate">{a.mya_clients?.name ?? '—'} · {LABELS.apptKind[a.kind]}</span>
      </span>
      <Avatar id={a.member_id} />
    </button>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Field, Toast } from '@/components/Bits';
import Modal from '@/components/Modal';
import InvoiceEditor from '@/components/InvoiceEditor';
import { InvoiceBadge } from '@/components/InvoiceBadge';
import { IconBack, IconMail, IconMessage, IconPause, IconPlay, IconPrinter, IconSend } from '@/components/Icons';
import { invoiceVars, smsText } from '@/lib/messages';
import { nextRuleDate } from '@/lib/schedule';
import { eur, fillTemplate, frDate, frTime, invoiceBalance, LABELS, relDay, todayISO, whatsappLink } from '@/lib/utils';
import type { Client, Invoice, Payment, ReminderLog, ReminderRule } from '@/lib/types';

const baseUrl = () => process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export default function FacturePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { cabinet, tick, bump } = useCabinet();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [pays, setPays] = useState<Payment[]>([]);
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [modal, setModal] = useState<null | 'pay' | 'remind'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    const sb = supabase();
    const { data } = await sb.from('mya_invoices').select('*').eq('id', id).single();
    if (!data) return;
    const [c, p, l, r] = await Promise.all([
      sb.from('mya_clients').select('*').eq('id', data.client_id).single(),
      sb.from('mya_payments').select('*').eq('invoice_id', id).order('paid_on'),
      sb.from('mya_reminders_log').select('*').eq('invoice_id', id).order('created_at', { ascending: false }),
      sb.from('mya_reminder_rules').select('*').order('step'),
    ]);
    setInv(data as Invoice); setClient(c.data as Client); setPays((p.data ?? []) as Payment[]);
    setLogs((l.data ?? []) as ReminderLog[]); setRules((r.data ?? []) as ReminderRule[]);
  }, [id]);

  useEffect(() => { load(); }, [load, tick]);

  if (!inv || !client) return <p className="text-ink-mute">Chargement…</p>;

  if (inv.status === 'brouillon')
    return (
      <div className="space-y-5">
        <Link href="/factures?f=brouillon" className="text-sm text-ink-mute flex items-center gap-1 hover:text-ink"><IconBack className="w-4 h-4" />Brouillons</Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="h1">Brouillon — {client.name}</h1>
          {inv.is_recurring && <span className="chip-honey">Préparée automatiquement</span>}
          <button className="btn-danger btn-sm ml-auto" onClick={async () => {
            if (!confirm('Supprimer ce brouillon ?')) return;
            await supabase().from('mya_invoices').delete().eq('id', inv.id); bump(); router.push('/factures?f=brouillon');
          }}>Supprimer le brouillon</button>
        </div>
        <InvoiceEditor initial={inv} />
      </div>
    );

  const balance = invoiceBalance(inv);
  const nxt = inv.status === 'envoyee' ? nextRuleDate(inv, rules) : null;
  const paused = inv.reminders_paused || client.reminders_paused;
  const today = todayISO();

  async function togglePause() {
    await supabase().from('mya_invoices').update({ reminders_paused: !inv!.reminders_paused }).eq('id', inv!.id);
    load();
  }

  async function resend() {
    setBusy(true);
    try {
      const r = await api<{ results: { channel: string; ok: boolean; error?: string }[] }>('/api/invoices/send', { invoiceId: inv!.id, channels: ['email'] });
      const bad = r.results.find((x) => !x.ok);
      flash(bad ? `Échec : ${bad.error}` : 'Facture renvoyée par email');
    } catch (e: any) { flash(e.message); }
    setBusy(false); load();
  }

  async function cancel() {
    if (!confirm("Annuler cette facture ? Elle sort des relances. (Comptablement, pensez à émettre un avoir.)")) return;
    await supabase().from('mya_invoices').update({ status: 'annulee' }).eq('id', inv!.id);
    bump(); load();
  }

  return (
    <div className="space-y-5">
      <Link href="/factures" className="text-sm text-ink-mute flex items-center gap-1 hover:text-ink no-print"><IconBack className="w-4 h-4" />Factures</Link>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap"><h1 className="h1">{inv.number}</h1><InvoiceBadge i={inv} /></div>
          <p className="text-sm mt-1"><Link href={`/clients/${client.id}`} className="font-semibold hover:underline">{client.name}</Link> <span className="text-ink-mute">· {inv.label} · émise le {frDate(inv.issue_date)} · échéance {frDate(inv.due_date)}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/f/${inv.public_token}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm"><IconPrinter className="w-4 h-4" />Voir / imprimer</a>
          {inv.status === 'envoyee' && <button className="btn-ghost btn-sm" onClick={resend} disabled={busy}><IconMail className="w-4 h-4" />Renvoyer</button>}
          {inv.status !== 'annulee' && inv.status !== 'payee' && <button className="btn-danger btn-sm" onClick={cancel}>Annuler</button>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Box label="Montant TTC" value={eur(inv.amount_ttc)} />
            <Box label="Déjà payé" value={eur(inv.paid_amount)} tone="sage" />
            <Box label="Reste à payer" value={eur(balance)} tone={balance > 0 && inv.due_date < today && inv.status === 'envoyee' ? 'clay' : undefined} />
          </div>

          {inv.status === 'envoyee' && (
            <div className="card-pad flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => setModal('pay')}>Enregistrer un paiement</button>
              <button className="btn-ghost" onClick={() => setModal('remind')}><IconSend className="w-4 h-4" />Relancer maintenant</button>
              <button className="btn-ghost" onClick={async () => {
                const { error } = await supabase().from('mya_payments').insert({ cabinet_id: cabinet.id, invoice_id: inv.id, amount: balance, paid_on: today, method: client.payment_method ?? 'virement' });
                if (!error) { flash('Facture soldée'); bump(); load(); }
              }}>Tout est payé</button>
            </div>
          )}

          <section className="card">
            <h2 className="h2 px-4 pt-4 pb-2">Paiements reçus</h2>
            {pays.length === 0 ? <p className="px-4 pb-4 text-sm text-ink-mute">Aucun paiement enregistré.</p> : pays.map((p) => (
              <div key={p.id} className="row">
                <span className="flex-1 text-sm">{frDate(p.paid_on)} · {LABELS.method[p.method]}{p.note ? ` · ${p.note}` : ''}</span>
                <span className="font-semibold text-mint-700">{eur(p.amount)}</span>
                <button className="text-xs text-ink-mute hover:text-clay-600" onClick={async () => {
                  if (!confirm('Supprimer ce paiement ?')) return;
                  await supabase().from('mya_payments').delete().eq('id', p.id); bump(); load();
                }}>Retirer</button>
              </div>
            ))}
          </section>

          <section className="card">
            <h2 className="h2 px-4 pt-4 pb-2">Historique des envois et relances</h2>
            {logs.length === 0 ? <p className="px-4 pb-4 text-sm text-ink-mute">Rien pour l'instant.</p> : logs.map((l) => (
              <details key={l.id} className="border-b border-paper-line last:border-0">
                <summary className="row cursor-pointer list-none">
                  <span className={l.status === 'echec' ? 'chip-clay' : l.status === 'prepare' ? 'chip-gray' : 'chip-sage'}>{l.channel}</span>
                  <span className="flex-1 text-sm">
                    {l.kind === 'envoi_facture' ? 'Envoi de la facture' : `Relance${l.step ? ` étape ${l.step}` : ' manuelle'}`}
                    <span className="text-ink-mute"> · {l.automatic ? 'automatique' : 'manuelle'}{l.status === 'echec' ? ` · échec : ${l.error}` : l.status === 'prepare' ? ' · préparée' : ''}</span>
                  </span>
                  <span className="text-xs text-ink-mute">{frDate(l.created_at, { day: 'numeric', month: 'short' })} {frTime(l.created_at)}</span>
                </summary>
                {l.message && <pre className="whitespace-pre-wrap font-sans text-xs text-ink-soft bg-paper mx-4 mb-3 p-3 rounded-lg">{l.subject ? `Objet : ${l.subject}\n\n` : ''}{l.message}</pre>}
              </details>
            ))}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card-pad space-y-3">
            <h2 className="h2">Relances automatiques</h2>
            {inv.status !== 'envoyee' ? <p className="text-sm text-ink-mute">Aucune relance : facture {LABELS.invoiceStatus[inv.status].toLowerCase()}.</p> : (
              <>
                <ol className="space-y-2">
                  {rules.filter((r) => r.active).map((r) => {
                    const d = new Date(inv.due_date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + r.offset_days);
                    const date = d.toISOString().slice(0, 10);
                    const done = r.step <= inv.reminder_level;
                    return (
                      <li key={r.id} className="flex items-center gap-2 text-sm">
                        <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center ${done ? 'bg-rose-600 text-white' : 'bg-paper-deep text-ink-mute'}`}>{r.step}</span>
                        <span className="flex-1">{LABELS.tone[r.tone]} <span className="text-ink-mute">· {r.channels.join(' + ')}</span></span>
                        <span className="text-xs text-ink-mute">{done ? 'envoyée' : frDate(date, { day: 'numeric', month: 'short' })}</span>
                      </li>
                    );
                  })}
                </ol>
                <p className="text-xs text-ink-soft">
                  {paused ? (client.reminders_paused ? 'En pause pour tout ce client.' : 'En pause pour cette facture.')
                    : !cabinet.reminders_enabled ? 'Désactivées pour le cabinet (Paramètres).'
                      : nxt ? `Prochaine : étape ${nxt.rule.step}, ${nxt.date <= today ? 'demain matin' : relDay(nxt.date)}.` : 'Scénario terminé : un appel de votre part est recommandé.'}
                </p>
                <button className="btn-ghost btn-sm w-full" onClick={togglePause}>
                  {inv.reminders_paused ? <><IconPlay className="w-3.5 h-3.5" />Réactiver pour cette facture</> : <><IconPause className="w-3.5 h-3.5" />Mettre en pause (promesse, échéancier…)</>}
                </button>
              </>
            )}
          </section>
          <section className="card-pad text-sm space-y-1">
            <h2 className="h2 mb-2">Détail</h2>
            {inv.lines.map((l, i) => <div key={i} className="flex justify-between gap-3"><span className="text-ink-soft">{l.label} {l.qty !== 1 && `× ${l.qty}`}</span><span>{eur(l.qty * l.unit_price)}</span></div>)}
            <div className="flex justify-between pt-2 border-t border-paper-line mt-2"><span className="text-ink-mute">HT</span><span>{eur(inv.amount_ht)}</span></div>
            <div className="flex justify-between"><span className="text-ink-mute">TVA {inv.vat_rate} %</span><span>{eur(inv.amount_ttc - inv.amount_ht)}</span></div>
          </section>
        </div>
      </div>

      <Modal open={modal === 'pay'} onClose={() => setModal(null)} title="Paiement reçu">
        {modal === 'pay' && <PaymentForm inv={inv} defaultMethod={client.payment_method} onSaved={() => { setModal(null); flash('Paiement enregistré'); bump(); load(); }} />}
      </Modal>
      <Modal open={modal === 'remind'} onClose={() => setModal(null)} title="Relancer maintenant" wide>
        {modal === 'remind' && <RemindForm inv={inv} client={client} rules={rules} onDone={(m) => { setModal(null); flash(m); load(); }} />}
      </Modal>
      <Toast msg={toast} />
    </div>
  );
}

function Box({ label, value, tone }: { label: string; value: string; tone?: 'clay' | 'sage' }) {
  return (
    <div className="card-pad">
      <p className="text-xs font-semibold text-ink-mute">{label}</p>
      <p className={`kpi-num mt-1 text-xl sm:text-2xl ${tone === 'clay' ? 'text-clay-600' : tone === 'sage' ? 'text-mint-700' : ''}`}>{value}</p>
    </div>
  );
}

function PaymentForm({ inv, defaultMethod, onSaved }: { inv: Invoice; defaultMethod: string | null; onSaved: () => void }) {
  const { cabinet } = useCabinet();
  const [amount, setAmount] = useState(String(invoiceBalance(inv)));
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState(defaultMethod ?? 'virement');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const { error } = await supabase().from('mya_payments').insert({ cabinet_id: cabinet.id, invoice_id: inv.id, amount: Number(amount), paid_on: date, method, note: note || null });
      if (error) return setErr(error.message);
      onSaved();
    }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Montant (€)"><input type="number" step="0.01" required className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Reçu le"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Moyen" className="col-span-2">
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(LABELS.method).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Note" className="col-span-2"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. 1er versement de l'échéancier" /></Field>
      </div>
      {err && <p className="text-sm text-clay-700">{err}</p>}
      <button className="btn-primary w-full">Enregistrer</button>
      <p className="text-xs text-ink-mute">Paiement partiel accepté : les relances continuent sur le reste dû.</p>
    </form>
  );
}

function RemindForm({ inv, client, rules, onDone }: { inv: Invoice; client: Client; rules: ReminderRule[]; onDone: (msg: string) => void }) {
  const { cabinet } = useCabinet();
  const active = rules.filter((r) => r.active);
  const suggested = active.find((r) => r.step > inv.reminder_level) ?? active[active.length - 1];
  const [ruleId, setRuleId] = useState(suggested?.id ?? '');
  const rule = active.find((r) => r.id === ruleId);
  const vars = invoiceVars(inv, client, cabinet, baseUrl());
  const [subject, setSubject] = useState(rule ? fillTemplate(rule.subject, vars) : `Facture ${inv.number}`);
  const [body, setBody] = useState(rule ? fillTemplate(rule.body, vars) : '');
  const [sms, setSms] = useState(smsText(inv, client, cabinet, rule?.tone ?? 'courtois', baseUrl()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pick(id: string) {
    setRuleId(id);
    const r = active.find((x) => x.id === id);
    if (r) { setSubject(fillTemplate(r.subject, vars)); setBody(fillTemplate(r.body, vars)); setSms(smsText(inv, client, cabinet, r.tone, baseUrl())); }
  }

  async function send(channel: 'email' | 'sms' | 'whatsapp') {
    setBusy(true); setErr(null);
    try {
      if (channel === 'whatsapp') {
        const link = whatsappLink(client.phone, body);
        if (!link) throw new Error('Pas de numéro de mobile pour ce client');
        window.open(link, '_blank');
      }
      const r = await api<{ results: { ok: boolean; error?: string }[] }>('/api/reminders/send', {
        invoiceId: inv.id, channel, subject, body, smsBody: sms, step: rule?.step ?? null,
      });
      const bad = r.results.find((x) => !x.ok);
      if (bad) throw new Error(bad.error);
      onDone(channel === 'whatsapp' ? 'Message WhatsApp préparé et noté dans l’historique' : `Relance envoyée par ${channel === 'email' ? 'email' : 'SMS'}`);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <Field label="Modèle">
        <select className="input" value={ruleId} onChange={(e) => pick(e.target.value)}>
          {active.map((r) => <option key={r.id} value={r.id}>Étape {r.step} — {LABELS.tone[r.tone]}</option>)}
        </select>
      </Field>
      <Field label="Objet (email)"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="Message (email / WhatsApp)"><textarea className="input min-h-[200px]" value={body} onChange={(e) => setBody(e.target.value)} /></Field>
      <Field label={`SMS (${sms.length} caractères)`}><textarea className="input min-h-[70px]" value={sms} onChange={(e) => setSms(e.target.value)} /></Field>
      {err && <p className="text-sm text-clay-700 bg-clay-50 rounded-lg px-3 py-2">{err}</p>}
      <div className="grid sm:grid-cols-3 gap-2 pt-1">
        <button className="btn-primary" disabled={busy || !client.email} onClick={() => send('email')}><IconMail className="w-4 h-4" />Email</button>
        <button className="btn-ghost" disabled={busy || !client.phone} onClick={() => send('sms')}><IconSend className="w-4 h-4" />SMS</button>
        <button className="btn-ghost" disabled={busy || !client.phone} onClick={() => send('whatsapp')}><IconMessage className="w-4 h-4" />WhatsApp</button>
      </div>
      {(!client.email || !client.phone) && <p className="text-xs text-ink-mute">Complétez l'email et le mobile dans la fiche client pour débloquer tous les canaux.</p>}
    </div>
  );
}

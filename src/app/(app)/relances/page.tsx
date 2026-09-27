'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Empty, Field, Toast } from '@/components/Bits';
import { eur, frDate, frTime, LABELS, todayISO } from '@/lib/utils';
import { dueRule } from '@/lib/schedule';
import type { Invoice, ReminderLog, ReminderRule } from '@/lib/types';

const VARS = ['{contact}', '{client}', '{numero}', '{montant}', '{reste}', '{echeance}', '{jours_retard}', '{lien}', '{lien_paiement}', '{iban}', '{cabinet}', '{tel_cabinet}'];

export default function Relances() {
  const { me, cabinet, tick } = useCabinet();
  const [tab, setTab] = useState<'journal' | 'prevues' | 'scenario'>('journal');
  const [logs, setLogs] = useState<ReminderLog[]>([]);
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [soon, setSoon] = useState<(Invoice & { rule: ReminderRule })[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const owner = me.role === 'titulaire';

  const load = useCallback(async () => {
    const sb = supabase();
    const [l, r, inv] = await Promise.all([
      sb.from('mya_reminders_log').select('*, mya_clients(name), mya_invoices(number)').order('created_at', { ascending: false }).limit(200),
      sb.from('mya_reminder_rules').select('*').order('step'),
      sb.from('mya_invoices').select('*, mya_clients(name,email,phone,contact_name,reminders_paused)').eq('status', 'envoyee').eq('reminders_paused', false),
    ]);
    setLogs((l.data ?? []) as ReminderLog[]);
    const rs = (r.data ?? []) as ReminderRule[];
    setRules(rs);
    // Ce qui partira demain matin
    const tomorrow = new Date(Date.now() + 86400000);
    const t = todayISO(tomorrow);
    setSoon(((inv.data ?? []) as Invoice[])
      .filter((i) => !i.mya_clients?.reminders_paused)
      .map((i) => ({ ...i, rule: dueRule(i, rs, t)! }))
      .filter((i) => i.rule));
  }, []);

  useEffect(() => { load(); }, [load, tick]);

  async function saveRule(r: ReminderRule) {
    const { error } = await supabase().from('mya_reminder_rules').update({
      offset_days: r.offset_days, channels: r.channels, tone: r.tone, subject: r.subject, body: r.body, active: r.active,
    }).eq('id', r.id);
    setToast(error ? error.message : 'Étape enregistrée');
    setTimeout(() => setToast(null), 2500);
  }

  async function addStep() {
    const step = (rules[rules.length - 1]?.step ?? 0) + 1;
    const offset = (rules[rules.length - 1]?.offset_days ?? 0) + 15;
    await supabase().from('mya_reminder_rules').insert({
      cabinet_id: cabinet.id, step, offset_days: offset, channels: ['email'], tone: 'ferme',
      subject: 'Relance : facture {numero}', body: 'Bonjour {contact},\n\nLa facture {numero} ({reste}) reste impayée.\n\n{lien}\n\n{cabinet}',
    });
    load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Relances</h1>
        <p className="text-sm text-ink-mute">
          {cabinet.reminders_enabled ? 'Chaque matin à 8 h, l’appli envoie les relances prévues. Vous n’avez plus à y penser.' : 'Relances automatiques désactivées — activez-les dans Paramètres.'}
        </p>
      </div>

      <div className="flex gap-1 bg-paper-deep p-1 rounded-xl w-fit">
        <button onClick={() => setTab('journal')} className={`tab ${tab === 'journal' ? 'tab-on' : ''}`}>Journal</button>
        <button onClick={() => setTab('prevues')} className={`tab ${tab === 'prevues' ? 'tab-on' : ''}`}>Demain matin · {soon.length}</button>
        <button onClick={() => setTab('scenario')} className={`tab ${tab === 'scenario' ? 'tab-on' : ''}`}>Scénario</button>
      </div>

      {tab === 'journal' && (
        <div className="card">
          {logs.length === 0 ? <Empty title="Aucun envoi pour l'instant" /> : logs.map((l) => (
            <details key={l.id} className="border-b border-paper-line last:border-0">
              <summary className="row cursor-pointer list-none">
                <span className={l.status === 'echec' ? 'chip-clay' : l.status === 'prepare' ? 'chip-gray' : 'chip-sage'}>{l.channel}</span>
                <span className="flex-1 min-w-0 text-sm">
                  <b>{l.mya_clients?.name ?? '—'}</b>
                  <span className="text-ink-mute"> · {l.kind === 'rappel_rdv' ? 'rappel de RDV' : l.kind === 'envoi_facture' ? `envoi facture ${l.mya_invoices?.number ?? ''}` : `relance ${l.step ? `étape ${l.step}` : 'manuelle'} ${l.mya_invoices?.number ?? ''}`}</span>
                  {l.status === 'echec' && <span className="block text-xs text-clay-700">Échec : {l.error}</span>}
                </span>
                <span className="text-xs text-ink-mute text-right">{l.automatic ? 'auto' : 'manuel'}<br />{frDate(l.created_at, { day: 'numeric', month: 'short' })} {frTime(l.created_at)}</span>
              </summary>
              {l.message && <pre className="whitespace-pre-wrap font-sans text-xs text-ink-soft bg-paper mx-4 mb-3 p-3 rounded-lg">{l.recipient ? `À : ${l.recipient}\n` : ''}{l.subject ? `Objet : ${l.subject}\n\n` : ''}{l.message}</pre>}
            </details>
          ))}
        </div>
      )}

      {tab === 'prevues' && (
        <div className="card">
          {soon.length === 0 ? <Empty title="Aucune relance prévue demain" /> : soon.map((i) => (
            <Link key={i.id} href={`/factures/${i.id}`} className="row hover:bg-paper/60">
              <span className="chip-honey">Étape {i.rule.step}</span>
              <span className="flex-1 text-sm"><b>{i.mya_clients?.name}</b> <span className="text-ink-mute">· {i.number} · {LABELS.tone[i.rule.tone]} · {i.rule.channels.join(' + ')}</span></span>
              <span className="font-semibold text-sm">{eur(Number(i.amount_ttc) - Number(i.paid_amount))}</span>
            </Link>
          ))}
          <p className="px-4 py-3 text-xs text-ink-mute border-t border-paper-line">Pour retenir une relance (promesse de paiement, échéancier), mettez la facture ou le client en pause.</p>
        </div>
      )}

      {tab === 'scenario' && (
        <div className="space-y-4">
          {!owner && <p className="text-sm text-honey-600">Seule la titulaire peut modifier le scénario.</p>}
          <p className="text-sm text-ink-soft">Variables utilisables : {VARS.map((v) => <code key={v} className="text-xs bg-paper-deep rounded px-1 mx-0.5">{v}</code>)}</p>
          {rules.map((r, idx) => <RuleCard key={r.id} rule={r} disabled={!owner} onChange={(nr) => setRules((s) => s.map((x, j) => (j === idx ? nr : x)))} onSave={saveRule} />)}
          {owner && <button className="btn-ghost" onClick={addStep}>+ Ajouter une étape</button>}
        </div>
      )}
      <Toast msg={toast} />
    </div>
  );
}

function RuleCard({ rule, onChange, onSave, disabled }: { rule: ReminderRule; onChange: (r: ReminderRule) => void; onSave: (r: ReminderRule) => void; disabled: boolean }) {
  const set = (k: keyof ReminderRule, v: any) => onChange({ ...rule, [k]: v });
  const toggleCh = (c: string) => set('channels', rule.channels.includes(c) ? rule.channels.filter((x) => x !== c) : [...rule.channels, c]);
  return (
    <fieldset disabled={disabled} className={`card-pad space-y-3 ${rule.active ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center">{rule.step}</span>
        <div className="flex items-center gap-2 text-sm">
          <input type="number" className="input w-20" value={rule.offset_days} onChange={(e) => set('offset_days', Number(e.target.value))} />
          <span>jours {rule.offset_days < 0 ? 'avant' : 'après'} l'échéance</span>
        </div>
        <select className="input w-auto" value={rule.tone} onChange={(e) => set('tone', e.target.value)}>
          {Object.entries(LABELS.tone).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex gap-1.5">
          {['email', 'sms'].map((c) => (
            <button type="button" key={c} onClick={() => toggleCh(c)} className={rule.channels.includes(c) ? 'chip-ink py-1 px-3' : 'chip-gray py-1 px-3'}>{c === 'email' ? 'Email' : 'SMS'}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm ml-auto"><input type="checkbox" checked={rule.active} onChange={(e) => set('active', e.target.checked)} className="accent-rose-600" />Active</label>
      </div>
      <Field label="Objet de l'email"><input className="input" value={rule.subject} onChange={(e) => set('subject', e.target.value)} /></Field>
      <Field label="Message"><textarea className="input min-h-[160px]" value={rule.body} onChange={(e) => set('body', e.target.value)} /></Field>
      <p className="text-xs text-ink-mute">Le SMS utilise automatiquement une version courte avec le lien de paiement.</p>
      <div className="flex justify-end"><button type="button" className="btn-primary btn-sm" onClick={() => onSave(rule)}>Enregistrer l'étape</button></div>
    </fieldset>
  );
}

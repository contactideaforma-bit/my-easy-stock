'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Empty } from '@/components/Bits';
import { InvoiceBadge } from '@/components/InvoiceBadge';
import { IconPlus, IconSearch } from '@/components/Icons';
import { PayerDot, usePayers } from '@/components/Payer';
import { nextRuleDate } from '@/lib/schedule';
import { eur, frDate, invoiceBalance, relDay, todayISO } from '@/lib/utils';
import type { Invoice, ReminderRule } from '@/lib/types';

const FILTERS = [
  ['encaisser', 'À encaisser'],
  ['retard', 'En retard'],
  ['brouillon', 'Brouillons'],
  ['payee', 'Payées'],
  ['toutes', 'Toutes'],
] as const;

export default function FacturesPage() {
  return <Suspense><Factures /></Suspense>;
}

function Factures() {
  const router = useRouter();
  const params = useSearchParams();
  const { tick, cabinet } = useCabinet();
  const f = (params.get('f') ?? 'encaisser') as (typeof FILTERS)[number][0];
  const [rows, setRows] = useState<Invoice[]>([]);
  const [rules, setRules] = useState<ReminderRule[]>([]);
  const [q, setQ] = useState('');
  const payers = usePayers(tick);
  const today = todayISO();

  const load = useCallback(async () => {
    let query = supabase().from('mya_invoices').select('*, mya_clients(name,email,phone,contact_name,reminders_paused)');
    if (f === 'encaisser') query = query.eq('status', 'envoyee').order('due_date');
    else if (f === 'retard') query = query.eq('status', 'envoyee').lt('due_date', today).order('due_date');
    else if (f === 'brouillon') query = query.eq('status', 'brouillon').order('created_at', { ascending: false });
    else if (f === 'payee') query = query.eq('status', 'payee').order('paid_at', { ascending: false }).limit(200);
    else query = query.order('issue_date', { ascending: false }).limit(300);
    const [{ data }, r] = await Promise.all([query, supabase().from('mya_reminder_rules').select('*').order('step')]);
    setRows((data ?? []) as Invoice[]);
    setRules((r.data ?? []) as ReminderRule[]);
  }, [f, today]);

  useEffect(() => { load(); }, [load, tick]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((i) => `${i.number} ${i.label} ${i.mya_clients?.name}`.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  const total = list.reduce((s, i) => s + (i.status === 'envoyee' ? invoiceBalance(i) : Number(i.amount_ttc)), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Factures d'honoraires</h1>
          <p className="text-sm text-ink-mute">{cabinet.reminders_enabled ? 'Les relances partent automatiquement selon votre scénario.' : 'Relances automatiques désactivées (Paramètres).'}</p>
        </div>
        <Link href="/factures/nouvelle" className="btn-primary"><IconPlus className="w-4 h-4" />Nouvelle facture</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-paper-deep p-1 rounded-xl overflow-x-auto">
          {FILTERS.map(([k, l]) => <button key={k} onClick={() => router.replace(`/factures?f=${k}`)} className={`tab ${f === k ? 'tab-on' : ''}`}>{l}</button>)}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder="Client, numéro…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? <Empty title={f === 'retard' ? 'Aucun retard' : 'Aucune facture ici'} text={f === 'retard' ? 'Tous vos clients sont à jour.' : undefined} /> : (
          <>
            <table className="w-full text-sm">
              <thead className="hidden md:table-header-group text-xs text-ink-mute text-left">
                <tr className="border-b border-paper-line">
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Échéance</th>
                  <th className="px-4 py-2.5 font-semibold">Relance</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => {
                  const nxt = i.status === 'envoyee' ? nextRuleDate(i, rules) : null;
                  const paused = i.reminders_paused || i.mya_clients?.reminders_paused;
                  return (
                    <tr key={i.id} onClick={() => router.push(`/factures/${i.id}`)} className="border-b border-paper-line last:border-0 hover:bg-paper/60 cursor-pointer">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2"><PayerDot p={payers[i.client_id]} /><span className="font-semibold">{i.mya_clients?.name}</span></span>
                        <span className="block text-xs text-ink-mute">{i.number ?? 'Brouillon'} · {i.label}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="block">{frDate(i.due_date)}</span>
                        <InvoiceBadge i={i} />
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-ink-soft">
                        {i.status !== 'envoyee' ? '—' : paused ? <span className="text-honey-600">En pause</span> : !cabinet.reminders_enabled ? 'Désactivées' :
                          nxt ? <>Étape {nxt.rule.step} · {nxt.date <= today ? 'demain matin' : relDay(nxt.date)}</> : 'Scénario terminé — à appeler'}
                        {i.reminder_level > 0 && <span className="block text-ink-mute">{i.reminder_level} relance{i.reminder_level > 1 ? 's' : ''} envoyée{i.reminder_level > 1 ? 's' : ''}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold">{eur(i.status === 'envoyee' ? invoiceBalance(i) : i.amount_ttc)}</span>
                        {i.status === 'envoyee' && Number(i.paid_amount) > 0 && <span className="block text-[11px] text-ink-mute">sur {eur(i.amount_ttc)}</span>}
                        <span className="md:hidden block mt-1"><InvoiceBadge i={i} /></span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex justify-between px-4 py-3 bg-paper text-sm font-semibold border-t border-paper-line">
              <span>{list.length} facture{list.length > 1 ? 's' : ''}</span><span>{eur(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

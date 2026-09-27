'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Avatar, Empty } from '@/components/Bits';
import Modal from '@/components/Modal';
import { ClientForm } from '@/components/Forms';
import { IconPlus, IconSearch } from '@/components/Icons';
import { PayerDot, PayerLegend, PAYER, usePayers } from '@/components/Payer';
import { eur, invoiceBalance, LABELS, todayISO } from '@/lib/utils';
import type { Client } from '@/lib/types';

export default function Clients() {
  const router = useRouter();
  const { tick } = useCabinet();
  const [rows, setRows] = useState<Client[]>([]);
  const [due, setDue] = useState<Record<string, { due: number; late: number }>>({});
  const [status, setStatus] = useState<'actif' | 'prospect' | 'archive' | 'impayes'>('actif');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [lvl, setLvl] = useState<number | null>(null);
  const payers = usePayers(tick);

  const load = useCallback(async () => {
    const sb = supabase();
    const [c, inv] = await Promise.all([
      sb.from('mya_clients').select('*').order('name'),
      sb.from('mya_invoices').select('client_id,amount_ttc,paid_amount,due_date').eq('status', 'envoyee'),
    ]);
    setRows((c.data ?? []) as Client[]);
    const map: Record<string, { due: number; late: number }> = {};
    const today = todayISO();
    for (const i of inv.data ?? []) {
      const m = (map[i.client_id] ??= { due: 0, late: 0 });
      const b = invoiceBalance(i);
      m.due += b;
      if (i.due_date < today) m.late += b;
    }
    setDue(map);
  }, []);

  useEffect(() => { load(); }, [load, tick]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((c) => {
      if (status === 'impayes' ? !(due[c.id]?.late > 0) : c.status !== status) return false;
      if (lvl !== null && payers[c.id]?.level !== lvl) return false;
      return !s || `${c.name} ${c.contact_name ?? ''} ${c.siren ?? ''} ${c.email ?? ''}`.toLowerCase().includes(s);
    });
  }, [rows, q, status, due, lvl, payers]);

  const nbLate = rows.filter((c) => due[c.id]?.late > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Clients</h1>
          <p className="text-sm text-ink-mute">{rows.filter((c) => c.status === 'actif').length} dossiers actifs</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}><IconPlus className="w-4 h-4" />Nouveau client</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-paper-deep p-1 rounded-xl overflow-x-auto">
          <button onClick={() => setStatus('actif')} className={`tab ${status === 'actif' ? 'tab-on' : ''}`}>Actifs</button>
          <button onClick={() => setStatus('impayes')} className={`tab ${status === 'impayes' ? 'tab-on' : ''}`}>Impayés{nbLate ? ` · ${nbLate}` : ''}</button>
          <button onClick={() => setStatus('prospect')} className={`tab ${status === 'prospect' ? 'tab-on' : ''}`}>Prospects</button>
          <button onClick={() => setStatus('archive')} className={`tab ${status === 'archive' ? 'tab-on' : ''}`}>Archivés</button>
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder="Nom, SIREN, contact…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-ink-mute mr-1">Profil payeur :</span>
        <button onClick={() => setLvl(null)} className={lvl === null ? 'chip-ink py-1 px-3' : 'chip-gray py-1 px-3'}>Tous</button>
        {PAYER.map((p, i) => {
          const n = rows.filter((c) => c.status === 'actif' && payers[c.id]?.level === i).length;
          return (
            <button key={i} onClick={() => setLvl(lvl === i ? null : i)} title={p.label}
              className="chip py-1 px-3 border" style={{ background: lvl === i ? p.color : p.bg, color: lvl === i ? '#fff' : p.color, borderColor: p.color + '55' }}>
              {p.short}{n ? ` · ${n}` : ''}
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        {list.length === 0 ? <Empty title="Aucun client ici" action={status === 'actif' && !q ? <button className="btn-primary" onClick={() => setOpen(true)}>Créer le premier dossier</button> : undefined} /> : (
          <table className="w-full text-sm">
            <thead className="hidden md:table-header-group text-xs text-ink-mute text-left">
              <tr className="border-b border-paper-line">
                <th className="px-4 py-2.5 font-semibold">Client</th>
                <th className="px-4 py-2.5 font-semibold">Payeur</th>
                <th className="px-4 py-2.5 font-semibold">Honoraires</th>
                <th className="px-4 py-2.5 font-semibold">TVA</th>
                <th className="px-4 py-2.5 font-semibold text-right">Reste dû</th>
                <th className="px-4 py-2.5 font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)} className="border-b border-paper-line last:border-0 hover:bg-paper/60 cursor-pointer">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2"><span className="md:hidden"><PayerDot p={payers[c.id]} /></span><Link href={`/clients/${c.id}`} className="font-semibold">{c.name}</Link></span>
                    <span className="block text-xs text-ink-mute">{[c.legal_form, c.contact_name].filter(Boolean).join(' · ') || LABELS.kind[c.kind]}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: payers[c.id] ? PAYER[payers[c.id].level].color : '#9a8592' }}>
                      <PayerDot p={payers[c.id]} size={12} />{payers[c.id] ? PAYER[payers[c.id].level].short : 'Nouveau'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-soft">{c.fee_amount ? `${eur(c.fee_amount)} HT · ${LABELS.freq[c.fee_frequency].toLowerCase()}` : '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-soft capitalize">{c.vat_regime ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {due[c.id]?.due ? (
                      <span className={due[c.id].late > 0 ? 'font-bold text-clay-600' : 'font-semibold'}>{eur(due[c.id].due)}</span>
                    ) : <span className="text-ink-mute">—</span>}
                    {due[c.id]?.late > 0 && <span className="block text-[11px] text-clay-600">dont {eur(due[c.id].late)} en retard</span>}
                    {c.reminders_paused && <span className="block text-[11px] text-honey-600">relances en pause</span>}
                  </td>
                  <td className="px-4 py-3"><Avatar id={c.owner_member} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PayerLegend />

      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau client" wide>
        {open && <ClientForm onSaved={(id) => { setOpen(false); router.push(`/clients/${id}`); }} />}
      </Modal>
    </div>
  );
}

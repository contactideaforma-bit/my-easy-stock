'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDay } from '@/lib/utils';
import { IconBack, IconPlus } from '@/components/Icons';
import { customerLabel } from '@/lib/types';
import type { Customer } from '@/lib/types';

type CustomerRow = Customer & { due: number };
type Fiche = { name: string; first_name: string; phone: string; email: string; address: string };
const EMPTY_FICHE: Fiche = { name: '', first_name: '', phone: '', email: '', address: '' };

export default function ClientsPage() {
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [fiche, setFiche] = useState<Fiche>(EMPTY_FICHE);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [editFiche, setEditFiche] = useState<Fiche>(EMPTY_FICHE);
  const [payAmount, setPayAmount] = useState('');
  const [history, setHistory] = useState<{ label: string; amount: number; date: string; type: 'vente' | 'reglement' }[]>([]);

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data: customers }, { data: sales }, { data: payments }] = await Promise.all([
      sb.from('customers').select('*').order('name'),
      sb.from('sales').select('customer_id,total,paid_amount').not('customer_id', 'is', null).is('canceled_at', null),
      sb.from('customer_payments').select('customer_id,amount'),
    ]);
    const dueMap: Record<string, number> = {};
    (sales || []).forEach((s: any) => {
      dueMap[s.customer_id] = (dueMap[s.customer_id] || 0) + Number(s.total) - Number(s.paid_amount);
    });
    (payments || []).forEach((p: any) => {
      dueMap[p.customer_id] = (dueMap[p.customer_id] || 0) - Number(p.amount);
    });
    setRows(((customers as any) || []).map((c: Customer) => ({ ...c, due: Math.max(0, dueMap[c.id] || 0) })));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openCustomer(c: CustomerRow) {
    setSelected(c);
    setEditing(false);
    setPayAmount('');
    const sb = supabase();
    const [{ data: sales }, { data: pays }] = await Promise.all([
      sb.from('sales').select('number,total,payment_method,created_at').eq('customer_id', c.id).is('canceled_at', null).order('created_at', { ascending: false }).limit(10),
      sb.from('customer_payments').select('amount,created_at').eq('customer_id', c.id).order('created_at', { ascending: false }).limit(10),
    ]);
    const h = [
      ...(sales || []).map((s: any) => ({
        label: `Vente #${s.number}${s.payment_method === 'credit' ? ' (crédit)' : ''}`,
        amount: Number(s.total),
        date: s.created_at,
        type: 'vente' as const,
      })),
      ...(pays || []).map((p: any) => ({ label: 'Règlement', amount: Number(p.amount), date: p.created_at, type: 'reglement' as const })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    setHistory(h);
  }

  const ficheToRecord = (f: Fiche) => ({
    name: f.name.trim(),
    first_name: f.first_name.trim() || null,
    phone: f.phone.trim() || null,
    email: f.email.trim() || null,
    address: f.address.trim() || null,
  });

  async function addCustomer() {
    if (!fiche.name.trim()) return;
    await supabase().from('customers').insert(ficheToRecord(fiche));
    setFiche(EMPTY_FICHE);
    setAdding(false);
    load();
  }

  function startEdit(c: CustomerRow) {
    setEditFiche({
      name: c.name || '',
      first_name: c.first_name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
    });
    setEditing(true);
  }

  async function saveEdit() {
    if (!selected || !editFiche.name.trim()) return;
    await supabase().from('customers').update(ficheToRecord(editFiche)).eq('id', selected.id);
    setEditing(false);
    setSelected(null);
    load();
  }

  async function recordPayment() {
    if (!selected || !Number(payAmount)) return;
    await supabase().from('customer_payments').insert({ customer_id: selected.id, amount: Number(payAmount) });
    setSelected(null);
    load();
  }

  const totalDue = rows.reduce((s, r) => s + r.due, 0);

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/plus" className="btn-glass !p-2"><IconBack /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink">Clients</h1>
          {totalDue > 0 && <p className="text-xs text-orange-700/90">Crédit en cours : {fmt(totalDue)}</p>}
        </div>
        <button className="btn-primary !py-2 !px-3 text-sm" onClick={() => setAdding(!adding)}>
          <IconPlus className="w-4 h-4" /> Client
        </button>
      </header>

      {adding && (
        <div className="glass p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Prénom" value={fiche.first_name} onChange={(e) => setFiche({ ...fiche, first_name: e.target.value })} />
            <input className="input" placeholder="Nom *" value={fiche.name} onChange={(e) => setFiche({ ...fiche, name: e.target.value })} />
            <input className="input" placeholder="Téléphone" value={fiche.phone} onChange={(e) => setFiche({ ...fiche, phone: e.target.value })} />
            <input className="input" type="email" placeholder="Email" value={fiche.email} onChange={(e) => setFiche({ ...fiche, email: e.target.value })} />
          </div>
          <input className="input" placeholder="Adresse" value={fiche.address} onChange={(e) => setFiche({ ...fiche, address: e.target.value })} />
          <button className="btn-primary w-full" onClick={addCustomer}>Créer la fiche client</button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="glass p-8 text-center text-ink/55">Aucun client enregistré.</div>
      ) : (
        <div className="glass p-2">
          {rows.map((c) => (
            <button key={c.id} className="w-full flex items-center justify-between p-3 text-left" onClick={() => openCustomer(c)}>
              <div>
                <p className="text-ink font-medium text-sm">{customerLabel(c)}</p>
                {(c.phone || c.email) && <p className="text-ink/45 text-xs">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>}
              </div>
              {c.due > 0 ? <span className="chip chip-warn">doit {fmt(c.due)}</span> : <span className="chip chip-ok">à jour</span>}
            </button>
          ))}
        </div>
      )}

      {/* Fiche client */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setSelected(null)}>
          <div className="glass-strong w-full max-w-lg mx-auto rounded-b-none p-6 pb-10 space-y-4 max-h-[85dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-ink">{customerLabel(selected)}</h3>
                <p className={selected.due > 0 ? 'text-orange-700' : 'text-emerald-700'}>
                  {selected.due > 0 ? `Crédit en cours : ${fmt(selected.due)}` : 'Compte à jour'}
                </p>
              </div>
              {!editing && (
                <button className="btn-glass !py-1.5 !px-3 text-xs shrink-0" onClick={() => startEdit(selected)}>
                  Modifier la fiche
                </button>
              )}
            </div>

            {editing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input className="input !py-2" placeholder="Prénom" value={editFiche.first_name} onChange={(e) => setEditFiche({ ...editFiche, first_name: e.target.value })} />
                  <input className="input !py-2" placeholder="Nom *" value={editFiche.name} onChange={(e) => setEditFiche({ ...editFiche, name: e.target.value })} />
                  <input className="input !py-2" placeholder="Téléphone" value={editFiche.phone} onChange={(e) => setEditFiche({ ...editFiche, phone: e.target.value })} />
                  <input className="input !py-2" type="email" placeholder="Email" value={editFiche.email} onChange={(e) => setEditFiche({ ...editFiche, email: e.target.value })} />
                </div>
                <input className="input !py-2" placeholder="Adresse" value={editFiche.address} onChange={(e) => setEditFiche({ ...editFiche, address: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-glass !py-2" onClick={() => setEditing(false)}>Annuler</button>
                  <button className="btn-primary !py-2" onClick={saveEdit}>Enregistrer</button>
                </div>
              </div>
            ) : (
              (selected.phone || selected.email || selected.address) && (
                <p className="text-ink/55 text-sm">
                  {[selected.phone, selected.email, selected.address].filter(Boolean).join(' · ')}
                </p>
              )
            )}

            {selected.due > 0 && (
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  type="number"
                  inputMode="decimal"
                  placeholder={`Règlement (max ${fmt(selected.due)})`}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
                <button className="btn-primary" onClick={recordPayment}>Encaisser</button>
              </div>
            )}

            <div>
              <h4 className="section-title mb-2">Historique</h4>
              {history.length === 0 ? (
                <p className="text-ink/55 text-sm">Aucune opération.</p>
              ) : (
                <ul className="space-y-2">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-ink">
                        {h.label} <span className="text-ink/45">· {fmtDay(h.date)}</span>
                      </span>
                      <span className={h.type === 'reglement' ? 'text-emerald-600' : 'text-ink'}>
                        {h.type === 'reglement' ? '−' : ''}{fmt(h.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

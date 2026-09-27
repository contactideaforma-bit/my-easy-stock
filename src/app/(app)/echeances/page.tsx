'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Empty, Toast } from '@/components/Bits';
import Modal from '@/components/Modal';
import { TaskForm } from '@/components/Forms';
import { TaskRow } from '@/components/TaskRow';
import { generateFiscal } from '@/lib/fiscalClient';
import { addDays, frDate, todayISO } from '@/lib/utils';
import type { Client, Task } from '@/lib/types';

const TYPES = [['', 'Toutes'], ['tva', 'TVA'], ['fiscal', 'Impôts'], ['bilan', 'Bilans'], ['juridique', 'Juridique']] as const;

export default function Echeances() {
  const { tick, cabinet, me, bump } = useCabinet();
  const [rows, setRows] = useState<Task[]>([]);
  const [type, setType] = useState('');
  const [months, setMonths] = useState(3);
  const [late, setLate] = useState<Task[]>([]);
  const [open, setOpen] = useState<Task | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const today = todayISO();

  const load = useCallback(async () => {
    let q = supabase().from('mya_tasks').select('*, mya_clients(name)').not('fiscal_key', 'is', null)
      .gte('due_date', today).lte('due_date', addDays(today, months * 31)).order('due_date');
    let l = supabase().from('mya_tasks').select('*, mya_clients(name)').not('fiscal_key', 'is', null)
      .lt('due_date', today).neq('status', 'fait').order('due_date');
    if (type) { q = q.eq('category', type); l = l.eq('category', type); }
    const [a, b] = await Promise.all([q, l]);
    setRows((a.data ?? []) as Task[]); setLate((b.data ?? []) as Task[]);
  }, [type, months, today]);

  useEffect(() => { load(); }, [load, tick]);

  const groups = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of rows) { const k = t.due_date!.slice(0, 7); m.set(k, [...(m.get(k) ?? []), t]); }
    return Array.from(m.entries());
  }, [rows]);

  async function toggle(t: Task) {
    await supabase().from('mya_tasks').update({ status: t.status === 'fait' ? 'a_faire' : 'fait' }).eq('id', t.id);
    load();
  }

  async function generateAll() {
    setBusy(true);
    const { data } = await supabase().from('mya_clients').select('*').eq('status', 'actif');
    let n = 0;
    for (const c of (data ?? []) as Client[]) n += await generateFiscal(c, cabinet.vat_due_day, 365).catch(() => 0);
    setBusy(false); bump();
    setToast(n ? `${n} échéance${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} sur 12 mois` : 'Calendrier déjà à jour');
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Échéances fiscales</h1>
          <p className="text-sm text-ink-mute">Générées automatiquement d'après chaque fiche client (régime de TVA, IS/IR, date de clôture).</p>
        </div>
        {me.role === 'titulaire' && <button className="btn-ghost" disabled={busy} onClick={generateAll}>{busy ? 'Calcul…' : 'Préparer les 12 prochains mois'}</button>}
      </div>

      {!cabinet.fiscal_calendar && <p className="text-sm text-honey-600 bg-honey-50 rounded-xl px-4 py-3">Le calendrier fiscal automatique est désactivé dans Paramètres.</p>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-paper-deep p-1 rounded-xl overflow-x-auto">
          {TYPES.map(([k, l]) => <button key={k} onClick={() => setType(k)} className={`tab ${type === k ? 'tab-on' : ''}`}>{l}</button>)}
        </div>
        <select className="input w-auto ml-auto" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          <option value={1}>30 prochains jours</option><option value={3}>3 prochains mois</option><option value={6}>6 prochains mois</option><option value={12}>12 prochains mois</option>
        </select>
      </div>

      {late.length > 0 && (
        <section className="card border-clay-100">
          <h2 className="px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-clay-600">Dépassées, non cochées · {late.length}</h2>
          {late.map((t) => <TaskRow key={t.id} t={t} onCheck={() => toggle(t)} onOpen={() => setOpen(t)} />)}
        </section>
      )}

      {groups.length === 0 ? <div className="card"><Empty title="Aucune échéance sur la période" text="Complétez le régime de TVA, l'imposition et la date de clôture dans les fiches clients." /></div> :
        groups.map(([month, items]) => {
          const done = items.filter((t) => t.status === 'fait').length;
          return (
            <section key={month} className="card">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="font-display text-lg capitalize">{frDate(month + '-01', { month: 'long', year: 'numeric' })}</h2>
                <span className={done === items.length ? 'chip-sage' : 'chip-gray'}>{done}/{items.length} fait{done > 1 ? 's' : ''}</span>
              </div>
              <div className="mx-4 mb-2 h-1.5 rounded-full bg-paper-deep overflow-hidden"><div className="h-full bg-rose-400 rounded-full" style={{ width: `${(done / items.length) * 100}%` }} /></div>
              {items.map((t) => <TaskRow key={t.id} t={t} onCheck={() => toggle(t)} onOpen={() => setOpen(t)} />)}
            </section>
          );
        })}

      <Modal open={!!open} onClose={() => setOpen(null)} title="Échéance">{open && <TaskForm initial={open} onSaved={() => setOpen(null)} />}</Modal>
      <Toast msg={toast} />
    </div>
  );
}

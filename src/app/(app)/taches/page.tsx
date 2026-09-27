'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Empty } from '@/components/Bits';
import Modal from '@/components/Modal';
import { TaskForm } from '@/components/Forms';
import { TaskRow } from '@/components/TaskRow';
import { IconPlus } from '@/components/Icons';
import { addDays, LABELS, todayISO } from '@/lib/utils';
import type { Task } from '@/lib/types';

export default function Taches() {
  const { me, tick, members } = useCabinet();
  const [rows, setRows] = useState<Task[]>([]);
  const [who, setWho] = useState<string>('moi');
  const [cat, setCat] = useState('');
  const [done, setDone] = useState(false);
  const [open, setOpen] = useState<null | 'new' | Task>(null);
  const today = todayISO();

  const load = useCallback(async () => {
    let q = supabase().from('mya_tasks').select('*, mya_clients(name)');
    if (done) q = q.eq('status', 'fait').order('done_at', { ascending: false }).limit(100);
    else q = q.neq('status', 'fait').order('due_date', { nullsFirst: false }).limit(500);
    if (who === 'moi') q = q.eq('assigned_to', me.user_id);
    else if (who !== 'tous') q = q.eq('assigned_to', who);
    if (cat) q = q.eq('category', cat);
    const { data } = await q;
    setRows((data ?? []) as Task[]);
  }, [who, cat, done, me.user_id]);

  useEffect(() => { load(); }, [load, tick]);

  async function toggle(t: Task) {
    const status = t.status === 'fait' ? 'a_faire' : 'fait';
    setRows((s) => s.filter((x) => x.id !== t.id));
    await supabase().from('mya_tasks').update({ status }).eq('id', t.id);
    if (status === 'fait' && t.recurrence !== 'aucune') load();
  }

  const groups = useMemo(() => {
    if (done) return [{ title: 'Terminées récemment', items: rows, tone: '' }];
    const week = addDays(today, 7);
    return [
      { title: 'En retard', tone: 'text-clay-600', items: rows.filter((t) => t.due_date && t.due_date < today) },
      { title: "Aujourd'hui", tone: '', items: rows.filter((t) => t.due_date === today) },
      { title: '7 prochains jours', tone: '', items: rows.filter((t) => t.due_date && t.due_date > today && t.due_date <= week) },
      { title: 'Plus tard', tone: '', items: rows.filter((t) => t.due_date && t.due_date > week) },
      { title: 'Sans date', tone: '', items: rows.filter((t) => !t.due_date) },
    ].filter((g) => g.items.length);
  }, [rows, done, today]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Tâches</h1>
          <p className="text-sm text-ink-mute">Les tâches répétées (TVA, paies, bilans) se recréent toutes seules une fois cochées.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen('new')}><IconPlus className="w-4 h-4" />Nouvelle tâche</button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input w-auto" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="moi">Mes tâches</option>
          {members.length > 1 && <option value="tous">Tout le cabinet</option>}
          {members.length > 1 && members.filter((m) => m.user_id !== me.user_id).map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
        </select>
        <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Tous les types</option>
          {Object.entries(LABELS.category).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex gap-1 bg-paper-deep p-1 rounded-xl ml-auto">
          <button onClick={() => setDone(false)} className={`tab ${!done ? 'tab-on' : ''}`}>À faire</button>
          <button onClick={() => setDone(true)} className={`tab ${done ? 'tab-on' : ''}`}>Faites</button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card"><Empty title="Aucune tâche" text="Profitez-en pour souffler un peu." /></div>
      ) : groups.map((g) => (
        <section key={g.title} className="card">
          <h2 className={`px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide ${g.tone || 'text-ink-mute'}`}>{g.title} · {g.items.length}</h2>
          {g.items.map((t) => <TaskRow key={t.id} t={t} onCheck={() => toggle(t)} onOpen={() => setOpen(t)} />)}
        </section>
      ))}

      <Modal open={open !== null} onClose={() => setOpen(null)} title={open === 'new' ? 'Nouvelle tâche' : 'Tâche'}>
        {open !== null && <TaskForm initial={open === 'new' ? undefined : open} onSaved={() => setOpen(null)} />}
      </Modal>
    </div>
  );
}

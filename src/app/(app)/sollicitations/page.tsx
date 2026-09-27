'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Avatar, DueChip, Empty, PriorityDot } from '@/components/Bits';
import Modal from '@/components/Modal';
import { RequestForm, TaskForm } from '@/components/Forms';
import { IconCheck, IconPlus, IconSearch } from '@/components/Icons';
import { frDate, frTime, LABELS } from '@/lib/utils';
import type { Request } from '@/lib/types';

const FILTERS = [
  { k: 'ouvertes', label: 'À traiter' },
  { k: 'attente_client', label: 'Attente client' },
  { k: 'traitee', label: 'Traitées' },
] as const;

export default function Sollicitations() {
  const { me, tick, members } = useCabinet();
  const [rows, setRows] = useState<Request[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['k']>('ouvertes');
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<null | 'new' | Request>(null);
  const [toTask, setToTask] = useState<Request | null>(null);

  const load = useCallback(async () => {
    let query = supabase().from('mya_requests').select('*, mya_clients(name)').order('received_at', { ascending: false }).limit(300);
    if (filter === 'ouvertes') query = query.in('status', ['nouvelle', 'en_cours']);
    else query = query.eq('status', filter);
    if (mine) query = query.eq('assigned_to', me.user_id);
    const { data } = await query;
    setRows((data ?? []) as Request[]);
  }, [filter, mine, me.user_id]);

  useEffect(() => { load(); }, [load, tick]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const order = { urgente: 0, haute: 1, normale: 2, basse: 3 } as Record<string, number>;
    const r = s ? rows.filter((x) => `${x.subject} ${x.details ?? ''} ${x.mya_clients?.name ?? ''} ${x.contact_name ?? ''}`.toLowerCase().includes(s)) : rows;
    return filter === 'ouvertes' ? [...r].sort((a, b) => order[a.priority] - order[b.priority]) : r;
  }, [rows, q, filter]);

  async function setStatus(r: Request, status: Request['status']) {
    setRows((s) => s.filter((x) => x.id !== r.id));
    await supabase().from('mya_requests').update({ status, done_at: status === 'traitee' ? new Date().toISOString() : null }).eq('id', r.id);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Demandes</h1>
          <p className="text-sm text-ink-mute">Chaque appel, mail ou message noté ici ne se perd plus.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen('new')}><IconPlus className="w-4 h-4" />Nouvelle demande</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-paper-deep p-1 rounded-xl">
          {FILTERS.map((f) => <button key={f.k} onClick={() => setFilter(f.k)} className={`tab ${filter === f.k ? 'tab-on' : ''}`}>{f.label}</button>)}
        </div>
        {members.length > 1 && (
          <label className="flex items-center gap-2 text-sm text-ink-soft ml-1">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="accent-rose-600" />Seulement les miennes
          </label>
        )}
        <div className="relative ml-auto w-full sm:w-64">
          <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input className="input pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card">
        {list.length === 0 ? (
          <Empty title={filter === 'ouvertes' ? 'Tout est traité' : 'Rien ici'} text={filter === 'ouvertes' ? 'Astuce : sur ordinateur, appuyez sur N pour noter une demande pendant un appel.' : undefined} />
        ) : list.map((r) => (
          <div key={r.id} className="row items-start">
            <div className="pt-1.5"><PriorityDot p={r.priority} /></div>
            <button onClick={() => setOpen(r)} className="flex-1 min-w-0 text-left">
              <span className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{r.subject}</span>
                {r.status === 'nouvelle' && <span className="chip-rose">Nouveau</span>}
                {r.status === 'en_cours' && <span className="chip-honey">En cours</span>}
              </span>
              <span className="block text-xs text-ink-mute mt-0.5">
                {r.mya_clients?.name ?? r.contact_name ?? 'Contact inconnu'} · {LABELS.channel[r.channel]} · {frDate(r.received_at, { day: 'numeric', month: 'short' })} {frTime(r.received_at)}
              </span>
              {r.details && <span className="block text-xs text-ink-soft mt-1 line-clamp-2">{r.details}</span>}
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <DueChip date={r.due_date} done={r.status === 'traitee'} />
              <Avatar id={r.assigned_to} />
              {r.status !== 'traitee' && (
                <>
                  <button onClick={() => setToTask(r)} className="btn-ghost btn-sm hidden sm:inline-flex">→ Tâche</button>
                  <button onClick={() => setStatus(r, 'traitee')} className="btn-soft btn-sm" title="Marquer comme traitée"><IconCheck className="w-4 h-4" /></button>
                </>
              )}
              {r.status === 'traitee' && <button onClick={() => setStatus(r, 'en_cours')} className="btn-ghost btn-sm">Rouvrir</button>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={open !== null} onClose={() => setOpen(null)} title={open === 'new' ? 'Nouvelle demande' : 'Demande'}>
        {open !== null && <RequestForm initial={open === 'new' ? undefined : open} onSaved={() => setOpen(null)} />}
      </Modal>
      <Modal open={!!toTask} onClose={() => setToTask(null)} title="Transformer en tâche">
        {toTask && (
          <TaskForm
            initial={{ title: toTask.subject, notes: toTask.details, client_id: toTask.client_id, request_id: toTask.id, priority: toTask.priority, due_date: toTask.due_date ?? undefined, assigned_to: toTask.assigned_to ?? me.user_id }}
            onSaved={async () => { await supabase().from('mya_requests').update({ status: 'en_cours' }).eq('id', toTask.id); setToTask(null); load(); }}
          />
        )}
      </Modal>
    </div>
  );
}

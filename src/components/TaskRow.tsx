'use client';

import { Avatar, DueChip, PriorityDot } from './Bits';
import { LABELS } from '@/lib/utils';
import type { Task } from '@/lib/types';

export function TaskRow({ t, onCheck, onOpen }: { t: Task; onCheck: () => void; onOpen: () => void }) {
  return (
    <div className="row">
      <button onClick={onCheck} aria-label="Marquer comme fait" className={`w-5 h-5 rounded-md border-2 shrink-0 transition ${t.status === 'fait' ? 'bg-sage-600 border-sage-600' : 'border-paper-line hover:border-sage-400'}`} />
      <button onClick={onOpen} className="flex-1 min-w-0 text-left">
        <span className={`block text-sm font-semibold truncate ${t.status === 'fait' ? 'line-through text-ink-mute' : ''}`}>{t.title}</span>
        <span className="block text-xs text-ink-mute truncate">{t.mya_clients?.name ?? 'Cabinet'} · {LABELS.category[t.category]}{t.recurrence !== 'aucune' ? ' · répétée' : ''}</span>
      </button>
      <PriorityDot p={t.priority} />
      <DueChip date={t.due_date} done={t.status === 'fait'} />
      <Avatar id={t.assigned_to} />
    </div>
  );
}

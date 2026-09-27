'use client';

import { useCabinet } from './Cabinet';
import { LABELS, relDay, todayISO } from '@/lib/utils';

export function Avatar({ id, size = 'sm' }: { id: string | null | undefined; size?: 'sm' | 'md' }) {
  const { memberName, memberColor } = useCabinet();
  if (!id) return null;
  const name = memberName(id);
  const initials = name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  const cls = size === 'md' ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]';
  return (
    <span title={name} className={`${cls} inline-flex items-center justify-center rounded-full font-bold text-white shrink-0`} style={{ background: memberColor(id) }}>
      {initials}
    </span>
  );
}

export function PriorityDot({ p }: { p: string }) {
  const c = p === 'urgente' ? 'bg-clay-600' : p === 'haute' ? 'bg-honey-500' : p === 'basse' ? 'bg-paper-line' : 'bg-sage-300';
  return <span title={`Priorité ${LABELS.priority[p]}`} className={`inline-block w-2 h-2 rounded-full ${c} shrink-0`} />;
}

export function DueChip({ date, done }: { date: string | null; done?: boolean }) {
  if (!date) return null;
  const late = !done && date < todayISO();
  const today = date === todayISO();
  return <span className={late ? 'chip-clay' : today ? 'chip-honey' : 'chip-gray'}>{relDay(date)}</span>;
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="font-display text-lg text-ink">{title}</p>
      {text && <p className="text-sm text-ink-mute mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function MemberSelect({ value, onChange, allowEmpty = true }: { value: string | null; onChange: (v: string | null) => void; allowEmpty?: boolean }) {
  const { members } = useCabinet();
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      {allowEmpty && <option value="">Personne en particulier</option>}
      {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
    </select>
  );
}

export function ClientSelect({ value, onChange, placeholder = 'Aucun client' }: { value: string | null; onChange: (v: string | null) => void; placeholder?: string }) {
  const { clients } = useCabinet();
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{placeholder}</option>
      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );
}

export function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-ink text-white text-sm px-4 py-2.5 rounded-xl shadow-pop no-print">
      {msg}
    </div>
  );
}

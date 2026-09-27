'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Avatar } from '@/components/Bits';
import Modal from '@/components/Modal';
import { AppointmentForm } from '@/components/Forms';
import { IconBack, IconChevron, IconMessage, IconPlus } from '@/components/Icons';
import { addDays, frDate, frTime, LABELS, todayISO, whatsappLink } from '@/lib/utils';
import type { Appointment } from '@/lib/types';

function monday(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

export default function Agenda() {
  const { tick, members, me, cabinet } = useCabinet();
  const [start, setStart] = useState(() => monday(todayISO()));
  const [rows, setRows] = useState<Appointment[]>([]);
  const [who, setWho] = useState('tous');
  const [open, setOpen] = useState<null | 'new' | Appointment>(null);
  const today = todayISO();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const load = useCallback(async () => {
    let q = supabase().from('mya_appointments').select('*, mya_clients(name,phone,email)')
      .gte('starts_at', new Date(start + 'T00:00:00').toISOString())
      .lt('starts_at', new Date(addDays(start, 7) + 'T00:00:00').toISOString())
      .order('starts_at');
    if (who === 'moi') q = q.eq('member_id', me.user_id);
    const { data } = await q;
    setRows((data ?? []) as Appointment[]);
  }, [start, who, me.user_id]);

  useEffect(() => { load(); }, [load, tick]);

  const byDay = (d: string) => rows.filter((a) => todayISO(new Date(a.starts_at)) === d);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Agenda</h1>
          <p className="text-sm text-ink-mute">Les clients reçoivent un rappel automatique la veille de leur rendez-vous.</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen('new')}><IconPlus className="w-4 h-4" />Nouveau rendez-vous</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost btn-sm" onClick={() => setStart(addDays(start, -7))} aria-label="Semaine précédente"><IconBack className="w-4 h-4" /></button>
        <button className="btn-ghost btn-sm" onClick={() => setStart(monday(today))}>Cette semaine</button>
        <button className="btn-ghost btn-sm" onClick={() => setStart(addDays(start, 7))} aria-label="Semaine suivante"><IconChevron className="w-4 h-4" /></button>
        <span className="font-semibold text-sm ml-2">Du {frDate(start, { day: 'numeric', month: 'long' })} au {frDate(addDays(start, 6), { day: 'numeric', month: 'long' })}</span>
        {members.length > 1 && (
          <select className="input w-auto ml-auto" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="tous">Tout le cabinet</option><option value="moi">Mon agenda</option>
          </select>
        )}
      </div>

      <div className="grid lg:grid-cols-7 gap-3">
        {days.map((d) => {
          const items = byDay(d);
          const isToday = d === today;
          const weekend = new Date(d + 'T12:00:00Z').getUTCDay() % 6 === 0;
          if (weekend && items.length === 0) return <div key={d} className="hidden lg:block" />;
          return (
            <section key={d} className={`card min-h-[120px] ${isToday ? 'ring-2 ring-rose-200' : ''}`}>
              <button onClick={() => setOpen({ starts_at: new Date(d + 'T09:00:00').toISOString() } as Appointment)} className="w-full text-left px-3 pt-3 pb-2 border-b border-paper-line group">
                <span className={`block text-[11px] font-bold uppercase tracking-wide ${isToday ? 'text-rose-700' : 'text-ink-mute'}`}>{frDate(d, { weekday: 'long' })}</span>
                <span className="flex items-center justify-between"><span className="font-display text-lg">{frDate(d, { day: 'numeric', month: 'short' })}</span>
                  <IconPlus className="w-4 h-4 text-ink-mute opacity-0 group-hover:opacity-100" /></span>
              </button>
              <div className="p-2 space-y-2">
                {items.length === 0 && <p className="text-xs text-ink-mute px-1 py-2 lg:hidden">Libre</p>}
                {items.map((a) => {
                  const wa = whatsappLink(a.mya_clients?.phone, `Bonjour, je vous confirme notre rendez-vous du ${frDate(a.starts_at, { weekday: 'long', day: 'numeric', month: 'long' })} à ${frTime(a.starts_at)}. À bientôt, ${cabinet.name}`);
                  return (
                    <div key={a.id} className={`rounded-xl p-2.5 text-left border ${a.status === 'annule' ? 'opacity-50 line-through' : ''}`}
                      style={{ borderColor: '#f1e2e8', borderLeft: `4px solid ${members.find((m) => m.user_id === a.member_id)?.color ?? '#cc3a73'}` }}>
                      <button onClick={() => setOpen(a)} className="w-full text-left">
                        <span className="block text-xs font-bold text-rose-700">{frTime(a.starts_at)}{a.ends_at ? ` – ${frTime(a.ends_at)}` : ''}</span>
                        <span className="block text-sm font-semibold leading-snug">{a.title}</span>
                        <span className="block text-xs text-ink-mute">{a.mya_clients?.name ?? '—'} · {LABELS.apptKind[a.kind]}</span>
                      </button>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Avatar id={a.member_id} />
                        {a.reminded_at && <span className="chip-sage">Rappel envoyé</span>}
                        {wa && <a href={wa} target="_blank" rel="noreferrer" title="Confirmer par WhatsApp" className="ml-auto p-1 rounded-md text-rose-700 hover:bg-rose-50"><IconMessage className="w-4 h-4" /></a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <Modal open={open !== null} onClose={() => setOpen(null)} title={open && open !== 'new' && open.id ? 'Rendez-vous' : 'Nouveau rendez-vous'}>
        {open !== null && <AppointmentForm initial={open === 'new' ? undefined : open} onSaved={() => setOpen(null)} />}
      </Modal>
    </div>
  );
}

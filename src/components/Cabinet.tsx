'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Cabinet, Client, Member } from '@/lib/types';

interface Ctx {
  cabinet: Cabinet;
  me: Member;
  members: Member[];
  clients: Pick<Client, 'id' | 'name' | 'email' | 'phone' | 'contact_name' | 'status'>[];
  refresh: () => Promise<void>;
  refreshClients: () => Promise<void>;
  memberName: (id: string | null | undefined) => string;
  memberColor: (id: string | null | undefined) => string;
  /** Petit signal global : incrémenté après chaque création rapide pour que les pages se rechargent. */
  tick: number;
  bump: () => void;
}

const CabinetCtx = createContext<Ctx | null>(null);

export function useCabinet() {
  const c = useContext(CabinetCtx);
  if (!c) throw new Error('useCabinet hors du CabinetProvider');
  return c;
}

export function CabinetProvider({ userId, children, onMissing }: { userId: string; children: React.ReactNode; onMissing: () => void }) {
  const [state, setState] = useState<{ cabinet: Cabinet; me: Member; members: Member[] } | null>(null);
  const [clients, setClients] = useState<Ctx['clients']>([]);
  const [tick, setTick] = useState(0);

  const refreshClients = useCallback(async () => {
    const { data } = await supabase().from('mya_clients').select('id,name,email,phone,contact_name,status').neq('status', 'archive').order('name');
    setClients(data ?? []);
  }, []);

  const refresh = useCallback(async () => {
    const sb = supabase();
    const { data: mine } = await sb.from('mya_members').select('*').eq('user_id', userId).limit(1).maybeSingle();
    if (!mine) return onMissing();
    const [{ data: cab }, { data: members }] = await Promise.all([
      sb.from('mya_cabinets').select('*').eq('id', mine.cabinet_id).single(),
      sb.from('mya_members').select('*').eq('cabinet_id', mine.cabinet_id).order('created_at'),
    ]);
    setState({ cabinet: cab as Cabinet, me: mine as Member, members: (members ?? []) as Member[] });
  }, [userId, onMissing]);

  useEffect(() => { refresh(); refreshClients(); }, [refresh, refreshClients]);

  if (!state)
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-ink-mute animate-pulse">Préparation de votre bureau…</div>
      </div>
    );

  const memberName = (id: string | null | undefined) => state.members.find((m) => m.user_id === id)?.full_name ?? '—';
  const memberColor = (id: string | null | undefined) => state.members.find((m) => m.user_id === id)?.color ?? '#7b8496';

  return (
    <CabinetCtx.Provider value={{ ...state, clients, refresh, refreshClients, memberName, memberColor, tick, bump: () => setTick((t) => t + 1) }}>
      {children}
    </CabinetCtx.Provider>
  );
}

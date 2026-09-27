'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCabinet } from '@/components/Cabinet';
import { Empty } from '@/components/Bits';
import { ENG_STATUS } from '@/components/EngagementPanel';
import { frDate } from '@/lib/utils';
import type { Engagement } from '@/lib/types';

type Row = Engagement & { mya_clients: { name: string } | null };

export default function Lettres() {
  const { tick, clients } = useCabinet();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase().from('mya_engagements').select('*, mya_clients(name)').neq('status', 'annulee').order('created_at', { ascending: false })
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [tick]);

  const covered = useMemo(() => new Set(rows.filter((r) => r.status === 'signee').map((r) => r.client_id)), [rows]);
  const pending = rows.filter((r) => r.status === 'envoyee');
  const missing = clients.filter((c) => c.status === 'actif' && !rows.some((r) => r.client_id === c.id));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="h1">Lettres de mission</h1>
        <p className="text-sm text-ink-mute">{covered.size} client{covered.size > 1 ? 's' : ''} avec une lettre signée · {pending.length} en attente de signature · {missing.length} sans lettre</p>
      </div>

      {pending.length > 0 && (
        <section className="card">
          <h2 className="h2 px-4 pt-4 pb-2">En attente de signature</h2>
          {pending.map((r) => (
            <Link key={r.id} href={`/clients/${r.client_id}`} className="row hover:bg-paper/60">
              <span className="flex-1 text-sm"><b>{r.mya_clients?.name}</b> <span className="text-ink-mute">· envoyée le {frDate(r.sent_at)}</span></span>
              <span className={ENG_STATUS[r.status].c}>{ENG_STATUS[r.status].l}</span>
            </Link>
          ))}
        </section>
      )}

      {missing.length > 0 && (
        <section className="card">
          <h2 className="h2 px-4 pt-4 pb-2">Clients actifs sans lettre de mission</h2>
          {missing.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="row hover:bg-paper/60">
              <span className="flex-1 text-sm font-semibold">{c.name}</span>
              <span className="text-xs text-rose-700 font-semibold">Préparer →</span>
            </Link>
          ))}
        </section>
      )}

      <section className="card">
        <h2 className="h2 px-4 pt-4 pb-2">Toutes les lettres</h2>
        {rows.length === 0 ? <Empty title="Aucune lettre pour l'instant" text="Ouvrez une fiche client, onglet « Lettre de mission »." /> : rows.map((r) => (
          <Link key={r.id} href={`/clients/${r.client_id}`} className="row hover:bg-paper/60">
            <span className="flex-1 text-sm"><b>{r.mya_clients?.name}</b> <span className="text-ink-mute">· {r.title}{r.signed_at ? ` · signée le ${frDate(r.signed_at)}` : ''}</span></span>
            <span className={ENG_STATUS[r.status].c}>{ENG_STATUS[r.status].l}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}

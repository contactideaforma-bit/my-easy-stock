'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ClientPayer } from '@/lib/types';

// Code couleur payeur : du vert (paie sans relance) au rouge (à relancer sans arrêt)
export const PAYER = [
  { color: '#3f9d6e', bg: '#e8f5ee', label: 'Paie sans relance', short: 'Excellent' },
  { color: '#8ab03a', bg: '#f1f6e4', label: 'Paie après un petit rappel', short: 'Bon' },
  { color: '#e2a42f', bg: '#fdf4e1', label: 'Relances occasionnelles', short: 'Moyen' },
  { color: '#e8702e', bg: '#fdeee4', label: 'Relances fréquentes', short: 'Difficile' },
  { color: '#d8434a', bg: '#fce9ea', label: 'À relancer sans arrêt', short: 'Critique' },
] as const;

export function usePayers(tick = 0) {
  const [map, setMap] = useState<Record<string, ClientPayer>>({});
  useEffect(() => {
    supabase().from('mya_client_payer').select('*').then(({ data }) => {
      const m: Record<string, ClientPayer> = {};
      for (const r of (data ?? []) as ClientPayer[]) m[r.client_id] = r;
      setMap(m);
    });
  }, [tick]);
  return map;
}

export function PayerDot({ p, size = 10 }: { p?: ClientPayer | null; size?: number }) {
  const lvl = p ? PAYER[p.level] : null;
  return (
    <span title={lvl ? `${lvl.label} (${p!.nb} facture${p!.nb > 1 ? 's' : ''})` : "Pas encore d'historique de paiement"}
      className="inline-block rounded-full shrink-0 ring-2 ring-white"
      style={{ width: size, height: size, background: lvl ? lvl.color : '#d9cdd4' }} />
  );
}

export function PayerBadge({ p }: { p?: ClientPayer | null }) {
  if (!p) return <span className="chip-gray">Pas encore d'historique</span>;
  const lvl = PAYER[p.level];
  return (
    <span className="chip" style={{ background: lvl.bg, color: lvl.color }}>
      <span className="w-2 h-2 rounded-full" style={{ background: lvl.color }} />{lvl.label}
    </span>
  );
}

/** Jauge 5 segments, pour la fiche client. */
export function PayerGauge({ p }: { p?: ClientPayer | null }) {
  return (
    <div className="flex gap-1" aria-label={p ? PAYER[p.level].label : 'Pas encore d’historique'}>
      {PAYER.map((l, i) => (
        <span key={i} className="h-2 flex-1 rounded-full" style={{ background: p && i <= p.level ? PAYER[p.level].color : '#f1e3e9', opacity: p && i === p.level ? 1 : p && i < p.level ? 0.45 : 1 }} />
      ))}
    </div>
  );
}

export function PayerLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
      {PAYER.map((l) => <span key={l.label} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />{l.label}</span>)}
    </div>
  );
}

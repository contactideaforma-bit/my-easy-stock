'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, daysAgo } from '@/lib/utils';
import { IconBack } from '@/components/Icons';

type Row = { created_at: string; total: number; items: { product_name: string; qty: number; unit_price: number; purchase_price: number }[] };

const PERIODS = [
  { key: 7, label: '7 jours' },
  { key: 30, label: '30 jours' },
  { key: 90, label: '3 mois' },
] as const;

export default function StatsPage() {
  const [period, setPeriod] = useState<7 | 30 | 90>(7);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase()
      .from('sales')
      .select('created_at,total,sale_items(product_name,qty,unit_price,purchase_price)')
      .gte('created_at', daysAgo(period).toISOString())
      .order('created_at')
      .then(({ data }) => {
        setRows(((data as any) || []).map((s: any) => ({ ...s, items: s.sale_items || [] })));
        setLoading(false);
      });
  }, [period]);

  const stats = useMemo(() => {
    const ca = rows.reduce((s, r) => s + Number(r.total), 0);
    let cost = 0;
    const byProduct: Record<string, { qty: number; ca: number }> = {};
    const byDay: Record<string, number> = {};

    for (const r of rows) {
      const day = r.created_at.slice(0, 10);
      byDay[day] = (byDay[day] || 0) + Number(r.total);
      for (const it of r.items) {
        cost += it.qty * Number(it.purchase_price);
        const k = it.product_name;
        byProduct[k] = byProduct[k] || { qty: 0, ca: 0 };
        byProduct[k].qty += it.qty;
        byProduct[k].ca += it.qty * Number(it.unit_price);
      }
    }

    const top = Object.entries(byProduct)
      .sort((a, b) => b[1].ca - a[1].ca)
      .slice(0, 5);

    // série journalière continue
    const days: { day: string; ca: number }[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const d = daysAgo(i).toISOString().slice(0, 10);
      days.push({ day: d, ca: byDay[d] || 0 });
    }

    return { ca, marge: ca - cost, count: rows.length, top, days };
  }, [rows, period]);

  const maxCa = Math.max(...stats.days.map((d) => d.ca), 1);

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/plus" className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-ink flex-1">Statistiques</h1>
      </header>

      <div className="glass p-1 grid grid-cols-3 gap-1">
        {PERIODS.map((p) => (
          <button key={p.key} className={period === p.key ? 'btn-primary !py-2 text-sm' : 'btn !py-2 text-sm text-ink/60'} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass p-8 text-center text-ink/55 animate-pulse">Chargement…</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="glass p-3">
              <p className="text-ink/55 text-[11px]">Chiffre d&apos;aff.</p>
              <p className="text-lg font-bold text-ink mt-0.5">{fmt(stats.ca)}</p>
            </div>
            <div className="glass p-3">
              <p className="text-ink/55 text-[11px]">Marge brute</p>
              <p className="text-lg font-bold text-emerald-600 mt-0.5">{fmt(stats.marge)}</p>
            </div>
            <div className="glass p-3">
              <p className="text-ink/55 text-[11px]">Ventes</p>
              <p className="text-lg font-bold text-ink mt-0.5">{stats.count}</p>
            </div>
          </div>

          {/* Graphique barres */}
          <section className="glass p-4">
            <h2 className="section-title mb-3">Ventes par jour</h2>
            <div className="flex items-end gap-[2px] h-32">
              {stats.days.map((d) => (
                <div key={d.day} className="flex-1 group relative">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${Math.max(2, (d.ca / maxCa) * 100)}%`,
                      background: d.ca > 0 ? 'linear-gradient(180deg,#60b8fa,#1d65d8)' : 'rgba(13,43,78,0.08)',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-ink/45 mt-2">
              <span>{new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(daysAgo(period - 1))}</span>
              <span>Aujourd&apos;hui</span>
            </div>
          </section>

          {/* Top produits */}
          <section className="glass p-4">
            <h2 className="section-title mb-3">Top produits</h2>
            {stats.top.length === 0 ? (
              <p className="text-ink/55 text-sm">Pas encore de ventes sur cette période.</p>
            ) : (
              <ul className="space-y-2">
                {stats.top.map(([name, v], i) => (
                  <li key={name} className="flex items-center justify-between text-sm">
                    <span className="text-ink">
                      <span className="text-ink/45 mr-2">{i + 1}.</span>
                      {name} <span className="text-ink/55">× {v.qty}</span>
                    </span>
                    <span className="font-semibold text-ink">{fmt(v.ca)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

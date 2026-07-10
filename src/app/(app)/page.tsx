'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDate, variantLabel, startOfDay } from '@/lib/utils';
import { IconAlert, IconPlus, IconCash } from '@/components/Icons';

type LowStock = { id: string; size: string | null; color: string | null; stock: number; products: { name: string; low_stock_threshold: number } };
type RecentSale = { id: string; number: number; total: number; payment_method: string; created_at: string };

export default function Dashboard() {
  const [kpi, setKpi] = useState({ caToday: 0, salesToday: 0, stockUnits: 0, stockValue: 0 });
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [recent, setRecent] = useState<RecentSale[]>([]);
  const [name, setName] = useState('');

  useEffect(() => {
    const sb = supabase();

    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await sb.from('profiles').select('full_name').eq('id', data.user.id).single();
      setName(p?.full_name?.split(' ')[0] || '');
    });

    (async () => {
      const today = startOfDay().toISOString();

      const [{ data: sales }, { data: variants }, { data: recentSales }] = await Promise.all([
        sb.from('sales').select('total').gte('created_at', today),
        sb.from('product_variants').select('id,size,color,stock,products!inner(name,low_stock_threshold,sale_price,archived)'),
        sb.from('sales').select('id,number,total,payment_method,created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const caToday = (sales || []).reduce((s, x) => s + Number(x.total), 0);
      const active = (variants || []).filter((v: any) => !v.products.archived);
      const stockUnits = active.reduce((s: number, v: any) => s + v.stock, 0);
      const stockValue = active.reduce((s: number, v: any) => s + v.stock * Number(v.products.sale_price), 0);
      const low = active.filter((v: any) => v.stock <= v.products.low_stock_threshold).slice(0, 8);

      setKpi({ caToday, salesToday: (sales || []).length, stockUnits, stockValue });
      setLowStock(low as any);
      setRecent((recentSales as any) || []);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <p className="text-crystal-300/70 text-sm">
          {new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
        <h1 className="text-2xl font-bold text-white">Bonjour{name ? ` ${name}` : ''} 👋</h1>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-strong p-4">
          <p className="text-crystal-300/70 text-xs">Ventes du jour</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(kpi.caToday)}</p>
          <p className="text-crystal-300/60 text-xs mt-1">{kpi.salesToday} ticket{kpi.salesToday > 1 ? 's' : ''}</p>
        </div>
        <div className="glass p-4">
          <p className="text-crystal-300/70 text-xs">Valeur du stock</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(kpi.stockValue)}</p>
          <p className="text-crystal-300/60 text-xs mt-1">{kpi.stockUnits} pièces</p>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/caisse" className="btn-primary py-4">
          <IconCash className="w-5 h-5" /> Vendre
        </Link>
        <Link href="/produits/nouveau" className="btn-glass py-4">
          <IconPlus className="w-5 h-5" /> Produit
        </Link>
      </div>

      {/* Alertes stock bas */}
      {lowStock.length > 0 && (
        <section className="glass p-4">
          <div className="flex items-center gap-2 mb-3">
            <IconAlert className="w-5 h-5 text-orange-300" />
            <h2 className="section-title text-orange-200/90">Stock bas</h2>
          </div>
          <ul className="space-y-2">
            {lowStock.map((v) => (
              <li key={v.id} className="flex items-center justify-between text-sm">
                <span className="text-crystal-100">
                  {v.products.name} <span className="text-crystal-300/60">· {variantLabel(v)}</span>
                </span>
                <span className={`chip ${v.stock === 0 ? 'chip-danger' : 'chip-warn'}`}>
                  {v.stock === 0 ? 'Épuisé' : `${v.stock} rest.`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Dernières ventes */}
      <section className="glass p-4">
        <h2 className="section-title mb-3">Dernières ventes</h2>
        {recent.length === 0 ? (
          <p className="text-crystal-300/60 text-sm">Aucune vente pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-crystal-100">
                  #{s.number} <span className="text-crystal-300/60">· {fmtDate(s.created_at)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`chip ${s.payment_method === 'credit' ? 'chip-warn' : 'chip-ok'}`}>
                    {s.payment_method === 'especes' ? 'Espèces' : s.payment_method === 'carte' ? 'Carte' : 'Crédit'}
                  </span>
                  <span className="font-semibold text-white">{fmt(Number(s.total))}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

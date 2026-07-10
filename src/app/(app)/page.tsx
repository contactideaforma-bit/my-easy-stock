'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDate, variantLabel, startOfDay } from '@/lib/utils';
import { IconAlert, IconPlus, IconCash, IconUsers } from '@/components/Icons';

type LowStock = { id: string; size: string | null; color: string | null; stock: number; products: { name: string; low_stock_threshold: number } };
type RecentSale = { id: string; number: number; total: number; payment_method: string; created_at: string; vendors: { name: string } | null };
type VendorLine = { id: string; name: string; ca: number; nb: number; pieces: number };

function startOfMonth() {
  const d = startOfDay();
  d.setDate(1);
  return d;
}

export default function Dashboard() {
  const [kpi, setKpi] = useState({ caMois: 0, nbMois: 0, caToday: 0, stockDepot: 0, stockVendeurs: 0, stockValue: 0 });
  const [vendorLines, setVendorLines] = useState<VendorLine[]>([]);
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
      const monthStart = startOfMonth().toISOString();
      const todayStart = startOfDay().toISOString();

      const [{ data: monthSales }, { data: variants }, { data: vendorStock }, { data: vendors }, { data: recentSales }] =
        await Promise.all([
          sb.from('sales').select('total,vendor_id,created_at').gte('created_at', monthStart).is('canceled_at', null),
          sb.from('product_variants').select('id,size,color,stock,products!inner(name,low_stock_threshold,sale_price,archived)'),
          sb.from('vendor_stock').select('vendor_id,qty'),
          sb.from('vendors').select('id,name').eq('active', true),
          sb.from('sales').select('id,number,total,payment_method,created_at,vendors(name)').is('canceled_at', null).order('created_at', { ascending: false }).limit(5),
        ]);

      const caMois = (monthSales || []).reduce((s, x) => s + Number(x.total), 0);
      const caToday = (monthSales || []).filter((x) => x.created_at >= todayStart).reduce((s, x) => s + Number(x.total), 0);

      const active = (variants || []).filter((v: any) => !v.products.archived);
      const stockDepot = active.reduce((s: number, v: any) => s + v.stock, 0);
      const stockVendeurs = (vendorStock || []).reduce((s: number, r: any) => s + r.qty, 0);
      const stockValue = active.reduce((s: number, v: any) => s + v.stock * Number(v.products.sale_price), 0);
      const low = active.filter((v: any) => v.stock <= v.products.low_stock_threshold).slice(0, 6);

      // Ventes du mois par vendeur
      const byVendor: Record<string, { ca: number; nb: number }> = {};
      (monthSales || []).forEach((s: any) => {
        const k = s.vendor_id || 'depot';
        byVendor[k] = byVendor[k] || { ca: 0, nb: 0 };
        byVendor[k].ca += Number(s.total);
        byVendor[k].nb += 1;
      });
      const piecesByVendor: Record<string, number> = {};
      (vendorStock || []).forEach((r: any) => (piecesByVendor[r.vendor_id] = (piecesByVendor[r.vendor_id] || 0) + r.qty));

      const lines: VendorLine[] = [
        { id: 'depot', name: 'Dépôt (moi)', ca: byVendor['depot']?.ca || 0, nb: byVendor['depot']?.nb || 0, pieces: stockDepot },
        ...((vendors as any) || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          ca: byVendor[v.id]?.ca || 0,
          nb: byVendor[v.id]?.nb || 0,
          pieces: piecesByVendor[v.id] || 0,
        })),
      ].sort((a, b) => b.ca - a.ca);

      setKpi({ caMois, nbMois: (monthSales || []).length, caToday, stockDepot, stockVendeurs, stockValue });
      setVendorLines(lines);
      setLowStock(low as any);
      setRecent((recentSales as any) || []);
    })();
  }, []);

  const maxCa = Math.max(...vendorLines.map((l) => l.ca), 1);

  return (
    <div className="space-y-5">
      <header className="pt-2">
        <p className="text-ink/60 text-sm">
          {new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </p>
        <h1 className="text-2xl font-bold text-ink">Bonjour{name ? ` ${name}` : ''} 👋</h1>
      </header>

      {/* KPIs du mois */}
      <div className="glass-strong p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-ink/60 text-xs">Ventes du mois</p>
          <p className="text-ink/45 text-xs">aujourd&apos;hui : {fmt(kpi.caToday)}</p>
        </div>
        <p className="text-3xl font-bold text-crystal-700 mt-1">{fmt(kpi.caMois)}</p>
        <p className="text-ink/55 text-xs mt-1">{kpi.nbMois} vente{kpi.nbMois > 1 ? 's' : ''} ce mois-ci</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">Stock dépôt</p>
          <p className="text-lg font-bold text-ink mt-0.5">{kpi.stockDepot}</p>
        </div>
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">Chez vendeurs</p>
          <p className="text-lg font-bold text-ink mt-0.5">{kpi.stockVendeurs}</p>
        </div>
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">Valeur dépôt</p>
          <p className="text-lg font-bold text-ink mt-0.5">{fmt(kpi.stockValue)}</p>
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

      {/* Ventes du mois par vendeur */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <IconUsers className="w-5 h-5 text-crystal-600" />
          <h2 className="section-title">Ce mois, par vendeur</h2>
        </div>
        {vendorLines.length === 0 ? (
          <p className="text-ink/55 text-sm">Créez vos vendeurs pour suivre leurs ventes.</p>
        ) : (
          <ul className="space-y-3">
            {vendorLines.map((l) => (
              <li key={l.id}>
                <Link href={l.id === 'depot' ? '/produits' : `/vendeurs/${l.id}`} className="block">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-ink font-medium">
                      {l.name} <span className="text-ink/45 font-normal">· {l.nb} vente{l.nb > 1 ? 's' : ''} · {l.pieces} pcs</span>
                    </span>
                    <span className="font-semibold text-ink">{fmt(l.ca)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(13,43,78,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(l.ca / maxCa) * 100}%`, background: 'linear-gradient(90deg,#60b8fa,#257ceb)' }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Alertes stock bas */}
      {lowStock.length > 0 && (
        <section className="glass p-4">
          <div className="flex items-center gap-2 mb-3">
            <IconAlert className="w-5 h-5 text-orange-500" />
            <h2 className="section-title !text-orange-700/80">Stock dépôt bas</h2>
          </div>
          <ul className="space-y-2">
            {lowStock.map((v) => (
              <li key={v.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">
                  {v.products.name} <span className="text-ink/55">· {variantLabel(v)}</span>
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Dernières ventes</h2>
          <Link href="/ventes" className="text-crystal-700 text-xs font-medium">Tout voir →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-ink/55 text-sm">Aucune vente pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">
                  #{s.number} <span className="text-ink/45">· {s.vendors?.name || 'Dépôt'} · {fmtDate(s.created_at)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`chip ${s.payment_method === 'credit' ? 'chip-warn' : 'chip-ok'}`}>
                    {s.payment_method === 'especes' ? 'Espèces' : s.payment_method === 'carte' ? 'Carte' : 'Crédit'}
                  </span>
                  <span className="font-semibold text-ink">{fmt(Number(s.total))}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

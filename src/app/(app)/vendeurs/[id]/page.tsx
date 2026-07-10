'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDate, variantLabel, startOfDay } from '@/lib/utils';
import { IconBack, IconPlus, IconSearch, IconTrash } from '@/components/Icons';
import type { Vendor, VendorStockLine, Variant } from '@/lib/types';

type VariantHit = Variant & { products: { name: string; sale_price: number } };
type LotLine = { variant: VariantHit; qty: number };
type VendorSale = { id: string; number: number; total: number; created_at: string };

function startOfMonth() {
  const d = startOfDay();
  d.setDate(1);
  return d;
}

export default function VendeurDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [stock, setStock] = useState<VendorStockLine[]>([]);
  const [sales, setSales] = useState<VendorSale[]>([]);

  // lot à donner
  const [allocating, setAllocating] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<VariantHit[]>([]);
  const [lines, setLines] = useState<LotLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data: v }, { data: st }, { data: sl }] = await Promise.all([
      sb.from('vendors').select('*').eq('id', id).single(),
      sb
        .from('vendor_stock')
        .select('*, product_variants(*, products(name, sale_price))')
        .eq('vendor_id', id)
        .gt('qty', 0),
      sb
        .from('sales')
        .select('id,number,total,created_at')
        .eq('vendor_id', id)
        .gte('created_at', startOfMonth().toISOString())
        .order('created_at', { ascending: false }),
    ]);
    setVendor(v as any);
    setStock((st as any) || []);
    setSales((sl as any) || []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // recherche d'articles du dépôt
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase()
        .from('product_variants')
        .select('*, products!inner(name, sale_price, archived)')
        .eq('products.archived', false)
        .gt('stock', 0)
        .ilike('products.name', `%${s}%`)
        .limit(8);
      setHits((data as any) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  function addLine(v: VariantHit) {
    if (!lines.find((l) => l.variant.id === v.id)) setLines([...lines, { variant: v, qty: 1 }]);
    setQ('');
    setHits([]);
  }

  async function giveLot() {
    if (lines.length === 0) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase().rpc('allocate_to_vendor', {
      p_vendor_id: id,
      p_items: lines.map((l) => ({ variant_id: l.variant.id, qty: l.qty })),
      p_direction: 'sortie',
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setLines([]);
    setAllocating(false);
    load();
  }

  async function takeBack(line: VendorStockLine) {
    const max = line.qty;
    const input = prompt(`Quantité à reprendre au dépôt (max ${max}) :`, String(max));
    if (!input) return;
    const qty = Math.min(max, Math.max(1, Number(input) || 0));
    const { error: err } = await supabase().rpc('allocate_to_vendor', {
      p_vendor_id: id,
      p_items: [{ variant_id: line.variant_id, qty }],
      p_direction: 'retour',
    });
    if (err) alert(err.message);
    load();
  }

  async function deactivate() {
    const pieces = stock.reduce((s, l) => s + l.qty, 0);
    if (pieces > 0) {
      alert('Reprenez d’abord tout son stock avant de désactiver ce vendeur.');
      return;
    }
    if (!confirm('Désactiver ce vendeur ?')) return;
    await supabase().from('vendors').update({ active: false }).eq('id', id);
    router.replace('/vendeurs');
  }

  if (!vendor)
    return <div className="glass p-8 text-center text-ink/55 animate-pulse mt-4">Chargement…</div>;

  const pieces = stock.reduce((s, l) => s + l.qty, 0);
  const valeur = stock.reduce((s, l) => s + l.qty * Number(l.product_variants?.products?.sale_price || 0), 0);
  const caMois = sales.reduce((s, x) => s + Number(x.total), 0);

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/vendeurs" className="btn-glass !p-2"><IconBack /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink">{vendor.name}</h1>
          {vendor.phone && <p className="text-ink/55 text-xs">{vendor.phone}</p>}
        </div>
      </header>

      {/* KPIs du mois */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">CA du mois</p>
          <p className="text-lg font-bold text-crystal-700 mt-0.5">{fmt(caMois)}</p>
        </div>
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">Ventes</p>
          <p className="text-lg font-bold text-ink mt-0.5">{sales.length}</p>
        </div>
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">En stock</p>
          <p className="text-lg font-bold text-ink mt-0.5">{pieces}</p>
        </div>
      </div>

      {/* Donner un lot */}
      {!allocating ? (
        <button className="btn-primary w-full py-4" onClick={() => setAllocating(true)}>
          <IconPlus className="w-5 h-5" /> Donner un lot
        </button>
      ) : (
        <div className="glass-strong p-4 space-y-3">
          <h2 className="section-title">Lot à remettre</h2>
          <div className="relative">
            <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
            <input className="input pl-11" placeholder="Article du dépôt…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {hits.length > 0 && (
            <div className="space-y-1">
              {hits.map((v) => (
                <button key={v.id} className="w-full text-left text-sm text-ink py-1.5 px-2 rounded-xl hover:bg-crystal-500/10" onClick={() => addLine(v)}>
                  {v.products.name} <span className="text-ink/55">· {variantLabel(v)} · dépôt {v.stock}</span>
                </button>
              ))}
            </div>
          )}
          {lines.map((l, i) => (
            <div key={l.variant.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate">{l.variant.products.name}</p>
                <p className="text-xs text-ink/55">{variantLabel(l.variant)} · dépôt {l.variant.stock}</p>
              </div>
              <input
                className="input !w-20 !py-1.5 text-center"
                type="number"
                inputMode="numeric"
                min={1}
                max={l.variant.stock}
                value={l.qty}
                onChange={(e) =>
                  setLines(lines.map((x, j) => (j === i ? { ...x, qty: Math.min(l.variant.stock, Math.max(1, Number(e.target.value) || 1)) } : x)))
                }
              />
              <button className="text-rose-500/80" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                <IconTrash className="w-4 h-4" />
              </button>
            </div>
          ))}
          {error && <p className="text-rose-600 text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-glass" onClick={() => { setAllocating(false); setLines([]); }}>Annuler</button>
            <button className="btn-primary" onClick={giveLot} disabled={busy || lines.length === 0}>
              {busy ? '…' : 'Remettre le lot'}
            </button>
          </div>
        </div>
      )}

      {/* Stock détenu */}
      <section className="glass p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="section-title">Marchandise détenue</h2>
          {valeur > 0 && <span className="text-xs text-ink/55">valeur {fmt(valeur)}</span>}
        </div>
        {stock.length === 0 ? (
          <p className="text-ink/55 text-sm">Ce vendeur ne détient aucune marchandise.</p>
        ) : (
          <ul className="space-y-3">
            {stock.map((l) => (
              <li key={l.variant_id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{l.product_variants?.products?.name}</p>
                  <p className="text-xs text-ink/55">{l.product_variants ? variantLabel(l.product_variants) : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="chip">{l.qty}</span>
                  <button className="btn-glass !py-1.5 !px-3 text-xs" onClick={() => takeBack(l)}>Reprendre</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ventes du mois */}
      <section className="glass p-4">
        <h2 className="section-title mb-3">Ventes du mois</h2>
        {sales.length === 0 ? (
          <p className="text-ink/55 text-sm">Aucune vente ce mois-ci. Enregistrez-en une via la Caisse (stock : {vendor.name}).</p>
        ) : (
          <ul className="space-y-2">
            {sales.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">
                  #{s.number} <span className="text-ink/45">· {fmtDate(s.created_at)}</span>
                </span>
                <span className="font-semibold text-ink">{fmt(Number(s.total))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button className="btn-glass w-full !text-rose-600" onClick={deactivate}>
        Désactiver ce vendeur
      </button>
    </div>
  );
}

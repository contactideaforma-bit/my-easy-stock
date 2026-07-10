'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt } from '@/lib/utils';
import { IconPlus, IconSearch } from '@/components/Icons';
import type { Product } from '@/lib/types';

export default function ProduitsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase()
      .from('products')
      .select('*, categories(name), product_variants(id,stock)')
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProducts((data as any) || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(s) || p.brand?.toLowerCase().includes(s) || p.categories?.name.toLowerCase().includes(s)
    );
  }, [q, products]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold text-white">Produits</h1>
        <Link href="/produits/nouveau" className="btn-primary !py-2 !px-3 text-sm">
          <IconPlus className="w-4 h-4" /> Nouveau
        </Link>
      </header>

      <div className="relative">
        <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-crystal-300/50" />
        <input className="input pl-11" placeholder="Rechercher un produit, une marque…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="glass p-8 text-center text-crystal-300/60 animate-pulse">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="glass p-8 text-center text-crystal-300/60">
          {q ? 'Aucun résultat.' : 'Aucun produit. Ajoutez votre premier article !'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => {
            const total = (p.product_variants || []).reduce((s, v) => s + v.stock, 0);
            const low = total <= p.low_stock_threshold;
            return (
              <Link key={p.id} href={`/produits/${p.id}`} className="glass overflow-hidden transition active:scale-[0.98]">
                <div className="aspect-square bg-white/5 flex items-center justify-center overflow-hidden">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl opacity-40">👕</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-white text-sm leading-tight line-clamp-2">{p.name}</p>
                  {p.brand && <p className="text-crystal-300/60 text-xs mt-0.5">{p.brand}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-bold text-crystal-200">{fmt(Number(p.sale_price))}</span>
                    <span className={`chip ${total === 0 ? 'chip-danger' : low ? 'chip-warn' : ''}`}>{total}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

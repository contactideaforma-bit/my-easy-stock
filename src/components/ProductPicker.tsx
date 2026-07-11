'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fmt, fmtQty, variantLabel } from '@/lib/utils';
import { IconSearch, IconCheck } from '@/components/Icons';
import type { Category, Product, Variant } from '@/lib/types';

type Hit = Product & { product_variants: Variant[] };

/**
 * Fenêtre de sélection d'articles : recherche + filtre par catégorie.
 * Reste ouverte pour enchaîner plusieurs sélections ; « Terminé » pour fermer.
 * stockMap : si fourni (stock d'un vendeur), les disponibilités affichées
 * viennent de cette carte au lieu du stock dépôt.
 */
export default function ProductPicker({
  title = 'Choisir des articles',
  stockMap = null,
  onPick,
  onClose,
}: {
  title?: string;
  stockMap?: Record<string, number> | null;
  onPick: (product: Product, variant: Variant) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [catId, setCatId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [flash, setFlash] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase().from('categories').select('*').order('name').then(({ data }) => setCategories(data || []));
  }, []);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      let query = supabase()
        .from('products')
        .select('*, product_variants(*)')
        .eq('archived', false)
        .order('name')
        .limit(30);
      const s = q.trim();
      if (s) query = query.or(`name.ilike.%${s}%,brand.ilike.%${s}%`);
      if (catId) query = query.eq('category_id', catId);
      const { data } = await query;
      setHits((data as any) || []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q, catId]);

  const dispo = (v: Variant) => (stockMap ? stockMap[v.id] || 0 : v.stock);

  function pick(p: Hit, v: Variant) {
    onPick(p, v);
    setFlash(`${p.name} · ${variantLabel(v)}`);
    setTimeout(() => setFlash(''), 1400);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="glass-strong w-full max-w-lg mx-auto rounded-b-none p-5 pb-8 h-[85dvh] flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <button className="btn-primary !py-2 !px-4 text-sm" onClick={onClose}>Terminé</button>
        </div>

        <div className="relative">
          <IconSearch className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
          <input
            className="input pl-11"
            placeholder="Rechercher un article, une marque…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>

        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0">
            <button
              className={`chip shrink-0 ${!catId ? '!bg-crystal-600 !text-white !border-crystal-600' : ''}`}
              onClick={() => setCatId('')}
            >
              Tout
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`chip shrink-0 ${catId === c.id ? '!bg-crystal-600 !text-white !border-crystal-600' : ''}`}
                onClick={() => setCatId(catId === c.id ? '' : c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className={`text-sm text-emerald-700 flex items-center gap-1.5 h-5 shrink-0 transition-opacity ${flash ? 'opacity-100' : 'opacity-0'}`}>
          <IconCheck className="w-4 h-4" /> Ajouté : {flash}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <p className="text-ink/50 text-sm text-center py-8 animate-pulse">Chargement…</p>
          ) : hits.length === 0 ? (
            <p className="text-ink/50 text-sm text-center py-8">Aucun article trouvé.</p>
          ) : (
            hits.map((p) => (
              <div key={p.id} className="glass !rounded-2xl p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-crystal-100 flex items-center justify-center overflow-hidden shrink-0">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-crystal-400 text-lg font-bold">{p.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink truncate">{p.name}</p>
                    <p className="text-ink/50 text-xs">{fmt(Number(p.sale_price))}{p.brand ? ` · ${p.brand}` : ''}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(p.product_variants || []).map((v) => {
                    const d = dispo(v);
                    return (
                      <button
                        key={v.id}
                        className={`chip ${d === 0 ? 'opacity-35' : 'active:scale-95'}`}
                        disabled={d === 0}
                        onClick={() => pick(p, v)}
                      >
                        {variantLabel(v)} ({fmtQty(d)})
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

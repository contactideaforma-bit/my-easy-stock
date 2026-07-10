'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, variantLabel } from '@/lib/utils';
import { IconBack, IconTag, IconTrash } from '@/components/Icons';
import type { Product, Variant } from '@/lib/types';

export default function ProduitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [editPrice, setEditPrice] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data: p }, { data: vs }] = await Promise.all([
      sb.from('products').select('*, categories(name)').eq('id', id).single(),
      sb.from('product_variants').select('*').eq('product_id', id).order('size').order('color'),
    ]);
    setProduct(p as any);
    setVariants((vs as any) || []);
    if (p) {
      setSalePrice(String(p.sale_price));
      setPurchasePrice(String(p.purchase_price));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function adjust(variantId: string, delta: number) {
    setBusy(variantId);
    await supabase().rpc('adjust_stock', { p_variant_id: variantId, p_qty_change: delta });
    await load();
    setBusy(null);
  }

  async function savePrices() {
    await supabase()
      .from('products')
      .update({ sale_price: Number(salePrice) || 0, purchase_price: Number(purchasePrice) || 0 })
      .eq('id', id);
    setEditPrice(false);
    load();
  }

  async function archive() {
    if (!confirm('Archiver ce produit ? Il n’apparaîtra plus dans le catalogue.')) return;
    await supabase().from('products').update({ archived: true }).eq('id', id);
    router.replace('/produits');
  }

  if (!product)
    return <div className="glass p-8 text-center text-crystal-300/60 animate-pulse mt-4">Chargement…</div>;

  const total = variants.reduce((s, v) => s + v.stock, 0);
  const margin = Number(product.sale_price) - Number(product.purchase_price);

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/produits" className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-white flex-1 leading-tight">{product.name}</h1>
      </header>

      <div className="glass overflow-hidden">
        {product.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="w-full h-48 object-cover" />
        )}
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {product.categories?.name && <span className="chip">{product.categories.name}</span>}
            {product.brand && <span className="chip">{product.brand}</span>}
            <span className={`chip ${total === 0 ? 'chip-danger' : total <= product.low_stock_threshold ? 'chip-warn' : 'chip-ok'}`}>
              {total} en stock
            </span>
          </div>

          {editPrice ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-crystal-300/60 text-xs">Prix achat</label>
                <input className="input !py-2" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-crystal-300/60 text-xs">Prix vente</label>
                <input className="input !py-2" type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
              </div>
              <button className="btn-primary !py-2" onClick={savePrices}>OK</button>
            </div>
          ) : (
            <button className="w-full text-left" onClick={() => setEditPrice(true)}>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-white">{fmt(Number(product.sale_price))}</span>
                <span className="text-crystal-300/60 text-sm">
                  marge {fmt(margin)} · <span className="underline">modifier</span>
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Variantes */}
      <section className="glass p-4">
        <h2 className="section-title mb-3">Stock par variante</h2>
        <ul className="space-y-3">
          {variants.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-crystal-100 text-sm font-medium">{variantLabel(v)}</p>
                <p className="text-crystal-300/50 text-xs truncate">{v.sku}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="btn-glass !p-2 !rounded-xl w-9 h-9" disabled={busy === v.id || v.stock === 0} onClick={() => adjust(v.id, -1)}>−</button>
                <span className={`w-10 text-center font-bold ${v.stock === 0 ? 'text-rose-300' : 'text-white'}`}>{v.stock}</span>
                <button className="btn-glass !p-2 !rounded-xl w-9 h-9" disabled={busy === v.id} onClick={() => adjust(v.id, 1)}>+</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/produits/${id}/etiquettes`} className="btn-glass">
          <IconTag /> Étiquettes
        </Link>
        <button className="btn-glass !text-rose-300" onClick={archive}>
          <IconTrash /> Archiver
        </button>
      </div>
    </div>
  );
}

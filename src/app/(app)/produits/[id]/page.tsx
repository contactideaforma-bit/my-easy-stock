'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDate, fmtQty, variantLabel } from '@/lib/utils';
import Scanner from '@/components/Scanner';
import QuickSale from '@/components/QuickSale';
import { IconBack, IconTag, IconTrash, IconScan, IconCash } from '@/components/Icons';
import type { Product, Variant } from '@/lib/types';

type Movement = {
  id: string;
  qty_change: number;
  reason: string;
  created_at: string;
  product_variants: { size: string | null; color: string | null } | null;
};

const REASON_LABELS: Record<string, string> = {
  vente: 'Vente',
  achat: 'Réception achat',
  inventaire: 'Inventaire',
  ajustement: 'Ajustement',
  retour: 'Retour / annulation',
  affectation: 'Lot → revendeur',
  retour_vendeur: 'Retour revendeur',
};

export default function ProduitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [editPrice, setEditPrice] = useState(false);
  const [salePrice, setSalePrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [scanFor, setScanFor] = useState<string | null>(null);
  const [scanMsg, setScanMsg] = useState('');
  const [selling, setSelling] = useState(false);

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
    const ids = ((vs as any) || []).map((v: Variant) => v.id);
    if (ids.length) {
      const { data: mv } = await sb
        .from('stock_movements')
        .select('id,qty_change,reason,created_at,product_variants(size,color)')
        .in('variant_id', ids)
        .order('created_at', { ascending: false })
        .limit(20);
      setMovements((mv as any) || []);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function assignBarcode(variantId: string, code: string) {
    setScanFor(null);
    const { error } = await supabase().from('product_variants').update({ barcode: code }).eq('id', variantId);
    if (error) {
      setScanMsg(error.code === '23505' ? 'Ce code-barres est déjà utilisé par un autre article.' : error.message);
    } else {
      setScanMsg(`Code ${code} associé.`);
      load();
    }
    setTimeout(() => setScanMsg(''), 3000);
  }

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
    return <div className="glass p-8 text-center text-ink/55 animate-pulse mt-4">Chargement…</div>;

  const total = variants.reduce((s, v) => s + v.stock, 0);
  const margin = Number(product.sale_price) - Number(product.purchase_price);

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/produits" className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-ink flex-1 leading-tight">{product.name}</h1>
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
              {fmtQty(total)} en stock
            </span>
          </div>

          {editPrice ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-ink/55 text-xs">Prix achat</label>
                <input className="input !py-2" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="text-ink/55 text-xs">Prix vente</label>
                <input className="input !py-2" type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
              </div>
              <button className="btn-primary !py-2" onClick={savePrices}>OK</button>
            </div>
          ) : (
            <button className="w-full text-left" onClick={() => setEditPrice(true)}>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-ink">{fmt(Number(product.sale_price))}</span>
                <span className="text-ink/55 text-sm">
                  marge {fmt(margin)} · <span className="underline">modifier</span>
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Sortie de stock : lot revendeur (flux principal) ou vente détail */}
      <button className="btn-accent w-full py-4" onClick={() => setSelling(true)} disabled={total === 0}>
        <IconCash className="w-5 h-5" /> Remettre un lot · Vendre
      </button>

      {/* Variantes */}
      <section className="glass p-4">
        <h2 className="section-title mb-3">Stock par variante</h2>
        {scanMsg && <p className="text-crystal-700 text-sm mb-2">{scanMsg}</p>}
        <ul className="space-y-3">
          {variants.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-ink text-sm font-medium">{variantLabel(v)}</p>
                <p className="text-ink/45 text-xs truncate">{v.sku} · {v.barcode || 'sans code'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="btn-glass !p-2 !rounded-xl w-9 h-9"
                  onClick={() => setScanFor(v.id)}
                  aria-label="Associer un code-barres"
                >
                  <IconScan className="w-4 h-4" />
                </button>
                <button className="btn-glass !p-2 !rounded-xl w-9 h-9" disabled={busy === v.id || v.stock === 0} onClick={() => adjust(v.id, -1)}>−</button>
                <button
                  className={`min-w-[3.5rem] px-1 text-center font-bold underline decoration-dotted decoration-ink/30 underline-offset-4 ${v.stock === 0 ? 'text-rose-600' : 'text-ink'}`}
                  title="Saisir le stock exact"
                  disabled={busy === v.id}
                  onClick={() => {
                    const input = prompt(`Nouveau stock pour ${variantLabel(v)} :`, String(v.stock));
                    if (input == null) return;
                    const next = Math.max(0, Math.floor(Number(input) || 0));
                    if (next !== v.stock) adjust(v.id, next - v.stock);
                  }}
                >
                  {fmtQty(v.stock)}
                </button>
                <button className="btn-glass !p-2 !rounded-xl w-9 h-9" disabled={busy === v.id} onClick={() => adjust(v.id, 1)}>+</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Historique des mouvements (stock dépôt) */}
      <section className="glass p-4">
        <h2 className="section-title mb-3">Historique du stock dépôt</h2>
        {movements.length === 0 ? (
          <p className="text-ink/55 text-sm">Aucun mouvement pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-ink min-w-0 truncate">
                  {REASON_LABELS[m.reason] || m.reason}
                  {m.product_variants && (variantLabel(m.product_variants) !== 'Standard') && (
                    <span className="text-ink/55"> · {variantLabel(m.product_variants)}</span>
                  )}
                  <span className="text-ink/40"> · {fmtDate(m.created_at)}</span>
                </span>
                <span className={`font-semibold shrink-0 ml-2 ${m.qty_change > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {m.qty_change > 0 ? '+' : ''}{fmtQty(m.qty_change)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-ink/40 text-xs mt-3">
          Les ventes faites par les revendeurs décomptent leur stock, pas celui du dépôt — elles apparaissent sur leur fiche.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href={`/produits/${id}/etiquettes`} className="btn-glass">
          <IconTag /> Étiquettes
        </Link>
        <button className="btn-glass !text-rose-600" onClick={archive}>
          <IconTrash /> Archiver
        </button>
      </div>

      {scanFor && (
        <Scanner onDetected={(code) => assignBarcode(scanFor, code)} onClose={() => setScanFor(null)} />
      )}

      {selling && (
        <QuickSale
          product={product}
          variants={variants}
          onClose={() => setSelling(false)}
          onDone={() => {
            setSelling(false);
            load();
          }}
        />
      )}
    </div>
  );
}

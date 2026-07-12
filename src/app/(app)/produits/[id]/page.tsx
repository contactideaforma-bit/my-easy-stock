'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDate, fmtQty, variantLabel } from '@/lib/utils';
import Scanner from '@/components/Scanner';
import QuickSale from '@/components/QuickSale';
import { IconBack, IconTag, IconTrash, IconScan, IconCash } from '@/components/Icons';
import type { PriceTier, Product, Variant } from '@/lib/types';

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
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [packSize, setPackSize] = useState('');
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [tierQty, setTierQty] = useState('');
  const [tierPrice, setTierPrice] = useState('');
  const [reserved, setReserved] = useState<Record<string, number>>({});
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
      setPriceMin(p.price_min != null ? String(p.price_min) : '');
      setPriceMax(p.price_max != null ? String(p.price_max) : '');
      setPackSize(p.pack_size != null ? String(p.pack_size) : '');
    }
    const { data: t } = await sb.from('product_price_tiers').select('*').eq('product_id', id).order('min_qty');
    setTiers((t as any) || []);
    const ids = ((vs as any) || []).map((v: Variant) => v.id);
    if (ids.length) {
      const { data: resv } = await sb.from('reservations').select('variant_id,qty').eq('status', 'active').in('variant_id', ids);
      const rm: Record<string, number> = {};
      (resv || []).forEach((r: any) => (rm[r.variant_id] = (rm[r.variant_id] || 0) + r.qty));
      setReserved(rm);
    }
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
      .update({
        sale_price: Number(salePrice) || 0,
        purchase_price: Number(purchasePrice) || 0,
        price_min: priceMin ? Number(priceMin) : null,
        price_max: priceMax ? Number(priceMax) : null,
        pack_size: packSize ? Math.max(1, Math.floor(Number(packSize))) : null,
      })
      .eq('id', id);
    setEditPrice(false);
    load();
  }

  async function addTier() {
    const q = Math.floor(Number(tierQty));
    const pr = Number(tierPrice);
    if (!q || q < 1 || !pr) return;
    const { error } = await supabase().from('product_price_tiers').insert({ product_id: id, min_qty: q, price: pr });
    if (error) alert(error.code === '23505' ? 'Un palier existe déjà pour cette quantité.' : error.message);
    setTierQty('');
    setTierPrice('');
    load();
  }

  async function removeTier(tId: string) {
    await supabase().from('product_price_tiers').delete().eq('id', tId);
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
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-ink/55 text-xs">Prix achat</label>
                  <input className="input !py-2" type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
                </div>
                <div>
                  <label className="text-ink/55 text-xs">Prix vente conseillé</label>
                  <input className="input !py-2" type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
                </div>
                <div>
                  <label className="text-ink/55 text-xs">Prix vente minimum</label>
                  <input className="input !py-2" type="number" step="0.01" placeholder="optionnel" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                </div>
                <div>
                  <label className="text-ink/55 text-xs">Prix vente maximum</label>
                  <input className="input !py-2" type="number" step="0.01" placeholder="optionnel" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-ink/55 text-xs">Pièces par carton (colisage, optionnel)</label>
                  <input className="input !py-2" type="number" inputMode="numeric" placeholder="ex : 12" value={packSize} onChange={(e) => setPackSize(e.target.value)} />
                </div>
              </div>
              <button className="btn-primary w-full !py-2" onClick={savePrices}>Enregistrer les prix</button>
            </div>
          ) : (
            <button className="w-full text-left" onClick={() => setEditPrice(true)}>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-ink">{fmt(Number(product.sale_price))}</span>
                <span className="text-ink/55 text-sm"><span className="underline">modifier</span></span>
              </div>
              <p className="text-ink/60 text-sm mt-1">
                Prix d&apos;achat : <span className="font-semibold text-ink">{fmt(Number(product.purchase_price))}</span>
                {' '}· marge unitaire : <span className={`font-semibold ${margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(margin)}</span>
              </p>
              <p className="text-ink/60 text-xs mt-0.5">
                {product.price_min != null || product.price_max != null ? (
                  <>Fourchette de vente : {product.price_min != null ? fmt(Number(product.price_min)) : '—'} à {product.price_max != null ? fmt(Number(product.price_max)) : '—'}</>
                ) : (
                  <>Aucune fourchette min–max définie (touchez pour en fixer une)</>
                )}
                {product.pack_size ? <> · carton de {product.pack_size}</> : null}
              </p>
            </button>
          )}
        </div>
      </div>

      {/* Sortie de stock : lot revendeur (flux principal) ou vente détail */}
      <button className="btn-accent w-full py-4" onClick={() => setSelling(true)} disabled={total === 0}>
        <IconCash className="w-5 h-5" /> Remettre un lot · Vendre
      </button>

      {/* Paliers de prix par quantité */}
      <section className="glass p-4">
        <h2 className="section-title mb-1">Prix dégressifs par quantité</h2>
        <p className="text-ink/45 text-xs mb-3">
          Le prix se remplit automatiquement selon la quantité saisie lors d&apos;une vente ou d&apos;une remise de lot.
        </p>
        {tiers.length > 0 && (
          <ul className="space-y-1.5 mb-3">
            {tiers.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">À partir de <span className="font-semibold">{fmtQty(t.min_qty)}</span> pièce{t.min_qty > 1 ? 's' : ''}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-crystal-700">{fmt(Number(t.price))} / pièce</span>
                  <button className="text-rose-500/70 p-1" onClick={() => removeTier(t.id)} aria-label="Supprimer le palier">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <span className="text-ink/55 text-xs shrink-0">Dès</span>
          <input className="input !py-2 w-20 text-center" type="number" inputMode="numeric" placeholder="10" value={tierQty} onChange={(e) => setTierQty(e.target.value)} />
          <span className="text-ink/55 text-xs shrink-0">pcs →</span>
          <input className="input !py-2 flex-1 text-center" type="number" step="0.01" inputMode="decimal" placeholder="prix/pièce" value={tierPrice} onChange={(e) => setTierPrice(e.target.value)} />
          <button className="btn-primary !py-2 !px-3 text-sm" onClick={addTier}>OK</button>
        </div>
      </section>

      {/* Variantes */}
      <section className="glass p-4">
        <h2 className="section-title mb-3">Stock par variante</h2>
        {scanMsg && <p className="text-crystal-700 text-sm mb-2">{scanMsg}</p>}
        <ul className="space-y-3">
          {variants.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-ink text-sm font-medium">
                  {variantLabel(v)}
                  {reserved[v.id] ? <span className="chip chip-warn !text-[10px] !px-1.5 ml-1.5">{fmtQty(reserved[v.id])} réservée{reserved[v.id] > 1 ? 's' : ''}</span> : null}
                </p>
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

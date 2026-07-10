'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDate, variantLabel, startOfDay } from '@/lib/utils';
import ProductPicker from '@/components/ProductPicker';
import { IconBack, IconPlus, IconCash, IconTrash } from '@/components/Icons';
import type { Product, Vendor, VendorPayment, VendorStockLine, Variant } from '@/lib/types';

type VariantHit = Omit<Variant, 'products'> & { products: { name: string; sale_price: number } };
type LotLine = { variant: VariantHit; qty: number; price: number };
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
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [payAmount, setPayAmount] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  // lot à donner
  const [allocating, setAllocating] = useState(false);
  const [lotPicker, setLotPicker] = useState(false);
  const [lines, setLines] = useState<LotLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // vente rapide sur le stock du vendeur
  const [saleOpen, setSaleOpen] = useState(false);
  const [salePicker, setSalePicker] = useState(false);
  const [saleCart, setSaleCart] = useState<{ variant: Variant; name: string; qty: number; unit_price: number }[]>([]);
  const [saleMethod, setSaleMethod] = useState<'especes' | 'carte'>('especes');
  const [saleDiscount, setSaleDiscount] = useState('');
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleError, setSaleError] = useState('');

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data: v }, { data: st }, { data: sl }, { data: pay }] = await Promise.all([
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
        .is('canceled_at', null)
        .order('created_at', { ascending: false }),
      sb.from('vendor_payments').select('*').eq('vendor_id', id).order('created_at', { ascending: false }),
    ]);
    setVendor(v as any);
    setStock((st as any) || []);
    setSales((sl as any) || []);
    setPayments((pay as any) || []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** Stock du vendeur : variant_id → quantité détenue */
  const vendorMap = useMemo(() => {
    const m: Record<string, number> = {};
    stock.forEach((l) => (m[l.variant_id] = l.qty));
    return m;
  }, [stock]);

  /** Prix convenus avec ce vendeur : variant_id → prix */
  const agreedMap = useMemo(() => {
    const m: Record<string, number> = {};
    stock.forEach((l) => {
      if (l.agreed_price != null) m[l.variant_id] = Number(l.agreed_price);
    });
    return m;
  }, [stock]);

  function addLine(p: Product, v: Variant) {
    const hit: VariantHit = { ...v, products: { name: p.name, sale_price: Number(p.sale_price) } };
    setLines((prev) =>
      prev.find((l) => l.variant.id === v.id)
        ? prev
        : [...prev, { variant: hit, qty: 1, price: agreedMap[v.id] ?? Number(p.sale_price) }]
    );
  }

  function addSaleLine(p: Product, v: Variant) {
    setSaleError('');
    const dispo = vendorMap[v.id] || 0;
    setSaleCart((prev) => {
      const i = prev.findIndex((l) => l.variant.id === v.id);
      const current = i >= 0 ? prev[i].qty : 0;
      if (current + 1 > dispo) {
        setSaleError(`${vendor?.name || 'Le vendeur'} ne détient que ${dispo} pièce(s) de cet article.`);
        return prev;
      }
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { variant: v, name: p.name, qty: 1, unit_price: agreedMap[v.id] ?? Number(p.sale_price) }];
    });
  }

  function setSalePrice(variantId: string, price: number) {
    setSaleCart((prev) => prev.map((l) => (l.variant.id === variantId ? { ...l, unit_price: Math.max(0, price) } : l)));
  }

  function setSaleQty(variantId: string, qty: number) {
    setSaleCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variant.id !== variantId)
        : prev.map((l) => (l.variant.id === variantId ? { ...l, qty: Math.min(qty, vendorMap[variantId] || 0) } : l))
    );
  }

  const saleTotal = saleCart.reduce((s, l) => s + l.qty * l.unit_price, 0);
  const saleDiscountVal = Math.min(Math.max(0, Number(saleDiscount) || 0), saleTotal);
  const saleNet = saleTotal - saleDiscountVal;

  async function submitSale() {
    if (saleCart.length === 0) return;
    setSaleBusy(true);
    setSaleError('');
    const { error: err } = await supabase().rpc('process_sale', {
      p_items: saleCart.map((l) => ({ variant_id: l.variant.id, qty: l.qty, unit_price: l.unit_price })),
      p_payment_method: saleMethod,
      p_customer_id: null,
      p_paid_amount: saleNet,
      p_vendor_id: id,
      p_discount: saleDiscountVal,
    });
    setSaleBusy(false);
    if (err) {
      setSaleError(err.message);
      return;
    }
    setSaleCart([]);
    setSaleDiscount('');
    setSaleOpen(false);
    load();
  }

  async function giveLot() {
    if (lines.length === 0) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase().rpc('allocate_to_vendor', {
      p_vendor_id: id,
      p_items: lines.map((l) => ({ variant_id: l.variant.id, qty: l.qty, agreed_price: l.price })),
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

  async function recordPayment() {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;
    setPayBusy(true);
    const { error: err } = await supabase().from('vendor_payments').insert({ vendor_id: id, amount });
    setPayBusy(false);
    if (err) {
      alert(err.message);
      return;
    }
    setPayAmount('');
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
  const monthStart = startOfMonth().toISOString();
  const monthSales = sales.filter((s) => s.created_at >= monthStart);
  const caMois = monthSales.reduce((s, x) => s + Number(x.total), 0);
  const caTotal = sales.reduce((s, x) => s + Number(x.total), 0);
  const solde = Math.max(0, caTotal - payments.reduce((s, p) => s + Number(p.amount), 0));

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
          <p className="text-lg font-bold text-ink mt-0.5">{monthSales.length}</p>
        </div>
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">En stock</p>
          <p className="text-lg font-bold text-ink mt-0.5">{pieces}</p>
        </div>
      </div>

      {/* À reverser */}
      <section className={solde > 0 ? 'glass-strong p-4' : 'glass p-4'}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="section-title">À reverser</h2>
          <span className={`text-xl font-bold ${solde > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
            {solde > 0 ? fmt(solde) : 'À jour'}
          </span>
        </div>
        <p className="text-ink/45 text-xs mb-3">
          Total vendu {fmt(caTotal)} − reversé {fmt(caTotal - solde)}
        </p>
        {solde > 0 && (
          <div className="flex gap-2">
            <input
              className="input flex-1 !py-2"
              type="number"
              inputMode="decimal"
              placeholder={`Montant reçu (max ${fmt(solde)})`}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
            <button className="btn-primary !py-2 !px-4" onClick={recordPayment} disabled={payBusy}>
              {payBusy ? '…' : 'Encaisser'}
            </button>
          </div>
        )}
        {payments.length > 0 && (
          <ul className="mt-3 space-y-1">
            {payments.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between text-xs text-ink/60">
                <span>Reversement · {fmtDate(p.created_at)}</span>
                <span className="text-emerald-600 font-medium">{fmt(Number(p.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Actions : lot + vente rapide */}
      {!allocating && (
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-primary py-4" onClick={() => setAllocating(true)}>
            <IconPlus className="w-5 h-5" /> Donner un lot
          </button>
          <button className="btn-accent py-4" onClick={() => { setSaleOpen(true); setSalePicker(true); }}>
            <IconCash className="w-5 h-5" /> Vente
          </button>
        </div>
      )}
      {allocating && (
        <div className="glass-strong p-4 space-y-3">
          <h2 className="section-title">Lot à remettre</h2>
          <button className="btn-glass w-full !py-3" onClick={() => setLotPicker(true)}>
            <IconPlus className="w-4 h-4" /> Ajouter des articles du dépôt
          </button>
          {lines.map((l, i) => (
            <div key={l.variant.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate">{l.variant.products.name}</p>
                <p className="text-xs text-ink/55">
                  {variantLabel(l.variant)} · dépôt {l.variant.stock}
                  {l.price < l.variant.products.sale_price && (
                    <span className="text-coral-600 font-medium">
                      {' '}· −{Math.round((1 - l.price / l.variant.products.sale_price) * 100)} %
                    </span>
                  )}
                </p>
              </div>
              <input
                className="input !w-16 !py-1.5 text-center"
                type="number"
                inputMode="numeric"
                min={1}
                max={l.variant.stock}
                value={l.qty}
                onChange={(e) =>
                  setLines(lines.map((x, j) => (j === i ? { ...x, qty: Math.min(l.variant.stock, Math.max(1, Number(e.target.value) || 1)) } : x)))
                }
                aria-label="Quantité"
              />
              <input
                className="input !w-20 !py-1.5 text-center"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={l.price}
                onChange={(e) =>
                  setLines(lines.map((x, j) => (j === i ? { ...x, price: Math.max(0, Number(e.target.value)) } : x)))
                }
                aria-label="Prix convenu"
              />
              <button className="text-rose-500/80" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                <IconTrash className="w-4 h-4" />
              </button>
            </div>
          ))}
          {lines.length > 0 && (
            <p className="text-ink/45 text-xs">
              Le prix convenu sera proposé automatiquement lors des ventes de ce vendeur.
            </p>
          )}
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
                  <p className="text-xs text-ink/55">
                    {l.product_variants ? variantLabel(l.product_variants) : ''}
                    {l.agreed_price != null && (
                      <span className="text-crystal-700"> · convenu {fmt(Number(l.agreed_price))}</span>
                    )}
                  </p>
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
        {monthSales.length === 0 ? (
          <p className="text-ink/55 text-sm">Aucune vente ce mois-ci. Enregistrez-en une via la Caisse (stock : {vendor.name}).</p>
        ) : (
          <ul className="space-y-2">
            {monthSales.map((s) => (
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

      {/* Sélecteur d'articles pour le lot (stock dépôt) */}
      {lotPicker && (
        <ProductPicker
          title="Articles du dépôt à remettre"
          onPick={addLine}
          onClose={() => setLotPicker(false)}
        />
      )}

      {/* Vente rapide sur le stock du vendeur */}
      {saleOpen && !salePicker && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setSaleOpen(false)}>
          <div
            className="glass-strong w-full max-w-lg mx-auto rounded-b-none p-6 pb-10 space-y-4 max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">Vente de {vendor.name}</h3>
              <button className="btn-glass !py-2 !px-3 text-sm" onClick={() => setSalePicker(true)}>
                <IconPlus className="w-4 h-4" /> Articles
              </button>
            </div>

            {saleCart.length === 0 ? (
              <p className="text-ink/55 text-sm">Ajoutez les articles vendus par {vendor.name}.</p>
            ) : (
              <ul className="space-y-3">
                {saleCart.map((l) => (
                  <li key={l.variant.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{l.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-ink/55">{variantLabel(l.variant)} ·</span>
                        <input
                          className="input !w-[4.5rem] !py-0.5 !px-2 !rounded-lg text-xs text-center"
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={l.unit_price}
                          onChange={(e) => setSalePrice(l.variant.id, Number(e.target.value))}
                          aria-label="Prix unitaire"
                        />
                        <span className="text-xs text-ink/40">€/u</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button className="btn-glass !p-0 w-8 h-8 !rounded-xl" onClick={() => setSaleQty(l.variant.id, l.qty - 1)}>−</button>
                      <span className="w-7 text-center font-bold text-ink">{l.qty}</span>
                      <button className="btn-glass !p-0 w-8 h-8 !rounded-xl" onClick={() => setSaleQty(l.variant.id, l.qty + 1)}>+</button>
                      <button className="text-rose-500/70 ml-1" onClick={() => setSaleQty(l.variant.id, 0)}>
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {saleCart.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink/60 shrink-0">Remise</span>
                <input
                  className="input !py-1.5 !px-3 flex-1 text-center"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={saleDiscount}
                  onChange={(e) => setSaleDiscount(e.target.value)}
                />
                <span className="text-sm text-ink/40">€</span>
                {[5, 10].map((p) => (
                  <button key={p} className="chip active:scale-95 shrink-0" onClick={() => setSaleDiscount(String(Math.round(saleTotal * p) / 100))}>
                    −{p} %
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {(['especes', 'carte'] as const).map((m) => (
                <button key={m} className={m === saleMethod ? 'btn-primary !py-2.5' : 'btn-glass !py-2.5'} onClick={() => setSaleMethod(m)}>
                  {m === 'especes' ? 'Espèces' : 'Carte'}
                </button>
              ))}
            </div>

            {saleError && <p className="text-rose-600 text-sm">{saleError}</p>}
            <button className="btn-accent w-full py-4 justify-between px-6" onClick={submitSale} disabled={saleBusy || saleCart.length === 0}>
              <span>{saleBusy ? 'Traitement…' : 'Valider la vente'}</span>
              <span>
                {saleDiscountVal > 0 && <span className="line-through opacity-60 mr-2">{fmt(saleTotal)}</span>}
                {fmt(saleNet)}
              </span>
            </button>
          </div>
        </div>
      )}

      {saleOpen && salePicker && (
        <ProductPicker
          title={`Stock de ${vendor.name}`}
          stockMap={vendorMap}
          onPick={addSaleLine}
          onClose={() => setSalePicker(false)}
        />
      )}
    </div>
  );
}

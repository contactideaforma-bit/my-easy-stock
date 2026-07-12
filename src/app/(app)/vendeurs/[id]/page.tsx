'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDate, fmtDay, fmtQty, variantLabel, startOfDay } from '@/lib/utils';
import ProductPicker from '@/components/ProductPicker';
import Scanner from '@/components/Scanner';
import { MyBotTip } from '@/components/MyBot';
import { IconBack, IconPlus, IconCash, IconTrash, IconScan, IconInvoice } from '@/components/Icons';
import type { Product, Reservation, Vendor, VendorPayment, VendorStockLine, Variant } from '@/lib/types';

type VariantHit = Omit<Variant, 'products'> & { products: { name: string; sale_price: number; purchase_price: number } };
type LotLine = { variant: VariantHit; qty: number; price: number; gift: number };
type VendorSale = { id: string; number: number; total: number; created_at: string };
type LotRow = {
  id: string;
  created_at: string;
  due_type: string;
  due_amount: number | null;
  due_date: string | null;
  pieces: number;
  valeur: number;
  du: number | null; // null = au réel des ventes
  paye: number; // reversements rattachés à ce lot
  overdue: boolean;
};

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
  const [payLotId, setPayLotId] = useState('');
  const [payBusy, setPayBusy] = useState(false);

  // lots remis, rentabilité, réservations
  const [lots, setLots] = useState<LotRow[]>([]);
  const [marge, setMarge] = useState(0);
  const [retour, setRetour] = useState<{ sorties: number; retours: number }>({ sorties: 0, retours: 0 });
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [resPicker, setResPicker] = useState(false);
  const [lotScan, setLotScan] = useState(false);
  const [scanMsg, setScanMsg] = useState('');

  // lot à donner
  const [allocating, setAllocating] = useState(false);
  const [lotPicker, setLotPicker] = useState(false);
  const [lines, setLines] = useState<LotLine[]>([]);
  const [dueType, setDueType] = useState<'ventes' | 'montant' | 'marge'>('ventes');
  const [dueMargin, setDueMargin] = useState(''); // € gagnés par pièce payante
  const [dueAmount, setDueAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [forfaits, setForfaits] = useState<{ sum: number; count: number }>({ sum: 0, count: 0 });
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
    const [{ data: v }, { data: st }, { data: sl }, { data: pay }, { data: allocs }, { data: items }, { data: res }] =
      await Promise.all([
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
        sb
          .from('allocations')
          .select('*, allocation_items(qty, agreed_price, product_variants(products(sale_price)))')
          .eq('vendor_id', id)
          .order('created_at', { ascending: false }),
        sb
          .from('sale_items')
          .select('qty,unit_price,purchase_price,sales!inner(vendor_id,canceled_at)')
          .eq('sales.vendor_id', id)
          .is('sales.canceled_at', null),
        sb
          .from('reservations')
          .select('*, product_variants(*, products(name))')
          .eq('vendor_id', id)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ]);
    setVendor(v as any);
    setStock((st as any) || []);
    setSales((sl as any) || []);
    setPayments((pay as any) || []);
    setReservations((res as any) || []);

    // Marge dégagée sur les ventes de ce revendeur (prix vendu − prix d'achat)
    setMarge(((items as any[]) || []).reduce((s, it) => s + it.qty * (Number(it.unit_price) - Number(it.purchase_price || 0)), 0));

    // Lots remis : valeur, dû, reversements rattachés, retard
    const sorties = ((allocs as any[]) || []).filter((a) => a.direction === 'sortie');
    const retours = ((allocs as any[]) || []).filter((a) => a.direction === 'retour');
    const paidByLot: Record<string, number> = {};
    ((pay as any[]) || []).forEach((p) => {
      if (p.allocation_id) paidByLot[p.allocation_id] = (paidByLot[p.allocation_id] || 0) + Number(p.amount);
    });
    const today = new Date().toISOString().slice(0, 10);
    setLots(
      sorties.map((a): LotRow => {
        const its = a.allocation_items || [];
        const pieces = its.reduce((s: number, it: any) => s + it.qty, 0);
        const valeur = its.reduce(
          (s: number, it: any) => s + it.qty * Number(it.agreed_price ?? it.product_variants?.products?.sale_price ?? 0), 0);
        const du = a.due_type === 'ventes' || a.due_amount == null ? null : Number(a.due_amount);
        const paye = paidByLot[a.id] || 0;
        return {
          id: a.id,
          created_at: a.created_at,
          due_type: a.due_type,
          due_amount: a.due_amount,
          due_date: a.due_date,
          pieces,
          valeur,
          du,
          paye,
          overdue: !!a.due_date && a.due_date < today && (du == null || du - paye > 0),
        };
      })
    );

    // Taux de retour de marchandise (pièces reprises / pièces remises)
    const cnt = (arr: any[]) => arr.reduce((s, a) => s + (a.allocation_items || []).reduce((x: number, it: any) => x + it.qty, 0), 0);
    setRetour({ sorties: cnt(sorties), retours: cnt(retours) });

    // Forfaits de reversement convenus sur les lots
    const forfaitLines = sorties.filter((a: any) => a.due_type !== 'ventes' && a.due_amount != null);
    setForfaits({
      sum: forfaitLines.reduce((s: number, a: any) => s + Number(a.due_amount), 0),
      count: forfaitLines.length,
    });
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
    const hit: VariantHit = {
      ...v,
      products: { name: p.name, sale_price: Number(p.sale_price), purchase_price: Number(p.purchase_price) },
    };
    setLines((prev) =>
      prev.find((l) => l.variant.id === v.id)
        ? prev
        : [...prev, { variant: hit, qty: 1, price: agreedMap[v.id] ?? Number(p.sale_price), gift: 0 }]
    );
  }

  function addSaleLine(p: Product, v: Variant) {
    setSaleError('');
    const dispo = vendorMap[v.id] || 0;
    setSaleCart((prev) => {
      const i = prev.findIndex((l) => l.variant.id === v.id);
      const current = i >= 0 ? prev[i].qty : 0;
      if (current + 1 > dispo) {
        setSaleError(`${vendor?.name || 'Le revendeur'} ne détient que ${fmtQty(dispo)} pièce(s) de cet article.`);
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

  const lotPieces = lines.reduce((s, l) => s + l.qty, 0);
  const lotGifts = lines.reduce((s, l) => s + l.gift, 0);
  const lotPaid = lotPieces - lotGifts;
  // Valeur du lot : pièces payantes uniquement (les cadeaux sortent du stock à 0 €)
  const lotValue = lines.reduce((s, l) => s + (l.qty - l.gift) * l.price, 0);
  const lotCost = lines.reduce((s, l) => s + l.qty * l.variant.products.purchase_price, 0);
  const lotDue =
    dueType === 'montant'
      ? Math.max(0, Number(dueAmount) || 0)
      : dueType === 'marge'
        ? Math.round((lotCost + Math.max(0, Number(dueMargin) || 0) * lotPaid) * 100) / 100
        : null;

  async function giveLot() {
    if (lines.length === 0) return;
    if (dueType === 'montant' && !Number(dueAmount)) {
      setError('Indiquez le montant à reverser pour ce lot.');
      return;
    }
    if (dueType === 'marge' && !Number(dueMargin)) {
      setError('Indiquez combien vous voulez gagner par pièce.');
      return;
    }
    setBusy(true);
    setError('');
    // Les cadeaux partent en premier (prix 0) pour ne pas écraser le prix convenu des pièces payantes
    const giftItems = lines.filter((l) => l.gift > 0).map((l) => ({ variant_id: l.variant.id, qty: l.gift, agreed_price: 0 }));
    const paidItems = lines
      .filter((l) => l.qty - l.gift > 0)
      .map((l) => ({ variant_id: l.variant.id, qty: l.qty - l.gift, agreed_price: l.price }));
    const { data: allocId, error: err } = await supabase().rpc('allocate_to_vendor', {
      p_vendor_id: id,
      p_items: [...giftItems, ...paidItems],
      p_direction: 'sortie',
      // « Marge par pièce » est enregistrée comme montant fixe calculé (achat + marge × pièces payantes)
      p_due_type: dueType === 'marge' ? 'montant' : dueType,
      p_due_rate: null,
      p_due_amount: lotDue,
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    if (dueDate && allocId) {
      await supabase().from('allocations').update({ due_date: dueDate }).eq('id', allocId);
    }
    setBusy(false);
    setLines([]);
    setDueType('ventes');
    setDueMargin('');
    setDueAmount('');
    setDueDate('');
    setAllocating(false);
    // Document du lot prêt à remettre / envoyer au revendeur
    if (allocId) router.push(`/lots/${allocId}`);
    else load();
  }

  /** Scan en rafale pour composer le lot : chaque bip ajoute une pièce */
  async function scanIntoLot(code: string) {
    const { data } = await supabase()
      .from('product_variants')
      .select('*, products!inner(name, sale_price, purchase_price)')
      .eq('barcode', code)
      .limit(1);
    const v = (data as any[])?.[0] as VariantHit | undefined;
    if (!v) {
      setScanMsg(`Code ${code} inconnu au catalogue.`);
      return;
    }
    setScanMsg(`+1 ${v.products.name} · ${variantLabel(v)}`);
    setLines((prev) => {
      const i = prev.findIndex((l) => l.variant.id === v.id);
      if (i >= 0) {
        if (prev[i].qty + 1 > v.stock) return prev;
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [...prev, { variant: v, qty: 1, price: agreedMap[v.id] ?? Number(v.products.sale_price), gift: 0 }];
    });
  }

  /* ---------- Réservations ---------- */
  async function reserve(p: Product, v: Variant) {
    const input = prompt(`Quantité à réserver pour ${vendor?.name} — ${p.name} ${variantLabel(v)} (dépôt : ${v.stock}) :`, '1');
    if (!input) return;
    const qty = Math.max(1, Math.floor(Number(input) || 0));
    const { error: err } = await supabase().from('reservations').insert({ vendor_id: id, variant_id: v.id, qty });
    if (err) alert(err.message);
    load();
  }

  async function reservationToLot(r: Reservation) {
    const { error: err } = await supabase().rpc('allocate_to_vendor', {
      p_vendor_id: id,
      p_items: [{ variant_id: r.variant_id, qty: r.qty }],
      p_direction: 'sortie',
      p_due_type: 'ventes',
      p_due_rate: null,
      p_due_amount: null,
    });
    if (err) {
      alert(err.message);
      return;
    }
    await supabase().from('reservations').update({ status: 'fulfilled' }).eq('id', r.id);
    load();
  }

  async function cancelReservation(r: Reservation) {
    await supabase().from('reservations').update({ status: 'canceled' }).eq('id', r.id);
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
    const { error: err } = await supabase()
      .from('vendor_payments')
      .insert({ vendor_id: id, amount, allocation_id: payLotId || null });
    setPayBusy(false);
    if (err) {
      alert(err.message);
      return;
    }
    setPayAmount('');
    setPayLotId('');
    load();
  }

  async function deactivate() {
    const pieces = stock.reduce((s, l) => s + l.qty, 0);
    if (pieces > 0) {
      alert('Reprenez d’abord tout son stock avant de désactiver ce revendeur.');
      return;
    }
    if (!confirm('Désactiver ce revendeur ?')) return;
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
  const paye = payments.reduce((s, p) => s + Number(p.amount), 0);
  // Mode forfait dès qu'un lot a un reversement convenu ; sinon au réel des ventes
  const modeForfait = forfaits.count > 0;
  const solde = Math.max(0, (modeForfait ? forfaits.sum : caTotal) - paye);

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
          <p className="text-lg font-bold text-ink mt-0.5">{fmtQty(pieces)}</p>
        </div>
      </div>

      {/* Rentabilité de ce revendeur */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">Marge dégagée <span className="text-ink/40">(total des ventes)</span></p>
          <p className={`text-lg font-bold mt-0.5 ${marge >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(marge)}</p>
        </div>
        <div className="glass p-3">
          <p className="text-ink/55 text-[11px]">Taux de retour marchandise</p>
          <p className="text-lg font-bold text-ink mt-0.5">
            {retour.sorties > 0 ? `${Math.round((retour.retours / retour.sorties) * 100)} %` : '—'}
            <span className="text-xs font-normal text-ink/45"> ({fmtQty(retour.retours)}/{fmtQty(retour.sorties)} pcs)</span>
          </p>
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
          {modeForfait ? (
            <>Forfaits convenus sur {forfaits.count} lot{forfaits.count > 1 ? 's' : ''} : {fmt(forfaits.sum)} − reversé {fmt(paye)} · ventes enregistrées {fmt(caTotal)} (stats)</>
          ) : (
            <>Au réel : total vendu {fmt(caTotal)} − reversé {fmt(paye)}</>
          )}
        </p>
        {solde > 0 && (
          <div className="space-y-2">
            {lots.filter((l) => l.du == null || l.du - l.paye > 0).length > 0 && (
              <select className="input !py-2" value={payLotId} onChange={(e) => setPayLotId(e.target.value)}>
                <option value="" className="text-black">Reversement global (sans lot précis)…</option>
                {lots
                  .filter((l) => l.du == null || l.du - l.paye > 0)
                  .map((l) => (
                    <option key={l.id} value={l.id} className="text-black">
                      Lot du {fmtDay(l.created_at)} — {l.du != null ? `reste ${fmt(Math.max(0, l.du - l.paye))}` : 'au réel'}
                    </option>
                  ))}
              </select>
            )}
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

      <MyBotTip
        page="vendeur-detail"
        tips={[
          'Astuce : « Scan en rafale » compose un lot à la chaîne — chaque bip ajoute une pièce.',
          'Astuce : rattache chaque encaissement à un lot précis pour suivre le reste dû lot par lot.',
          'Astuce : le champ 🎁 offre des pièces au revendeur — elles sortent du stock mais ne comptent pas dans le dû.',
          'Astuce : réserve de la marchandise pour ce revendeur avant son passage, puis transforme la réservation en lot.',
        ]}
      />

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
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-glass !py-3" onClick={() => setLotPicker(true)}>
              <IconPlus className="w-4 h-4" /> Articles du dépôt
            </button>
            <button className="btn-primary !py-3" onClick={() => { setScanMsg(''); setLotScan(true); }}>
              <IconScan className="w-4 h-4" /> Scan en rafale
            </button>
          </div>
          {lines.map((l, i) => (
            <div key={l.variant.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate">{l.variant.products.name}</p>
                <p className="text-xs text-ink/55">
                  {variantLabel(l.variant)} · dépôt {fmtQty(l.variant.stock)}
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
              <span className="flex items-center gap-0.5 shrink-0" title="Pièces offertes (cadeau) — sortent du stock, non comptées dans le dû">
                <span className="text-sm">🎁</span>
                <input
                  className="input !w-11 !py-1.5 !px-1 text-center text-sm"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={l.qty}
                  value={l.gift}
                  onChange={(e) =>
                    setLines(lines.map((x, j) => (j === i ? { ...x, gift: Math.max(0, Math.min(Math.floor(Number(e.target.value)) || 0, x.qty)) } : x)))
                  }
                  aria-label="Pièces offertes"
                />
              </span>
              <button className="text-rose-500/80" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                <IconTrash className="w-4 h-4" />
              </button>
            </div>
          ))}
          {lines.length > 0 && (
            <>
              <p className="text-ink/45 text-xs">
                Le prix convenu sera proposé automatiquement lors des ventes de ce revendeur.
              </p>

              {/* Reversement convenu */}
              <div className="pt-1">
                <p className="section-title !text-xs mb-2">Reversement convenu</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['ventes', 'Au réel'],
                    ['montant', 'Montant fixe'],
                    ['marge', 'Marge / pièce'],
                  ] as const).map(([t, label]) => (
                    <button
                      key={t}
                      className={dueType === t ? 'btn-primary !py-2 text-xs' : 'btn-glass !py-2 text-xs'}
                      onClick={() => setDueType(t)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {dueType === 'ventes' && (
                  <p className="text-ink/45 text-xs mt-2">
                    Le dû suivra les ventes que vous enregistrerez pour ce revendeur.
                  </p>
                )}
                {dueType === 'montant' && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      className="input !py-2 flex-1 text-center"
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Montant dû pour ce lot"
                      value={dueAmount}
                      onChange={(e) => setDueAmount(e.target.value)}
                    />
                    <span className="text-ink/40 text-sm">€</span>
                  </div>
                )}
                {dueType === 'marge' && (
                  <>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-ink/55 text-xs shrink-0">Je veux gagner</span>
                      <input
                        className="input !py-2 w-24 text-center"
                        type="number"
                        step="0.5"
                        inputMode="decimal"
                        placeholder="4"
                        value={dueMargin}
                        onChange={(e) => setDueMargin(e.target.value)}
                      />
                      <span className="text-ink/55 text-xs shrink-0">€ / pièce</span>
                      {[2, 4, 5].map((m) => (
                        <button key={m} className="chip active:scale-95" onClick={() => setDueMargin(String(m))}>{m} €</button>
                      ))}
                    </div>
                    {Number(dueMargin) > 0 && (
                      <p className="text-ink/55 text-xs mt-2">
                        Dû calculé : achat {fmt(lotCost)} + {fmt(Number(dueMargin))} × {fmtQty(lotPaid)} pièce{lotPaid > 1 ? 's' : ''} payante{lotPaid > 1 ? 's' : ''} ={' '}
                        <span className="font-semibold text-ink">{fmt(lotDue || 0)}</span>
                      </p>
                    )}
                  </>
                )}
                {/* Échéance de reversement */}
                <div className="flex items-center gap-2 mt-3">
                  <label className="text-ink/55 text-xs shrink-0">Reversement attendu le</label>
                  <input
                    className="input !py-2 flex-1"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                  {[15, 30].map((d) => (
                    <button
                      key={d}
                      className="chip active:scale-95 shrink-0"
                      onClick={() => {
                        const x = new Date();
                        x.setDate(x.getDate() + d);
                        setDueDate(x.toISOString().slice(0, 10));
                      }}
                    >
                      +{d} j
                    </button>
                  ))}
                </div>

                {/* Bénéfice en temps réel */}
                <div className="glass !rounded-2xl p-3 mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-ink/60">Valeur du lot (pièces payantes)</span>
                  <span className="text-right font-semibold text-ink">{fmt(lotValue)}</span>
                  {lotGifts > 0 && (
                    <>
                      <span className="text-ink/60">Pièces offertes 🎁</span>
                      <span className="text-right text-ink">{fmtQty(lotGifts)} / {fmtQty(lotPieces)}</span>
                    </>
                  )}
                  <span className="text-ink/60">Coût d&apos;achat du lot</span>
                  <span className="text-right text-ink">{fmt(lotCost)}</span>
                  <span className="text-ink/60">Reversement du revendeur</span>
                  <span className="text-right font-semibold text-coral-600">
                    {lotDue != null ? fmt(lotDue) : `${fmt(lotValue)} (au réel, si tout est vendu)`}
                  </span>
                  <span className="text-ink font-semibold border-t border-ink/10 pt-1.5 mt-0.5">
                    Votre bénéfice{lotDue == null ? ' estimé' : ''}
                  </span>
                  <span
                    className={`text-right font-bold border-t border-ink/10 pt-1.5 mt-0.5 ${(lotDue ?? lotValue) - lotCost >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {fmt((lotDue ?? lotValue) - lotCost)}
                  </span>
                </div>
              </div>
            </>
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
          <p className="text-ink/55 text-sm">Ce revendeur ne détient aucune marchandise.</p>
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
                  <span className="chip">{fmtQty(l.qty)}</span>
                  <button className="btn-glass !py-1.5 !px-3 text-xs" onClick={() => takeBack(l)}>Reprendre</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Réservations en attente */}
      <section className="glass p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Réservations</h2>
          <button className="btn-glass !py-1.5 !px-3 text-xs" onClick={() => setResPicker(true)}>
            <IconPlus className="w-3.5 h-3.5" /> Réserver
          </button>
        </div>
        {reservations.length === 0 ? (
          <p className="text-ink/55 text-sm">
            Aucune réservation. Réservez de la marchandise du dépôt pour {vendor.name} avant qu&apos;il ne passe la prendre.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {reservations.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{r.product_variants?.products?.name}</p>
                  <p className="text-xs text-ink/55">
                    {r.product_variants ? variantLabel(r.product_variants) : ''} · réservé le {fmtDay(r.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="chip">{fmtQty(r.qty)}</span>
                  <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={() => reservationToLot(r)}>→ Lot</button>
                  <button className="text-rose-500/70 p-1" onClick={() => cancelReservation(r)} aria-label="Annuler la réservation">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Lots remis : documents, échéances, reversements */}
      <section className="glass p-4">
        <h2 className="section-title mb-3">Lots remis</h2>
        {lots.length === 0 ? (
          <p className="text-ink/55 text-sm">Aucun lot remis pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-3">
            {lots.map((l) => {
              const reste = l.du != null ? Math.max(0, l.du - l.paye) : null;
              return (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      Lot du {fmtDay(l.created_at)} <span className="text-ink/45 font-normal">· {fmtQty(l.pieces)} pcs · {fmt(l.valeur)}</span>
                    </p>
                    <p className="text-xs text-ink/55">
                      {l.du != null ? (
                        reste === 0 ? (
                          <span className="text-emerald-600 font-medium">Soldé ({fmt(l.du)})</span>
                        ) : (
                          <>Dû {fmt(l.du)} · reversé {fmt(l.paye)} · <span className="font-medium text-orange-700">reste {fmt(reste!)}</span></>
                        )
                      ) : (
                        <>Reversement au réel des ventes</>
                      )}
                      {l.due_date && (
                        <span className={l.overdue ? 'text-rose-600 font-semibold' : ''}>
                          {' '}· échéance {fmtDay(l.due_date)}{l.overdue ? ' — en retard' : ''}
                        </span>
                      )}
                    </p>
                  </div>
                  <Link href={`/lots/${l.id}`} className="btn-glass !py-1.5 !px-3 text-xs shrink-0">
                    <IconInvoice className="w-3.5 h-3.5" /> Document
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Ventes du mois */}
      <section className="glass p-4">
        <h2 className="section-title mb-3">Ventes du mois</h2>
        {monthSales.length === 0 ? (
          <p className="text-ink/55 text-sm">Aucune vente ce mois-ci. Enregistrez-en une avec le bouton « Vente » ci-dessus.</p>
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
        Désactiver ce revendeur
      </button>

      {/* Sélecteur d'articles pour le lot (stock dépôt) */}
      {lotPicker && (
        <ProductPicker
          title="Articles du dépôt à remettre"
          onPick={addLine}
          onClose={() => setLotPicker(false)}
        />
      )}

      {/* Scan en rafale pour composer le lot */}
      {lotScan && (
        <>
          <Scanner onDetected={scanIntoLot} onClose={() => setLotScan(false)} />
          {scanMsg && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] glass-strong px-4 py-2 text-sm text-ink rounded-2xl">
              {scanMsg}
            </div>
          )}
        </>
      )}

      {/* Sélecteur pour réserver de la marchandise du dépôt */}
      {resPicker && (
        <ProductPicker
          title={`Réserver pour ${vendor.name}`}
          onPick={(p, v) => reserve(p, v)}
          onClose={() => setResPicker(false)}
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
                      <input
                        className="input !w-16 !py-1 !px-1 !rounded-lg text-center font-bold"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={vendorMap[l.variant.id] || 0}
                        value={l.qty}
                        onChange={(e) => setSaleQty(l.variant.id, Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                        aria-label="Quantité"
                      />
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

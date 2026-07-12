'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtQty, variantLabel } from '@/lib/utils';
import { shareTicket } from '@/lib/ticket';
import { IconCheck, IconInvoice, IconShare, IconTrash } from '@/components/Icons';
import { customerLabel } from '@/lib/types';
import type { Customer, PriceTier, Product, Variant, Vendor } from '@/lib/types';

type Line = { variant: Variant; qty: number; price: number; touched?: boolean };
type ResRow = { variant_id: string; qty: number; vendor_id: string };

/**
 * Sortie de marchandise express depuis une fiche produit — pensée grossiste :
 * — Revendeur (par défaut) : remise d'un lot puisé dans le stock du dépôt,
 *   prix convenu par ligne, mode de reversement (au réel / forfait / %).
 * — Client (détail, occasionnel) : vente directe du dépôt, espèces/carte/crédit.
 * Quantités saisissables directement pour gérer de gros volumes.
 */
export default function QuickSale({
  product,
  variants,
  onClose,
  onDone,
}: {
  product: Product;
  variants: Variant[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [target, setTarget] = useState<'revendeur' | 'client'>('revendeur');
  const [method, setMethod] = useState<'especes' | 'carte' | 'credit'>('especes');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [agreedMap, setAgreedMap] = useState<Record<string, number>>({});
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [resRows, setResRows] = useState<ResRow[]>([]);
  const [dueType, setDueType] = useState<'ventes' | 'montant' | 'pourcentage'>('ventes');
  const [dueRate, setDueRate] = useState('');
  const [dueAmount, setDueAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [newMode, setNewMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFirst, setNewFirst] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<
    | { kind: 'vente'; saleId: string; number: number; date: string; total: number; benefice: number }
    | { kind: 'lot'; allocId: string | null; vendorId: string; vendorName: string; pieces: number; value: number }
    | null
  >(null);

  useEffect(() => {
    const sb = supabase();
    sb.from('customers').select('*').order('name').then(({ data }) => setCustomers((data as any) || []));
    sb.from('vendors').select('*').eq('active', true).order('name').then(({ data }) => setVendors((data as any) || []));
    // Paliers de prix dégressifs du produit
    sb.from('product_price_tiers').select('*').eq('product_id', product.id).order('min_qty').then(({ data }) => setTiers((data as any) || []));
    // Réservations actives sur ces variantes (déduites du disponible)
    sb.from('reservations')
      .select('variant_id,qty,vendor_id')
      .eq('status', 'active')
      .in('variant_id', variants.map((v) => v.id))
      .then(({ data }) => setResRows((data as any) || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Prix du palier atteint pour une quantité donnée (tiers triés par min_qty croissant) */
  const tierPriceFor = (qty: number): number | null => {
    let p: number | null = null;
    for (const t of tiers) if (qty >= t.min_qty) p = Number(t.price);
    return p;
  };

  /** Prix automatique : prix convenu revendeur > palier quantité > prix catalogue */
  const autoPrice = (v: Variant, qty: number) =>
    target === 'revendeur' && agreedMap[v.id] != null ? agreedMap[v.id] : tierPriceFor(qty) ?? Number(product.sale_price);

  // Prix convenus avec le revendeur sélectionné (proposés par défaut sur les lignes)
  useEffect(() => {
    if (target !== 'revendeur' || !vendorId) {
      setAgreedMap({});
      return;
    }
    supabase()
      .from('vendor_stock')
      .select('variant_id,agreed_price')
      .eq('vendor_id', vendorId)
      .in('variant_id', variants.map((v) => v.id))
      .then(({ data }) => {
        const a: Record<string, number> = {};
        (data || []).forEach((r: any) => {
          if (r.agreed_price != null) a[r.variant_id] = Number(r.agreed_price);
        });
        setAgreedMap(a);
        // Applique les prix convenus aux lignes déjà présentes
        setLines((prev) => prev.map((l) => (a[l.variant.id] != null ? { ...l, price: a[l.variant.id] } : l)));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, vendorId]);

  // Les deux flux puisent dans le stock du dépôt, déduction faite des réservations
  // (celles du revendeur sélectionné restent disponibles pour lui).
  const dispo = (v: Variant) => {
    const totalRes = resRows.filter((r) => r.variant_id === v.id).reduce((s, r) => s + r.qty, 0);
    const mine =
      target === 'revendeur' && vendorId
        ? resRows.filter((r) => r.variant_id === v.id && r.vendor_id === vendorId).reduce((s, r) => s + r.qty, 0)
        : 0;
    return Math.max(0, v.stock - totalRes + mine);
  };
  const inCart = (v: Variant) => lines.find((l) => l.variant.id === v.id)?.qty || 0;

  function tapVariant(v: Variant) {
    setError('');
    const max = dispo(v);
    setLines((prev) => {
      const i = prev.findIndex((l) => l.variant.id === v.id);
      if (i >= 0) {
        if (prev[i].qty + 1 > max) return prev;
        const next = [...prev];
        const q = next[i].qty + 1;
        next[i] = { ...next[i], qty: q, price: next[i].touched ? next[i].price : autoPrice(v, q) };
        return next;
      }
      if (max < 1) return prev;
      return [...prev, { variant: v, qty: 1, price: autoPrice(v, 1) }];
    });
  }

  function setQty(variantId: string, qty: number) {
    setLines((prev) => {
      const l = prev.find((x) => x.variant.id === variantId);
      if (!l) return prev;
      const max = dispo(l.variant);
      const q = Math.min(qty, max);
      return qty <= 0
        ? prev.filter((x) => x.variant.id !== variantId)
        : prev.map((x) =>
            x.variant.id === variantId ? { ...x, qty: q, price: x.touched ? x.price : autoPrice(x.variant, q) } : x
          );
    });
  }

  function setPrice(variantId: string, price: number) {
    setLines((prev) => prev.map((x) => (x.variant.id === variantId ? { ...x, price: Math.max(0, price), touched: true } : x)));
  }

  const totalVente = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const totalAchat = lines.reduce((s, l) => s + l.qty * Number(product.purchase_price), 0);
  const benefice = totalVente - totalAchat;
  const nbPieces = lines.reduce((s, l) => s + l.qty, 0);
  const catalogue = Number(product.sale_price);
  const pMin = product.price_min != null ? Number(product.price_min) : null;
  const pMax = product.price_max != null ? Number(product.price_max) : null;
  const lotDue =
    dueType === 'montant'
      ? Math.max(0, Number(dueAmount) || 0)
      : dueType === 'pourcentage'
        ? Math.round(totalVente * (Math.max(0, Number(dueRate) || 0))) / 100
        : null;

  async function createContact() {
    const n = newName.trim();
    if (!n) return;
    const sb = supabase();
    if (target === 'client') {
      const { data } = await sb
        .from('customers')
        .insert({
          name: n,
          first_name: newFirst.trim() || null,
          phone: newPhone.trim() || null,
          email: newEmail.trim() || null,
          address: newAddress.trim() || null,
        })
        .select()
        .single();
      if (data) {
        setCustomers([...customers, data as any].sort((a, b) => a.name.localeCompare(b.name)));
        setCustomerId((data as any).id);
      }
    } else {
      const { data } = await sb.from('vendors').insert({ name: n, phone: newPhone.trim() || null }).select().single();
      if (data) {
        setVendors([...vendors, data as any].sort((a, b) => a.name.localeCompare(b.name)));
        setVendorId((data as any).id);
      }
    }
    setNewName('');
    setNewFirst('');
    setNewPhone('');
    setNewEmail('');
    setNewAddress('');
    setNewMode(false);
  }

  async function submit() {
    if (lines.length === 0) {
      setError('Sélectionnez au moins une déclinaison.');
      return;
    }

    /* ----- Remise de lot au revendeur (flux principal) ----- */
    if (target === 'revendeur') {
      if (!vendorId) {
        setError('Choisissez ou créez le revendeur.');
        return;
      }
      if (dueType === 'montant' && !Number(dueAmount)) {
        setError('Indiquez le montant à reverser pour ce lot.');
        return;
      }
      if (dueType === 'pourcentage' && !Number(dueRate)) {
        setError('Indiquez le pourcentage à reverser.');
        return;
      }
      setBusy(true);
      setError('');
      const { data: allocId, error: err } = await supabase().rpc('allocate_to_vendor', {
        p_vendor_id: vendorId,
        p_items: lines.map((l) => ({ variant_id: l.variant.id, qty: l.qty, agreed_price: l.price })),
        p_direction: 'sortie',
        p_due_type: dueType,
        p_due_rate: dueType === 'pourcentage' ? Number(dueRate) : null,
        p_due_amount: lotDue,
      });
      if (!err && dueDate && allocId) {
        await supabase().from('allocations').update({ due_date: dueDate }).eq('id', allocId);
      }
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      setDone({
        kind: 'lot',
        allocId: (allocId as string) || null,
        vendorId,
        vendorName: vendors.find((v) => v.id === vendorId)?.name || 'Revendeur',
        pieces: nbPieces,
        value: totalVente,
      });
      return;
    }

    /* ----- Vente au détail (occasionnelle) ----- */
    if (method === 'credit' && !customerId) {
      setError('Le crédit nécessite un client identifié.');
      return;
    }
    setBusy(true);
    setError('');
    const { data: saleId, error: err } = await supabase().rpc('process_sale', {
      p_items: lines.map((l) => ({ variant_id: l.variant.id, qty: l.qty, unit_price: l.price })),
      p_payment_method: method,
      p_customer_id: customerId || null,
      p_paid_amount: method === 'credit' ? 0 : totalVente,
      p_vendor_id: null,
      p_discount: 0,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const { data: saleRow } = await supabase().from('sales').select('number,created_at').eq('id', saleId).single();
    setDone({
      kind: 'vente',
      saleId: saleId as string,
      number: saleRow?.number || 0,
      date: saleRow?.created_at || new Date().toISOString(),
      total: totalVente,
      benefice,
    });
  }

  /* ---------- Écran de succès ---------- */
  if (done)
    return (
      <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onDone}>
        <div className="glass-strong w-full max-w-lg mx-auto rounded-b-none p-6 pb-10 space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#34d399,#059669)' }}>
            <IconCheck className="w-7 h-7 text-white" />
          </div>
          {done.kind === 'lot' ? (
            <>
              <div>
                <h3 className="text-xl font-bold text-ink">Lot remis à {done.vendorName}</h3>
                <p className="text-crystal-800 text-lg font-semibold mt-1">
                  {fmtQty(done.pieces)} pièce{done.pieces > 1 ? 's' : ''} · {fmt(done.value)}
                </p>
                <p className="text-ink/55 text-sm">Le stock du dépôt a été transféré au revendeur.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {done.allocId && (
                  <Link href={`/lots/${done.allocId}`} className="btn-primary">
                    <IconInvoice className="w-5 h-5" /> Document du lot
                  </Link>
                )}
                <Link href={`/vendeurs/${done.vendorId}`} className={done.allocId ? 'btn-glass' : 'btn-primary col-span-2'}>
                  Fiche revendeur
                </Link>
              </div>
              <button className="btn-accent w-full" onClick={onDone}>Fermer</button>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-xl font-bold text-ink">Vente enregistrée</h3>
                <p className="text-crystal-800 text-lg font-semibold mt-1">{fmt(done.total)}</p>
                <p className="text-emerald-600 text-sm">Bénéfice : {fmt(done.benefice)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/factures/${done.saleId}`} className="btn-primary">
                  <IconInvoice className="w-5 h-5" /> Facture
                </Link>
                <button
                  className="btn-glass"
                  onClick={() =>
                    done.kind === 'vente' &&
                    shareTicket({
                      number: done.number,
                      date: done.date,
                      items: lines.map((l) => ({ name: product.name, label: variantLabel(l.variant), qty: l.qty, unit_price: l.price })),
                      total: done.total,
                      method,
                      vendorName: null,
                    })
                  }
                >
                  <IconShare /> Ticket
                </button>
              </div>
              <button className="btn-accent w-full" onClick={onDone}>Fermer</button>
            </>
          )}
        </div>
      </div>
    );

  /* ---------- Formulaire ---------- */
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="glass-strong w-full max-w-lg mx-auto rounded-b-none p-6 pb-10 space-y-4 max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-ink">Sortie de stock — {product.name}</h3>

        {/* Pour qui ? Revendeur d'abord : c'est le flux principal du grossiste */}
        <div className="grid grid-cols-2 gap-2">
          {(['revendeur', 'client'] as const).map((t) => (
            <button
              key={t}
              className={target === t ? 'btn-primary !py-2.5' : 'btn-glass !py-2.5'}
              onClick={() => { setTarget(t); setNewMode(false); setError(''); }}
            >
              {t === 'revendeur' ? 'Revendeur (lot)' : 'Client (détail)'}
            </button>
          ))}
        </div>

        {!newMode ? (
          <select
            className="input"
            value={target === 'client' ? customerId : vendorId}
            onChange={(e) => {
              if (e.target.value === '__new__') setNewMode(true);
              else if (target === 'client') setCustomerId(e.target.value);
              else setVendorId(e.target.value);
            }}
          >
            <option value="" className="text-black">
              {target === 'client' ? 'Client de passage (optionnel)…' : 'Choisir le revendeur…'}
            </option>
            {(target === 'client' ? customers : vendors).map((c) => (
              <option key={c.id} value={c.id} className="text-black">
                {target === 'client' ? customerLabel(c as Customer) : c.name}
              </option>
            ))}
            <option value="__new__" className="text-black">+ Nouveau {target === 'client' ? 'client' : 'revendeur'}…</option>
          </select>
        ) : target === 'client' ? (
          <div className="glass !rounded-2xl p-3 space-y-2">
            <p className="section-title !text-xs">Nouvelle fiche client</p>
            <div className="grid grid-cols-2 gap-2">
              <input className="input !py-2" placeholder="Prénom" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} autoFocus />
              <input className="input !py-2" placeholder="Nom *" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input className="input !py-2" placeholder="Téléphone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              <input className="input !py-2" type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <input className="input !py-2" placeholder="Adresse" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-glass !py-2" onClick={() => setNewMode(false)}>Annuler</button>
              <button className="btn-primary !py-2" onClick={createContact}>Créer la fiche</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Nom *" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <input className="input flex-1" placeholder="Téléphone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            <button className="btn-primary !px-4" onClick={createContact}>Créer</button>
          </div>
        )}

        {/* Déclinaisons : le stock affiché est le dépôt, réservations déduites */}
        <div>
          <p className="text-ink/55 text-xs mb-1.5">
            Touchez les déclinaisons à sortir du dépôt, puis saisissez les quantités
            {resRows.length > 0 ? ' (réservations déduites du disponible)' : ''} :
          </p>
          {tiers.length > 0 && (
            <p className="text-crystal-700/80 text-[11px] mb-1.5">
              Prix dégressifs actifs : {tiers.map((t) => `${fmtQty(t.min_qty)}+ → ${fmt(Number(t.price))}`).join(' · ')}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {variants.map((v) => {
              const d = dispo(v);
              const n = inCart(v);
              return (
                <button
                  key={v.id}
                  className={`chip ${n > 0 ? '!bg-crystal-600 !text-white !border-crystal-600' : ''} ${d === 0 ? 'opacity-35' : 'active:scale-95'}`}
                  disabled={d === 0}
                  onClick={() => tapVariant(v)}
                >
                  {variantLabel(v)} {n > 0 ? `×${fmtQty(n)}` : `(${fmtQty(d)})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lignes du panier — quantité saisissable pour les gros volumes */}
        {lines.length > 0 && (
          <ul className="space-y-2.5">
            {lines.map((l) => (
              <li key={l.variant.id} className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink w-16 shrink-0 truncate">{variantLabel(l.variant)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="btn-glass !p-0 w-8 h-8 !rounded-xl" onClick={() => setQty(l.variant.id, l.qty - 1)}>−</button>
                  <input
                    className="input !w-16 !py-1 !px-1 !rounded-lg text-center text-sm font-bold"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={dispo(l.variant)}
                    value={l.qty}
                    onChange={(e) => setQty(l.variant.id, Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                    aria-label="Quantité"
                  />
                  <button className="btn-glass !p-0 w-8 h-8 !rounded-xl" onClick={() => setQty(l.variant.id, l.qty + 1)}>+</button>
                  {product.pack_size ? (
                    <button
                      className="chip !text-[10px] !px-1.5 active:scale-95"
                      title={`Ajouter un carton de ${product.pack_size}`}
                      onClick={() => setQty(l.variant.id, l.qty + Number(product.pack_size))}
                    >
                      +carton ({product.pack_size})
                    </button>
                  ) : null}
                </div>
                <input
                  className="input !py-1 !px-2 !rounded-lg text-sm text-center flex-1 min-w-0"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={l.price}
                  onChange={(e) => setPrice(l.variant.id, Number(e.target.value))}
                  aria-label="Prix unitaire"
                />
                {pMin != null && l.price < pMin ? (
                  <span className="chip chip-danger !text-[10px] !px-1.5 shrink-0" title={`Sous le prix minimum ${fmt(pMin)}`}>&lt; min {fmt(pMin)}</span>
                ) : pMax != null && l.price > pMax ? (
                  <span className="chip chip-warn !text-[10px] !px-1.5 shrink-0" title={`Au-dessus du prix maximum ${fmt(pMax)}`}>&gt; max {fmt(pMax)}</span>
                ) : l.price < catalogue ? (
                  <span className="chip chip-warn !text-[10px] !px-1.5 shrink-0">−{Math.round((1 - l.price / catalogue) * 100)}%</span>
                ) : null}
                <button className="text-rose-500/70 shrink-0" onClick={() => setQty(l.variant.id, 0)}>
                  <IconTrash className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Résumé */}
        {lines.length > 0 && (
          <div className="glass !rounded-2xl p-3 grid grid-cols-4 text-center">
            <div>
              <p className="text-ink/50 text-[11px]">Pièces</p>
              <p className="font-semibold text-ink text-sm">{fmtQty(nbPieces)}</p>
            </div>
            <div>
              <p className="text-ink/50 text-[11px]">Achat</p>
              <p className="font-semibold text-ink text-sm">{fmt(totalAchat)}</p>
            </div>
            <div>
              <p className="text-ink/50 text-[11px]">{target === 'revendeur' ? 'Valeur lot' : 'Vente'}</p>
              <p className="font-semibold text-ink text-sm">{fmt(totalVente)}</p>
            </div>
            <div>
              <p className="text-ink/50 text-[11px]">Bénéfice</p>
              <p className={`font-bold text-sm ${benefice >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {target === 'revendeur' && lotDue != null ? fmt(lotDue - totalAchat) : fmt(benefice)}
              </p>
            </div>
          </div>
        )}

        {/* Revendeur : mode de reversement convenu / Client : paiement */}
        {target === 'revendeur' ? (
          lines.length > 0 && (
            <div>
              <p className="section-title !text-xs mb-2">Reversement convenu</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['ventes', 'Au réel'],
                  ['montant', 'Montant fixe'],
                  ['pourcentage', '% du lot'],
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
                <p className="text-ink/45 text-xs mt-2">Le dû suivra les ventes que vous enregistrerez pour ce revendeur.</p>
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
              {dueType === 'pourcentage' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    className="input !py-2 w-24 text-center"
                    type="number"
                    step="1"
                    inputMode="decimal"
                    placeholder="%"
                    value={dueRate}
                    onChange={(e) => setDueRate(e.target.value)}
                  />
                  <span className="text-ink/40 text-sm">%</span>
                  {[50, 60, 70].map((p) => (
                    <button key={p} className="chip active:scale-95" onClick={() => setDueRate(String(p))}>{p} %</button>
                  ))}
                </div>
              )}
              {/* Échéance de reversement */}
              <div className="flex items-center gap-2 mt-3">
                <label className="text-ink/55 text-xs shrink-0">Reversement attendu le</label>
                <input className="input !py-2 flex-1" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
            </div>
          )
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {(['especes', 'carte', 'credit'] as const).map((m) => (
              <button
                key={m}
                className={m === method ? 'btn-primary !py-2.5' : 'btn-glass !py-2.5'}
                onClick={() => setMethod(m)}
              >
                {m === 'especes' ? 'Espèces' : m === 'carte' ? 'Carte' : 'Crédit'}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-rose-600 text-sm">{error}</p>}
        <button className="btn-accent w-full py-4 justify-between px-6" onClick={submit} disabled={busy || lines.length === 0}>
          <span>{busy ? 'Traitement…' : target === 'revendeur' ? 'Remettre le lot' : 'Valider la vente'}</span>
          <span>{fmt(totalVente)}</span>
        </button>
      </div>
    </div>
  );
}

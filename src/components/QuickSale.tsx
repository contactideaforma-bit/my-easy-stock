'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, variantLabel } from '@/lib/utils';
import { shareTicket } from '@/lib/ticket';
import { IconCheck, IconInvoice, IconShare, IconTrash } from '@/components/Icons';
import type { Customer, Product, Variant, Vendor } from '@/lib/types';

type Line = { variant: Variant; qty: number; price: number };

/**
 * Vente express depuis une fiche produit :
 * plusieurs déclinaisons sélectionnables (panier), quantité + prix libre par ligne,
 * résumé achat/vente/bénéfice, client OU revendeur (créables à la volée),
 * facture et ticket à la fin.
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
  const [target, setTarget] = useState<'client' | 'vendeur'>('client');
  const [method, setMethod] = useState<'especes' | 'carte' | 'credit'>('especes');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [vendorMap, setVendorMap] = useState<Record<string, number>>({});
  const [agreedMap, setAgreedMap] = useState<Record<string, number>>({});
  const [newMode, setNewMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ saleId: string; number: number; date: string; total: number; benefice: number } | null>(null);

  useEffect(() => {
    const sb = supabase();
    sb.from('customers').select('*').order('name').then(({ data }) => setCustomers((data as any) || []));
    sb.from('vendors').select('*').eq('active', true).order('name').then(({ data }) => setVendors((data as any) || []));
  }, []);

  // Stock du revendeur sélectionné pour ce produit
  useEffect(() => {
    setLines([]);
    if (target !== 'vendeur' || !vendorId) {
      setVendorMap({});
      setAgreedMap({});
      return;
    }
    supabase()
      .from('vendor_stock')
      .select('variant_id,qty,agreed_price')
      .eq('vendor_id', vendorId)
      .in('variant_id', variants.map((v) => v.id))
      .then(({ data }) => {
        const m: Record<string, number> = {};
        const a: Record<string, number> = {};
        (data || []).forEach((r: any) => {
          m[r.variant_id] = r.qty;
          if (r.agreed_price != null) a[r.variant_id] = Number(r.agreed_price);
        });
        setVendorMap(m);
        setAgreedMap(a);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, vendorId]);

  const dispo = (v: Variant) => (target === 'vendeur' ? vendorMap[v.id] || 0 : v.stock);
  const inCart = (v: Variant) => lines.find((l) => l.variant.id === v.id)?.qty || 0;

  function tapVariant(v: Variant) {
    setError('');
    const max = dispo(v);
    setLines((prev) => {
      const i = prev.findIndex((l) => l.variant.id === v.id);
      if (i >= 0) {
        if (prev[i].qty + 1 > max) return prev;
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      if (max < 1) return prev;
      const defaultPrice = target === 'vendeur' && agreedMap[v.id] != null ? agreedMap[v.id] : Number(product.sale_price);
      return [...prev, { variant: v, qty: 1, price: defaultPrice }];
    });
  }

  function setQty(variantId: string, qty: number) {
    setLines((prev) => {
      const l = prev.find((x) => x.variant.id === variantId);
      if (!l) return prev;
      const max = dispo(l.variant);
      return qty <= 0
        ? prev.filter((x) => x.variant.id !== variantId)
        : prev.map((x) => (x.variant.id === variantId ? { ...x, qty: Math.min(qty, max) } : x));
    });
  }

  function setPrice(variantId: string, price: number) {
    setLines((prev) => prev.map((x) => (x.variant.id === variantId ? { ...x, price: Math.max(0, price) } : x)));
  }

  const totalVente = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const totalAchat = lines.reduce((s, l) => s + l.qty * Number(product.purchase_price), 0);
  const benefice = totalVente - totalAchat;
  const nbPieces = lines.reduce((s, l) => s + l.qty, 0);
  const catalogue = Number(product.sale_price);

  async function createContact() {
    const n = newName.trim();
    if (!n) return;
    const sb = supabase();
    if (target === 'client') {
      const { data } = await sb.from('customers').insert({ name: n, phone: newPhone.trim() || null }).select().single();
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
    setNewPhone('');
    setNewMode(false);
  }

  async function submit() {
    if (lines.length === 0) {
      setError('Sélectionnez au moins une déclinaison.');
      return;
    }
    if (target === 'vendeur' && !vendorId) {
      setError('Choisissez ou créez le revendeur.');
      return;
    }
    if (method === 'credit' && !customerId) {
      setError('Le crédit nécessite un client identifié.');
      return;
    }
    setBusy(true);
    setError('');
    const { data: saleId, error: err } = await supabase().rpc('process_sale', {
      p_items: lines.map((l) => ({ variant_id: l.variant.id, qty: l.qty, unit_price: l.price })),
      p_payment_method: target === 'vendeur' && method === 'credit' ? 'especes' : method,
      p_customer_id: target === 'client' && customerId ? customerId : null,
      p_paid_amount: method === 'credit' ? 0 : totalVente,
      p_vendor_id: target === 'vendeur' ? vendorId : null,
      p_discount: 0,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const { data: saleRow } = await supabase().from('sales').select('number,created_at').eq('id', saleId).single();
    setDone({
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
                shareTicket({
                  number: done.number,
                  date: done.date,
                  items: lines.map((l) => ({ name: product.name, label: variantLabel(l.variant), qty: l.qty, unit_price: l.price })),
                  total: done.total,
                  method,
                  vendorName: target === 'vendeur' ? vendors.find((v) => v.id === vendorId)?.name || null : null,
                })
              }
            >
              <IconShare /> Ticket
            </button>
          </div>
          <button className="btn-accent w-full" onClick={onDone}>Fermer</button>
        </div>
      </div>
    );

  /* ---------- Formulaire de vente ---------- */
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={onClose}>
      <div
        className="glass-strong w-full max-w-lg mx-auto rounded-b-none p-6 pb-10 space-y-4 max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-ink">Vendre — {product.name}</h3>

        {/* Pour qui ? */}
        <div className="grid grid-cols-2 gap-2">
          {(['client', 'vendeur'] as const).map((t) => (
            <button
              key={t}
              className={target === t ? 'btn-primary !py-2.5' : 'btn-glass !py-2.5'}
              onClick={() => { setTarget(t); setNewMode(false); setError(''); }}
            >
              {t === 'client' ? 'Client (dépôt)' : 'Revendeur'}
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
              <option key={c.id} value={c.id} className="text-black">{c.name}</option>
            ))}
            <option value="__new__" className="text-black">+ Nouveau {target === 'client' ? 'client' : 'revendeur'}…</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Nom *" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <input className="input flex-1" placeholder="Téléphone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            <button className="btn-primary !px-4" onClick={createContact}>Créer</button>
          </div>
        )}

        {/* Déclinaisons : tap pour ajouter (plusieurs possibles) */}
        <div>
          <p className="text-ink/55 text-xs mb-1.5">
            Touchez les déclinaisons vendues — plusieurs possibles, chaque touche ajoute une pièce :
          </p>
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
                  {variantLabel(v)} {n > 0 ? `×${n}` : `(${d})`}
                </button>
              );
            })}
          </div>
          {target === 'vendeur' && !vendorId && (
            <p className="text-orange-700/90 text-xs mt-1.5">Choisissez d&apos;abord le revendeur pour voir son stock.</p>
          )}
        </div>

        {/* Lignes du panier */}
        {lines.length > 0 && (
          <ul className="space-y-2.5">
            {lines.map((l) => (
              <li key={l.variant.id} className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink w-20 shrink-0 truncate">{variantLabel(l.variant)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="btn-glass !p-0 w-8 h-8 !rounded-xl" onClick={() => setQty(l.variant.id, l.qty - 1)}>−</button>
                  <span className="w-6 text-center font-bold text-ink text-sm">{l.qty}</span>
                  <button className="btn-glass !p-0 w-8 h-8 !rounded-xl" onClick={() => setQty(l.variant.id, l.qty + 1)}>+</button>
                </div>
                <input
                  className="input !py-1 !px-2 !rounded-lg text-sm text-center flex-1"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={l.price}
                  onChange={(e) => setPrice(l.variant.id, Number(e.target.value))}
                  aria-label="Prix unitaire"
                />
                {l.price < catalogue && (
                  <span className="chip chip-warn !text-[10px] !px-1.5 shrink-0">−{Math.round((1 - l.price / catalogue) * 100)}%</span>
                )}
                <button className="text-rose-500/70 shrink-0" onClick={() => setQty(l.variant.id, 0)}>
                  <IconTrash className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Résumé bénéfice */}
        {lines.length > 0 && (
          <div className="glass !rounded-2xl p-3 grid grid-cols-4 text-center">
            <div>
              <p className="text-ink/50 text-[11px]">Pièces</p>
              <p className="font-semibold text-ink text-sm">{nbPieces}</p>
            </div>
            <div>
              <p className="text-ink/50 text-[11px]">Achat</p>
              <p className="font-semibold text-ink text-sm">{fmt(totalAchat)}</p>
            </div>
            <div>
              <p className="text-ink/50 text-[11px]">Vente</p>
              <p className="font-semibold text-ink text-sm">{fmt(totalVente)}</p>
            </div>
            <div>
              <p className="text-ink/50 text-[11px]">Bénéfice</p>
              <p className={`font-bold text-sm ${benefice >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmt(benefice)}</p>
            </div>
          </div>
        )}

        {/* Paiement */}
        <div className="grid grid-cols-3 gap-2">
          {(['especes', 'carte', 'credit'] as const).map((m) => (
            <button
              key={m}
              className={m === method ? 'btn-primary !py-2.5' : 'btn-glass !py-2.5'}
              disabled={m === 'credit' && target === 'vendeur'}
              onClick={() => setMethod(m)}
            >
              {m === 'especes' ? 'Espèces' : m === 'carte' ? 'Carte' : 'Crédit'}
            </button>
          ))}
        </div>

        {error && <p className="text-rose-600 text-sm">{error}</p>}
        <button className="btn-accent w-full py-4 justify-between px-6" onClick={submit} disabled={busy || lines.length === 0}>
          <span>{busy ? 'Traitement…' : 'Valider la vente'}</span>
          <span>{fmt(totalVente)}</span>
        </button>
      </div>
    </div>
  );
}

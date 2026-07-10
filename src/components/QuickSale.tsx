'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, variantLabel } from '@/lib/utils';
import { shareTicket } from '@/lib/ticket';
import { IconCheck, IconInvoice, IconShare } from '@/components/Icons';
import type { Customer, Product, Variant, Vendor } from '@/lib/types';

/**
 * Vente express depuis une fiche produit :
 * variante + quantité + prix libre, résumé achat/vente/bénéfice,
 * client OU revendeur (créables à la volée), facture et ticket à la fin.
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
  const firstAvailable = variants.find((v) => v.stock > 0) || variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id || '');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(Number(product.sale_price));
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
  const [done, setDone] = useState<{ saleId: string; number: number; date: string } | null>(null);

  const variant = variants.find((v) => v.id === variantId);

  useEffect(() => {
    const sb = supabase();
    sb.from('customers').select('*').order('name').then(({ data }) => setCustomers((data as any) || []));
    sb.from('vendors').select('*').eq('active', true).order('name').then(({ data }) => setVendors((data as any) || []));
  }, []);

  // Stock du revendeur sélectionné pour ce produit
  useEffect(() => {
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

  // Prix convenu proposé automatiquement pour un revendeur
  useEffect(() => {
    if (target === 'vendeur' && variantId && agreedMap[variantId] != null) setPrice(agreedMap[variantId]);
    if (target === 'client') setPrice(Number(product.sale_price));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, vendorId, variantId, agreedMap]);

  const dispo = useMemo(() => {
    if (!variant) return 0;
    return target === 'vendeur' ? vendorMap[variant.id] || 0 : variant.stock;
  }, [variant, target, vendorMap]);

  const totalVente = qty * price;
  const totalAchat = qty * Number(product.purchase_price);
  const benefice = totalVente - totalAchat;
  const catalogue = Number(product.sale_price);
  const remisePct = price < catalogue ? Math.round((1 - price / catalogue) * 100) : 0;

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
    if (!variant) return;
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
      p_items: [{ variant_id: variant.id, qty, unit_price: price }],
      p_payment_method: target === 'vendeur' ? (method === 'credit' ? 'especes' : method) : method,
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
    setDone({ saleId: saleId as string, number: saleRow?.number || 0, date: saleRow?.created_at || new Date().toISOString() });
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
            <p className="text-crystal-800 text-lg font-semibold mt-1">{fmt(totalVente)}</p>
            <p className="text-emerald-600 text-sm">Bénéfice : {fmt(benefice)}</p>
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
                  items: [{ name: product.name, label: variant ? variantLabel(variant) : null, qty, unit_price: price }],
                  total: totalVente,
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
        className="glass-strong w-full max-w-lg mx-auto rounded-b-none p-6 pb-10 space-y-4 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-ink">Vendre — {product.name}</h3>

        {/* Variante */}
        <div className="flex flex-wrap gap-1.5">
          {variants.map((v) => {
            const d = target === 'vendeur' ? vendorMap[v.id] || 0 : v.stock;
            return (
              <button
                key={v.id}
                className={`chip ${variantId === v.id ? '!bg-crystal-600 !text-white !border-crystal-600' : ''} ${d === 0 ? 'opacity-40' : ''}`}
                onClick={() => { setVariantId(v.id); setQty(1); }}
              >
                {variantLabel(v)} ({d})
              </button>
            );
          })}
        </div>

        {/* Quantité + prix */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button className="btn-glass !p-0 w-9 h-9 !rounded-xl" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
            <span className="w-8 text-center font-bold text-ink">{qty}</span>
            <button className="btn-glass !p-0 w-9 h-9 !rounded-xl" onClick={() => setQty(Math.min(dispo || 1, qty + 1))}>+</button>
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <input
              className="input !py-2 text-center font-semibold"
              type="number"
              step="0.01"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
              aria-label="Prix unitaire"
            />
            <span className="text-ink/40 text-sm shrink-0">€/u</span>
          </div>
          {remisePct > 0 && <span className="chip chip-warn shrink-0">−{remisePct} %</span>}
        </div>
        {dispo === 0 && <p className="text-orange-700/90 text-xs">Aucun stock disponible pour cette variante {target === 'vendeur' ? 'chez ce revendeur' : 'au dépôt'}.</p>}

        {/* Résumé bénéfice */}
        <div className="glass !rounded-2xl p-3 grid grid-cols-3 text-center">
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
        <button className="btn-accent w-full py-4 justify-between px-6" onClick={submit} disabled={busy || dispo === 0 || !variant}>
          <span>{busy ? 'Traitement…' : 'Valider la vente'}</span>
          <span>{fmt(totalVente)}</span>
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, variantLabel } from '@/lib/utils';
import Scanner from '@/components/Scanner';
import { shareTicket, TicketData } from '@/lib/ticket';
import { IconScan, IconSearch, IconTrash, IconCheck, IconShare, IconInvoice } from '@/components/Icons';
import type { CartLine, Customer, Product, Variant, Vendor } from '@/lib/types';

type SearchHit = Product & { product_variants: Variant[] };

export default function CaissePage() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [vendorStock, setVendorStock] = useState<Record<string, number>>({});
  const [scanning, setScanning] = useState(false);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<'especes' | 'carte' | 'credit'>('especes');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ total: number; change: number; ticket: TicketData | null; saleId: string | null } | null>(null);

  // Association express : code scanné inconnu → le rattacher à un article
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [assignQ, setAssignQ] = useState('');
  const [assignHits, setAssignHits] = useState<(Variant & { products: Product })[]>([]);

  const total = useMemo(() => cart.reduce((s, l) => s + l.qty * l.unit_price, 0), [cart]);
  const change = Math.max(0, (Number(received) || 0) - total);

  // Recherche produits
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase()
        .from('products')
        .select('*, product_variants(*)')
        .eq('archived', false)
        .ilike('name', `%${s}%`)
        .limit(6);
      setHits((data as any) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const sb = supabase();
    sb.from('customers').select('*').order('name').then(({ data }) => setCustomers(data || []));
    sb.from('vendors').select('*').eq('active', true).order('name').then(({ data }) => setVendors((data as any) || []));
  }, []);

  // Stock du vendeur sélectionné
  useEffect(() => {
    setCart([]);
    setError('');
    if (!vendorId) {
      setVendorStock({});
      return;
    }
    supabase()
      .from('vendor_stock')
      .select('variant_id,qty')
      .eq('vendor_id', vendorId)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        (data || []).forEach((r: any) => (map[r.variant_id] = r.qty));
        setVendorStock(map);
      });
  }, [vendorId]);

  /** Stock disponible selon la source sélectionnée (dépôt ou vendeur) */
  function stockOf(variant: Variant) {
    return vendorId ? vendorStock[variant.id] || 0 : variant.stock;
  }

  function addToCart(product: Product, variant: Variant) {
    setError('');
    const dispo = stockOf(variant);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.variant.id === variant.id);
      if (i >= 0) {
        if (prev[i].qty + 1 > dispo) {
          setError(`Stock insuffisant : ${product.name} (${variantLabel(variant)})`);
          return prev;
        }
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      if (dispo < 1) {
        setError(`Épuisé : ${product.name} (${variantLabel(variant)})`);
        return prev;
      }
      return [...prev, { product, variant, qty: 1, unit_price: Number(product.sale_price) }];
    });
    setQ('');
    setHits([]);
  }

  async function onScan(code: string) {
    const { data } = await supabase()
      .from('product_variants')
      .select('*, products(*)')
      .or(`barcode.eq.${code},sku.eq.${code}`)
      .limit(1)
      .maybeSingle();
    if (data && (data as any).products) {
      addToCart((data as any).products, data as any);
    } else {
      // code fabricant pas encore connu → proposer l'association
      setScanning(false);
      setPendingCode(code);
      setAssignQ('');
      setAssignHits([]);
    }
  }

  // Recherche pour l'association express
  useEffect(() => {
    const s = assignQ.trim();
    if (s.length < 2 || !pendingCode) {
      setAssignHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase()
        .from('product_variants')
        .select('*, products!inner(*)')
        .eq('products.archived', false)
        .ilike('products.name', `%${s}%`)
        .limit(8);
      setAssignHits((data as any) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [assignQ, pendingCode]);

  async function assignPendingCode(v: Variant & { products: Product }) {
    if (!pendingCode) return;
    const { error: err } = await supabase().from('product_variants').update({ barcode: pendingCode }).eq('id', v.id);
    if (err) {
      setError(err.code === '23505' ? 'Ce code est déjà associé à un autre article.' : err.message);
      setPendingCode(null);
      return;
    }
    setPendingCode(null);
    addToCart(v.products, { ...v, barcode: pendingCode });
  }

  function setQty(variantId: string, qty: number) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variant.id !== variantId)
        : prev.map((l) => (l.variant.id === variantId ? { ...l, qty: Math.min(qty, stockOf(l.variant)) } : l))
    );
  }

  async function checkout() {
    if (cart.length === 0) return;
    if (method === 'credit' && !customerId) {
      setError('Sélectionnez un client pour une vente à crédit.');
      return;
    }
    setBusy(true);
    setError('');
    const itemsSnapshot = cart.map((l) => ({
      name: l.product.name,
      label: [l.variant.size, l.variant.color].filter(Boolean).join(' · ') || null,
      qty: l.qty,
      unit_price: l.unit_price,
    }));
    const { data: saleId, error: err } = await supabase().rpc('process_sale', {
      p_items: cart.map((l) => ({ variant_id: l.variant.id, qty: l.qty, unit_price: l.unit_price })),
      p_payment_method: method,
      p_customer_id: method === 'credit' ? customerId : null,
      p_paid_amount: method === 'credit' ? 0 : total,
      p_vendor_id: vendorId || null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    let ticket: TicketData | null = null;
    if (saleId) {
      const { data: saleRow } = await supabase().from('sales').select('number,created_at').eq('id', saleId).single();
      if (saleRow) {
        ticket = {
          number: saleRow.number,
          date: saleRow.created_at,
          items: itemsSnapshot,
          total,
          method,
          vendorName: vendorId ? vendors.find((v) => v.id === vendorId)?.name || null : null,
        };
      }
    }
    setDone({ total, change: method === 'especes' ? change : 0, ticket, saleId: (saleId as string) || null });
    setCart([]);
    setPaying(false);
    setReceived('');
    setCustomerId('');
    if (vendorId) {
      const { data } = await supabase().from('vendor_stock').select('variant_id,qty').eq('vendor_id', vendorId);
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => (map[r.variant_id] = r.qty));
      setVendorStock(map);
    }
  }

  if (done)
    return (
      <div className="min-h-[70dvh] flex items-center justify-center">
        <div className="glass-strong p-8 text-center w-full">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg,#34d399,#059669)' }}>
            <IconCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-ink">Vente encaissée</h2>
          <p className="text-crystal-800 text-lg mt-2">{fmt(done.total)}</p>
          {done.change > 0 && (
            <p className="text-crystal-700/80 mt-1">
              Monnaie à rendre : <span className="font-bold text-ink">{fmt(done.change)}</span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 mt-6">
            {done.ticket && (
              <button className="btn-glass" onClick={() => shareTicket(done.ticket!)}>
                <IconShare /> Ticket
              </button>
            )}
            {done.saleId && (
              <Link href={`/factures/${done.saleId}`} className={done.ticket ? 'btn-glass' : 'btn-glass col-span-2'}>
                <IconInvoice className="w-5 h-5" /> Facture
              </Link>
            )}
          </div>
          <button className="btn-primary w-full mt-3" onClick={() => setDone(null)}>
            Nouvelle vente
          </button>
        </div>
      </div>
    );

  return (
    <div className="space-y-4 pb-40">
      <header className="flex items-center justify-between gap-3 pt-2">
        <h1 className="text-2xl font-bold text-ink">Caisse</h1>
        <select
          className="input !w-auto !py-2 !px-3 text-sm font-medium"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          aria-label="Source du stock"
        >
          <option value="" className="text-black">Stock : Dépôt</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id} className="text-black">Stock : {v.name}</option>
          ))}
        </select>
      </header>

      {vendorId && (
        <p className="text-xs text-crystal-700 -mt-2 px-1">
          Vente sur le stock de <strong>{vendors.find((v) => v.id === vendorId)?.name}</strong> — son stock sera décrémenté.
        </p>
      )}

      {/* Recherche + scan */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <IconSearch className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-ink/45" />
          <input className="input pl-11" placeholder="Rechercher un article…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary !px-4" onClick={() => setScanning(true)} aria-label="Scanner">
          <IconScan />
        </button>
      </div>

      {/* Résultats de recherche */}
      {hits.length > 0 && (
        <div className="glass p-3 space-y-3">
          {hits.map((p) => (
            <div key={p.id}>
              <p className="text-sm font-semibold text-ink mb-1.5">
                {p.name} <span className="text-ink/55 font-normal">— {fmt(Number(p.sale_price))}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {p.product_variants.map((v) => {
                  const dispo = stockOf(v);
                  return (
                    <button
                      key={v.id}
                      className={`chip ${dispo === 0 ? 'opacity-40' : 'active:scale-95'}`}
                      disabled={dispo === 0}
                      onClick={() => addToCart(p, v)}
                    >
                      {variantLabel(v)} ({dispo})
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-rose-600 text-sm px-1">{error}</p>}

      {/* Panier */}
      <section className="glass p-4">
        <h2 className="section-title mb-3">Panier</h2>
        {cart.length === 0 ? (
          <p className="text-ink/55 text-sm">Scannez ou recherchez un article pour commencer.</p>
        ) : (
          <ul className="space-y-3">
            {cart.map((l) => (
              <li key={l.variant.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{l.product.name}</p>
                  <p className="text-xs text-ink/55">
                    {variantLabel(l.variant)} · {fmt(l.unit_price)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="btn-glass !p-0 w-8 h-8 !rounded-xl" onClick={() => setQty(l.variant.id, l.qty - 1)}>−</button>
                  <span className="w-7 text-center font-bold text-ink">{l.qty}</span>
                  <button className="btn-glass !p-0 w-8 h-8 !rounded-xl" onClick={() => setQty(l.variant.id, l.qty + 1)}>+</button>
                  <button className="text-rose-500/70 ml-1" onClick={() => setQty(l.variant.id, 0)}>
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Barre total */}
      {cart.length > 0 && !paying && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-30">
          <button className="btn-accent w-full py-4 text-lg justify-between px-6" onClick={() => setPaying(true)}>
            <span>Encaisser</span>
            <span>{fmt(total)}</span>
          </button>
        </div>
      )}

      {/* Volet paiement */}
      {paying && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setPaying(false)}>
          <div className="glass-strong w-full max-w-lg mx-auto rounded-b-none p-6 pb-10 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">Paiement</h3>
              <span className="text-2xl font-bold text-crystal-800">{fmt(total)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['especes', 'carte', 'credit'] as const).map((m) => (
                <button
                  key={m}
                  className={m === method ? 'btn-primary !py-3' : 'btn-glass !py-3'}
                  onClick={() => setMethod(m)}
                >
                  {m === 'especes' ? 'Espèces' : m === 'carte' ? 'Carte' : 'Crédit'}
                </button>
              ))}
            </div>

            {method === 'especes' && (
              <div>
                <input
                  className="input text-center text-lg"
                  type="number"
                  inputMode="decimal"
                  placeholder="Montant reçu"
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
                {Number(received) >= total && total > 0 && (
                  <p className="text-center text-crystal-800 mt-2">
                    Monnaie à rendre : <span className="font-bold text-ink">{fmt(change)}</span>
                  </p>
                )}
              </div>
            )}

            {method === 'credit' && (
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="" className="text-black">Choisir le client…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id} className="text-black">{c.name}</option>
                ))}
              </select>
            )}

            {error && <p className="text-rose-600 text-sm">{error}</p>}
            <button className="btn-primary w-full py-4" onClick={checkout} disabled={busy}>
              {busy ? 'Traitement…' : 'Valider la vente'}
            </button>
          </div>
        </div>
      )}

      {scanning && <Scanner onDetected={onScan} onClose={() => setScanning(false)} />}

      {/* Association express d'un code inconnu */}
      {pendingCode && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setPendingCode(null)}>
          <div
            className="glass-strong w-full max-w-lg mx-auto rounded-b-none p-6 pb-10 space-y-3 max-h-[80dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-ink">Code inconnu</h3>
            <p className="text-ink/60 text-sm">
              Le code <span className="chip">{pendingCode}</span> n&apos;est associé à aucun article.
              Choisissez l&apos;article correspondant : il sera reconnu à tous les prochains scans.
            </p>
            <div className="relative">
              <IconSearch className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                className="input pl-11"
                placeholder="Rechercher l'article…"
                value={assignQ}
                onChange={(e) => setAssignQ(e.target.value)}
                autoFocus
              />
            </div>
            {assignHits.length > 0 && (
              <div className="space-y-1">
                {assignHits.map((v) => (
                  <button
                    key={v.id}
                    className="w-full flex items-center justify-between text-left py-2 px-2 rounded-xl hover:bg-crystal-500/10"
                    onClick={() => assignPendingCode(v)}
                  >
                    <span className="text-sm text-ink">
                      {v.products.name} <span className="text-ink/55">· {variantLabel(v)}</span>
                    </span>
                    <span className="chip">{stockOf(v)} dispo</span>
                  </button>
                ))}
              </div>
            )}
            <button className="btn-glass w-full" onClick={() => setPendingCode(null)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}

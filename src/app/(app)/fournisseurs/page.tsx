'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDay, variantLabel } from '@/lib/utils';
import { IconBack, IconPlus, IconSearch, IconTrash } from '@/components/Icons';
import type { Purchase, Supplier, Variant } from '@/lib/types';

type VariantHit = Variant & { products: { name: string; purchase_price: number } };
type OrderLine = { variant: VariantHit; qty: number; unit_cost: number };

export default function FournisseursPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [tab, setTab] = useState<'commandes' | 'fournisseurs'>('commandes');

  // nouveau fournisseur
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [sName, setSName] = useState('');
  const [sPhone, setSPhone] = useState('');

  // nouvelle commande
  const [ordering, setOrdering] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<VariantHit[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data: s }, { data: p }] = await Promise.all([
      sb.from('suppliers').select('*').order('name'),
      sb
        .from('purchases')
        .select('*, suppliers(name), purchase_items(*, product_variants(*, products(name)))')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setSuppliers((s as any) || []);
    setPurchases((p as any) || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase()
        .from('product_variants')
        .select('*, products!inner(name, purchase_price, archived)')
        .eq('products.archived', false)
        .ilike('products.name', `%${s}%`)
        .limit(8);
      setHits((data as any) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function addSupplier() {
    if (!sName.trim()) return;
    await supabase().from('suppliers').insert({ name: sName.trim(), phone: sPhone.trim() || null });
    setSName('');
    setSPhone('');
    setAddingSupplier(false);
    load();
  }

  function addLine(v: VariantHit) {
    if (!lines.find((l) => l.variant.id === v.id)) {
      setLines([...lines, { variant: v, qty: 1, unit_cost: Number(v.products.purchase_price) || 0 }]);
    }
    setQ('');
    setHits([]);
  }

  async function saveOrder() {
    if (lines.length === 0) return;
    setBusy(true);
    const sb = supabase();
    const { data: purchase, error } = await sb
      .from('purchases')
      .insert({ supplier_id: supplierId || null })
      .select()
      .single();
    if (!error && purchase) {
      await sb.from('purchase_items').insert(
        lines.map((l) => ({ purchase_id: purchase.id, variant_id: l.variant.id, qty: l.qty, unit_cost: l.unit_cost }))
      );
    }
    setLines([]);
    setSupplierId('');
    setOrdering(false);
    setBusy(false);
    load();
  }

  async function receive(id: string) {
    if (!confirm('Réceptionner cette commande ? Le stock sera incrémenté.')) return;
    const { error } = await supabase().rpc('receive_purchase', { p_purchase_id: id });
    if (error) alert(error.message);
    load();
  }

  const orderTotal = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/plus" className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-white flex-1">Fournisseurs</h1>
      </header>

      <div className="glass p-1 grid grid-cols-2 gap-1">
        {(['commandes', 'fournisseurs'] as const).map((t) => (
          <button key={t} className={tab === t ? 'btn-primary !py-2 text-sm' : 'btn !py-2 text-sm text-crystal-300/70'} onClick={() => setTab(t)}>
            {t === 'commandes' ? 'Commandes' : 'Fournisseurs'}
          </button>
        ))}
      </div>

      {tab === 'fournisseurs' && (
        <>
          <button className="btn-glass w-full" onClick={() => setAddingSupplier(!addingSupplier)}>
            <IconPlus className="w-4 h-4" /> Nouveau fournisseur
          </button>
          {addingSupplier && (
            <div className="glass p-4 space-y-3">
              <input className="input" placeholder="Nom *" value={sName} onChange={(e) => setSName(e.target.value)} />
              <input className="input" placeholder="Téléphone" value={sPhone} onChange={(e) => setSPhone(e.target.value)} />
              <button className="btn-primary w-full" onClick={addSupplier}>Ajouter</button>
            </div>
          )}
          <div className="glass p-2">
            {suppliers.length === 0 ? (
              <p className="p-4 text-center text-crystal-300/60 text-sm">Aucun fournisseur.</p>
            ) : (
              suppliers.map((s) => (
                <div key={s.id} className="p-3">
                  <p className="text-crystal-100 font-medium text-sm">{s.name}</p>
                  {s.phone && <p className="text-crystal-300/50 text-xs">{s.phone}</p>}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === 'commandes' && (
        <>
          {!ordering ? (
            <button className="btn-primary w-full" onClick={() => setOrdering(true)}>
              <IconPlus className="w-4 h-4" /> Nouvelle commande
            </button>
          ) : (
            <div className="glass-strong p-4 space-y-3">
              <h2 className="section-title">Nouvelle commande</h2>
              <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="" className="text-black">Fournisseur (optionnel)…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id} className="text-black">{s.name}</option>
                ))}
              </select>

              <div className="relative">
                <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-crystal-300/50" />
                <input className="input pl-11" placeholder="Ajouter un article…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {hits.length > 0 && (
                <div className="space-y-1">
                  {hits.map((v) => (
                    <button key={v.id} className="w-full text-left text-sm text-crystal-100 py-1.5 px-2 rounded-xl hover:bg-white/5" onClick={() => addLine(v)}>
                      {v.products.name} <span className="text-crystal-300/60">· {variantLabel(v)}</span>
                    </button>
                  ))}
                </div>
              )}

              {lines.map((l, i) => (
                <div key={l.variant.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-crystal-100 truncate">{l.variant.products.name}</p>
                    <p className="text-xs text-crystal-300/60">{variantLabel(l.variant)}</p>
                  </div>
                  <input className="input !w-16 !py-1.5 text-center" type="number" inputMode="numeric" value={l.qty}
                    onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x)))} />
                  <input className="input !w-20 !py-1.5 text-center" type="number" step="0.01" inputMode="decimal" value={l.unit_cost}
                    onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unit_cost: Number(e.target.value) } : x)))} />
                  <button className="text-rose-300/70" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {lines.length > 0 && (
                <p className="text-right text-crystal-200 text-sm">Total : <span className="font-bold text-white">{fmt(orderTotal)}</span></p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-glass" onClick={() => { setOrdering(false); setLines([]); }}>Annuler</button>
                <button className="btn-primary" onClick={saveOrder} disabled={busy || lines.length === 0}>Enregistrer</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {purchases.map((p) => {
              const total = (p.purchase_items || []).reduce((s, it) => s + it.qty * Number(it.unit_cost), 0);
              return (
                <div key={p.id} className="glass p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-crystal-100 font-medium text-sm">
                        {p.suppliers?.name || 'Sans fournisseur'} · {fmtDay(p.created_at)}
                      </p>
                      <p className="text-crystal-300/60 text-xs">
                        {(p.purchase_items || []).reduce((s, it) => s + it.qty, 0)} pièce(s) · {fmt(total)}
                      </p>
                    </div>
                    {p.status === 'en_attente' ? (
                      <button className="btn-primary !py-2 !px-3 text-xs" onClick={() => receive(p.id)}>Réceptionner</button>
                    ) : (
                      <span className={`chip ${p.status === 'recue' ? 'chip-ok' : 'chip-danger'}`}>
                        {p.status === 'recue' ? 'Reçue' : 'Annulée'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {purchases.length === 0 && <div className="glass p-8 text-center text-crystal-300/60 text-sm">Aucune commande.</div>}
          </div>
        </>
      )}
    </div>
  );
}

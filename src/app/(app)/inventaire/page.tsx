'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { variantLabel } from '@/lib/utils';
import Scanner from '@/components/Scanner';
import { IconScan, IconSearch, IconClipboard } from '@/components/Icons';
import type { InventoryCount, InventorySession, Variant } from '@/lib/types';

type VariantHit = Variant & { products: { name: string; archived: boolean } };

export default function InventairePage() {
  const [session, setSession] = useState<InventorySession | null>(null);
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<VariantHit[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const sb = supabase();
    const { data: s } = await sb
      .from('inventory_sessions')
      .select('*')
      .eq('status', 'en_cours')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSession(s as any);
    if (s) {
      const { data: c } = await sb
        .from('inventory_counts')
        .select('*, product_variants(*, products(name))')
        .eq('session_id', s.id)
        .order('id');
      setCounts((c as any) || []);
    } else {
      setCounts([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Recherche de variantes
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2 || !session) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase()
        .from('product_variants')
        .select('*, products!inner(name, archived)')
        .eq('products.archived', false)
        .ilike('products.name', `%${s}%`)
        .limit(10);
      setHits((data as any) || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, session]);

  async function start() {
    setBusy(true);
    await supabase().from('inventory_sessions').insert({ status: 'en_cours' });
    await load();
    setBusy(false);
  }

  async function addCount(variant: VariantHit, counted?: number) {
    if (!session) return;
    const existing = counts.find((c) => c.variant_id === variant.id);
    const qty = counted !== undefined ? counted : (existing ? existing.counted_qty + 1 : 1);
    await supabase()
      .from('inventory_counts')
      .upsert(
        { session_id: session.id, variant_id: variant.id, counted_qty: qty, expected_qty: variant.stock },
        { onConflict: 'session_id,variant_id' }
      );
    setQ('');
    setHits([]);
    setMsg(`${variant.products.name} · ${variantLabel(variant)} → ${qty}`);
    setTimeout(() => setMsg(''), 2000);
    load();
  }

  async function updateCount(c: InventoryCount, qty: number) {
    await supabase().from('inventory_counts').update({ counted_qty: Math.max(0, qty) }).eq('id', c.id);
    load();
  }

  async function onScan(code: string) {
    const { data } = await supabase()
      .from('product_variants')
      .select('*, products(name, archived)')
      .or(`barcode.eq.${code},sku.eq.${code}`)
      .limit(1)
      .maybeSingle();
    if (data) addCount(data as any);
    else {
      setMsg(`Code inconnu : ${code}`);
      setTimeout(() => setMsg(''), 2500);
    }
  }

  async function closeSession() {
    if (!session) return;
    const ecarts = counts.filter((c) => c.counted_qty !== c.expected_qty).length;
    if (!confirm(`Clôturer l'inventaire ? ${ecarts} écart(s) seront appliqués au stock.`)) return;
    setBusy(true);
    const { error } = await supabase().rpc('close_inventory', { p_session_id: session.id });
    setBusy(false);
    if (error) alert(error.message);
    else load();
  }

  if (!session)
    return (
      <div className="space-y-4">
        <header className="pt-2">
          <h1 className="text-2xl font-bold text-ink">Inventaire</h1>
        </header>
        <div className="glass-strong p-8 text-center space-y-4">
          <IconClipboard className="w-14 h-14 mx-auto text-crystal-500" />
          <p className="text-crystal-800">
            Lancez une session d&apos;inventaire : scannez ou comptez vos articles, l&apos;app calcule les écarts et corrige le stock automatiquement.
          </p>
          <button className="btn-primary w-full py-4" onClick={start} disabled={busy}>
            Démarrer un inventaire
          </button>
        </div>
      </div>
    );

  const ecarts = counts.filter((c) => c.counted_qty !== c.expected_qty);

  return (
    <div className="space-y-4 pb-32">
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold text-ink">Inventaire</h1>
          <p className="text-ink/55 text-xs">Session en cours · {counts.length} article(s) compté(s) · {ecarts.length} écart(s)</p>
        </div>
      </header>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <IconSearch className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-ink/45" />
          <input className="input pl-11" placeholder="Rechercher un article…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn-primary !px-4" onClick={() => setScanning(true)} aria-label="Scanner">
          <IconScan />
        </button>
      </div>

      {msg && <div className="glass p-3 text-center text-crystal-800 text-sm">{msg}</div>}

      {hits.length > 0 && (
        <div className="glass p-3 space-y-2">
          {hits.map((v) => (
            <button key={v.id} className="w-full flex items-center justify-between text-left py-1" onClick={() => addCount(v)}>
              <span className="text-sm text-ink">
                {v.products.name} <span className="text-ink/55">· {variantLabel(v)}</span>
              </span>
              <span className="chip">attendu {v.stock}</span>
            </button>
          ))}
        </div>
      )}

      <section className="glass p-4">
        <h2 className="section-title mb-3">Comptage</h2>
        {counts.length === 0 ? (
          <p className="text-ink/55 text-sm">Scannez chaque article (le compteur s&apos;incrémente à chaque scan) ou recherchez-le.</p>
        ) : (
          <ul className="space-y-3">
            {counts.map((c) => {
              const v = c.product_variants!;
              const diff = c.counted_qty - c.expected_qty;
              return (
                <li key={c.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{(v as any).products?.name}</p>
                    <p className="text-xs text-ink/55">
                      {variantLabel(v)} · attendu {c.expected_qty}
                      {diff !== 0 && (
                        <span className={diff > 0 ? 'text-emerald-600' : 'text-rose-600'}> · écart {diff > 0 ? '+' : ''}{diff}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button className="btn-glass !p-0 w-8 h-8 !rounded-xl" onClick={() => updateCount(c, c.counted_qty - 1)}>−</button>
                    <span className="w-8 text-center font-bold text-ink">{c.counted_qty}</span>
                    <button className="btn-glass !p-0 w-8 h-8 !rounded-xl" onClick={() => updateCount(c, c.counted_qty + 1)}>+</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {counts.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-30">
          <button className="btn-primary w-full py-4" onClick={closeSession} disabled={busy}>
            Clôturer &amp; appliquer les écarts
          </button>
        </div>
      )}

      {scanning && <Scanner onDetected={onScan} onClose={() => setScanning(false)} />}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtQty, startOfDay } from '@/lib/utils';
import { IconPlus, IconUsers } from '@/components/Icons';
import type { Vendor } from '@/lib/types';

type VendorRow = Vendor & { pieces: number; stockAchat: number; caMois: number; nbVentes: number; du: number };

function startOfMonth() {
  const d = startOfDay();
  d.setDate(1);
  return d;
}

export default function VendeursPage() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const sb = supabase();
    const monthStart = startOfMonth().toISOString();
    const [{ data: vendors }, { data: stock }, { data: sales }, { data: payments }, { data: allocs }] = await Promise.all([
      sb.from('vendors').select('*').eq('active', true).order('name'),
      sb.from('vendor_stock').select('vendor_id,qty,product_variants(products(purchase_price))'),
      sb.from('sales').select('vendor_id,total,created_at').not('vendor_id', 'is', null).is('canceled_at', null),
      sb.from('vendor_payments').select('vendor_id,amount'),
      sb.from('allocations').select('vendor_id,due_amount').eq('direction', 'sortie').neq('due_type', 'ventes').not('due_amount', 'is', null),
    ]);

    const pieces: Record<string, number> = {};
    const stockAchat: Record<string, number> = {};
    (stock || []).forEach((s: any) => {
      pieces[s.vendor_id] = (pieces[s.vendor_id] || 0) + s.qty;
      stockAchat[s.vendor_id] =
        (stockAchat[s.vendor_id] || 0) + s.qty * Number(s.product_variants?.products?.purchase_price || 0);
    });
    const ca: Record<string, number> = {};
    const nb: Record<string, number> = {};
    const ventesTotal: Record<string, number> = {};
    const forfaits: Record<string, number> = {};
    (sales || []).forEach((s: any) => {
      ventesTotal[s.vendor_id] = (ventesTotal[s.vendor_id] || 0) + Number(s.total);
      if (s.created_at >= monthStart) {
        ca[s.vendor_id] = (ca[s.vendor_id] || 0) + Number(s.total);
        nb[s.vendor_id] = (nb[s.vendor_id] || 0) + 1;
      }
    });
    (allocs || []).forEach((a: any) => (forfaits[a.vendor_id] = (forfaits[a.vendor_id] || 0) + Number(a.due_amount)));
    // Mode forfait dès qu'un lot a un reversement convenu, sinon au réel des ventes
    const du: Record<string, number> = {};
    ((vendors as any) || []).forEach((v: Vendor) => {
      du[v.id] = forfaits[v.id] != null ? forfaits[v.id] : ventesTotal[v.id] || 0;
    });
    (payments || []).forEach((p: any) => (du[p.vendor_id] = (du[p.vendor_id] || 0) - Number(p.amount)));

    setRows(
      ((vendors as any) || []).map((v: Vendor) => ({
        ...v,
        pieces: pieces[v.id] || 0,
        stockAchat: stockAchat[v.id] || 0,
        caMois: ca[v.id] || 0,
        nbVentes: nb[v.id] || 0,
        du: Math.max(0, du[v.id] || 0),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addVendor() {
    if (!name.trim()) return;
    await supabase().from('vendors').insert({ name: name.trim(), phone: phone.trim() || null });
    setName('');
    setPhone('');
    setAdding(false);
    load();
  }

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold text-ink">Revendeurs</h1>
        <button className="btn-primary !py-2 !px-3 text-sm" onClick={() => setAdding(!adding)}>
          <IconPlus className="w-4 h-4" /> Revendeur
        </button>
      </header>

      {adding && (
        <div className="glass-strong p-4 space-y-3">
          <input className="input" placeholder="Nom du revendeur *" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <button className="btn-primary w-full" onClick={addVendor}>Créer le revendeur</button>
        </div>
      )}

      {loading ? (
        <div className="glass p-8 text-center text-ink/55 animate-pulse">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="glass-strong p-8 text-center space-y-3">
          <IconUsers className="w-10 h-10 mx-auto text-crystal-500" />
          <p className="text-ink/70">
            Créez vos revendeurs, remettez-leur des lots de marchandise, et suivez qui détient quoi et qui vend quoi.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((v) => (
            <Link key={v.id} href={`/vendeurs/${v.id}`} className="glass flex items-center gap-4 p-4 transition active:scale-[0.98]">
              <span
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                style={{ background: 'linear-gradient(135deg,#60b8fa,#257ceb)' }}
              >
                {v.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink truncate">{v.name}</p>
                <p className="text-ink/55 text-xs">
                  {fmtQty(v.pieces)} pièce{v.pieces > 1 ? 's' : ''} en stock · {v.nbVentes} vente{v.nbVentes > 1 ? 's' : ''} ce mois
                  {v.caMois > 0 && <> · CA {fmt(v.caMois)}</>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-crystal-700">{fmt(v.stockAchat)}</p>
                <p className="text-ink/45 text-[10px] -mt-0.5">stock (valeur d&apos;achat)</p>
                {v.du > 0 && <span className="chip chip-warn !text-[10px]">doit {fmt(v.du)}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDate } from '@/lib/utils';
import { IconBack } from '@/components/Icons';
import type { Sale } from '@/lib/types';

export default function VentesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase()
      .from('sales')
      .select('*, vendors(name), customers(name), sale_items(*)')
      .order('created_at', { ascending: false })
      .limit(50);
    setSales((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelSale(s: Sale) {
    if (
      !confirm(
        `Annuler la vente #${s.number} (${fmt(Number(s.total))}) ?\nLa marchandise sera remise dans le stock ${s.vendors?.name ? `de ${s.vendors.name}` : 'du dépôt'}.`
      )
    )
      return;
    setBusy(true);
    const { error } = await supabase().rpc('cancel_sale', { p_sale_id: s.id });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setSelected(null);
    load();
  }

  const methodLabel = (m: string) => (m === 'especes' ? 'Espèces' : m === 'carte' ? 'Carte' : 'Crédit');

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/plus" className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-ink flex-1">Journal des ventes</h1>
      </header>

      {loading ? (
        <div className="glass p-8 text-center text-ink/55 animate-pulse">Chargement…</div>
      ) : sales.length === 0 ? (
        <div className="glass p-8 text-center text-ink/55">Aucune vente.</div>
      ) : (
        <div className="glass p-2">
          {sales.map((s) => (
            <button key={s.id} className="w-full flex items-center justify-between p-3 text-left" onClick={() => setSelected(s)}>
              <div className="min-w-0">
                <p className={`text-sm font-medium ${s.canceled_at ? 'text-ink/40 line-through' : 'text-ink'}`}>
                  #{s.number} · {s.vendors?.name || 'Dépôt'}
                </p>
                <p className="text-ink/45 text-xs">
                  {fmtDate(s.created_at)} · {methodLabel(s.payment_method)}
                  {s.customers?.name ? ` · ${s.customers.name}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.canceled_at && <span className="chip chip-danger !text-[10px]">Annulée</span>}
                <span className={`font-semibold ${s.canceled_at ? 'text-ink/40 line-through' : 'text-ink'}`}>
                  {fmt(Number(s.total))}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Détail de vente */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setSelected(null)}>
          <div
            className="glass-strong w-full max-w-lg mx-auto rounded-b-none p-6 pb-10 space-y-4 max-h-[85dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-ink">Vente #{selected.number}</h3>
                <p className="text-ink/55 text-xs">
                  {fmtDate(selected.created_at)} · {selected.vendors?.name || 'Dépôt'} · {methodLabel(selected.payment_method)}
                </p>
              </div>
              <span className="text-xl font-bold text-crystal-700">{fmt(Number(selected.total))}</span>
            </div>

            <ul className="space-y-2">
              {(selected.sale_items || []).map((it) => (
                <li key={it.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">
                    {it.product_name}
                    {it.variant_label && <span className="text-ink/55"> · {it.variant_label}</span>}
                    <span className="text-ink/45"> × {it.qty}</span>
                  </span>
                  <span className="text-ink font-medium">{fmt(it.qty * Number(it.unit_price))}</span>
                </li>
              ))}
            </ul>

            {selected.canceled_at ? (
              <p className="text-center text-rose-600 text-sm font-medium">
                Vente annulée le {fmtDate(selected.canceled_at)} — marchandise remise en stock.
              </p>
            ) : (
              <button className="btn-danger w-full" onClick={() => cancelSale(selected)} disabled={busy}>
                {busy ? '…' : 'Annuler cette vente (remise en stock)'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

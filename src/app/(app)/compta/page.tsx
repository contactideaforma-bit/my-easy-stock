'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt } from '@/lib/utils';
import { downloadCSV, csvNumber } from '@/lib/csv';
import { IconBack, IconDownload } from '@/components/Icons';

type SaleRow = {
  id: string;
  number: number;
  created_at: string;
  total: number;
  discount: number;
  payment_method: string;
  vendors: { name: string } | null;
  customers: { name: string } | null;
  sale_items: { product_name: string; variant_label: string | null; qty: number; unit_price: number; purchase_price: number }[];
};

type PurchaseRow = {
  id: string;
  received_at: string;
  suppliers: { name: string } | null;
  purchase_items: { qty: number; unit_cost: number; product_variants: { size: string | null; color: string | null; products: { name: string } | null } | null }[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const frDate = (s: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(s));

export default function ComptaPage() {
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [vatRate, setVatRate] = useState(20);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    const sb = supabase();
    const fromISO = new Date(`${from}T00:00:00`).toISOString();
    const toISO = new Date(`${to}T23:59:59.999`).toISOString();

    const [{ data: s }, { data: p }, { data: cs }] = await Promise.all([
      sb
        .from('sales')
        .select('id,number,created_at,total,discount,payment_method,vendors(name),customers(name),sale_items(product_name,variant_label,qty,unit_price,purchase_price)')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .is('canceled_at', null)
        .order('created_at'),
      sb
        .from('purchases')
        .select('id,received_at,suppliers(name),purchase_items(qty,unit_cost,product_variants(size,color,products(name)))')
        .eq('status', 'recue')
        .gte('received_at', fromISO)
        .lte('received_at', toISO)
        .order('received_at'),
      sb.from('company_settings').select('vat_rate').eq('id', 1).maybeSingle(),
    ]);
    setSales((s as any) || []);
    setPurchases((p as any) || []);
    if (cs) setVatRate(Number(cs.vat_rate ?? 20));
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function preset(kind: 'mois' | 'mois-1' | 'trimestre' | 'annee') {
    const n = new Date();
    if (kind === 'mois') {
      setFrom(iso(new Date(n.getFullYear(), n.getMonth(), 1)));
      setTo(iso(n));
    } else if (kind === 'mois-1') {
      setFrom(iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)));
      setTo(iso(new Date(n.getFullYear(), n.getMonth(), 0)));
    } else if (kind === 'trimestre') {
      const q = Math.floor(n.getMonth() / 3) * 3;
      setFrom(iso(new Date(n.getFullYear(), q, 1)));
      setTo(iso(n));
    } else {
      setFrom(iso(new Date(n.getFullYear(), 0, 1)));
      setTo(iso(n));
    }
  }

  // ---- Agrégats période ----
  const ca = sales.reduce((s, r) => s + Number(r.total), 0);
  const remises = sales.reduce((s, r) => s + Number(r.discount || 0), 0);
  const cost = sales.reduce((s, r) => s + r.sale_items.reduce((x, it) => x + it.qty * Number(it.purchase_price), 0), 0);
  const marge = ca - cost;
  const achats = purchases.reduce((s, p) => s + p.purchase_items.reduce((x, it) => x + it.qty * Number(it.unit_cost), 0), 0);
  const rate = vatRate / 100;
  const caHT = ca / (1 + rate);
  const tva = ca - caHT;

  const periodLabel = `${from}_${to}`;
  const year = (d: string) => new Date(d).getFullYear();
  const invoiceNo = (r: SaleRow) => `FAC-${year(r.created_at)}-${String(r.number).padStart(5, '0')}`;
  const methodLabel = (m: string) => (m === 'especes' ? 'Espèces' : m === 'carte' ? 'Carte' : 'Crédit');

  // ---- Exports ----
  function exportRecapFactures() {
    const rows: (string | number)[][] = [
      ['N° facture', 'Date', 'Client / Revendeur', 'Paiement', 'Total HT', 'TVA', 'Remise', 'Total TTC'],
    ];
    for (const r of sales) {
      const ttc = Number(r.total);
      rows.push([
        invoiceNo(r),
        frDate(r.created_at),
        r.vendors?.name ? `Revendeur : ${r.vendors.name}` : r.customers?.name || 'Client de passage',
        methodLabel(r.payment_method),
        csvNumber(ttc / (1 + rate)),
        csvNumber(ttc - ttc / (1 + rate)),
        csvNumber(Number(r.discount || 0)),
        csvNumber(ttc),
      ]);
    }
    rows.push([]);
    rows.push(['TOTAL', '', '', '', csvNumber(caHT), csvNumber(tva), csvNumber(remises), csvNumber(ca)]);
    downloadCSV(`recap-factures-ventes-${periodLabel}`, rows);
  }

  function exportVentesDetail() {
    const rows: (string | number)[][] = [
      ['Date', 'N° facture', 'Client / Revendeur', 'Produit', 'Variante', 'Qté', 'PU TTC', 'Total ligne', 'Marge ligne'],
    ];
    for (const r of sales) {
      for (const it of r.sale_items) {
        rows.push([
          frDate(r.created_at),
          invoiceNo(r),
          r.vendors?.name || r.customers?.name || 'Client de passage',
          it.product_name,
          it.variant_label || '',
          it.qty,
          csvNumber(Number(it.unit_price)),
          csvNumber(it.qty * Number(it.unit_price)),
          csvNumber(it.qty * (Number(it.unit_price) - Number(it.purchase_price))),
        ]);
      }
    }
    downloadCSV(`ventes-detail-${periodLabel}`, rows);
  }

  function exportAchats() {
    const rows: (string | number)[][] = [
      ['Date réception', 'Fournisseur', 'Produit', 'Variante', 'Qté', 'Coût unitaire', 'Total'],
    ];
    for (const p of purchases) {
      for (const it of p.purchase_items) {
        const v = it.product_variants;
        rows.push([
          frDate(p.received_at),
          p.suppliers?.name || 'Sans fournisseur',
          v?.products?.name || '',
          [v?.size, v?.color].filter(Boolean).join(' · '),
          it.qty,
          csvNumber(Number(it.unit_cost)),
          csvNumber(it.qty * Number(it.unit_cost)),
        ]);
      }
    }
    rows.push([]);
    rows.push(['TOTAL', '', '', '', '', '', csvNumber(achats)]);
    downloadCSV(`achats-fournisseurs-${periodLabel}`, rows);
  }

  return (
    <div className="space-y-4 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/plus" className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-ink flex-1">Comptabilité</h1>
      </header>

      {/* Période */}
      <section className="glass p-4 space-y-3">
        <h2 className="section-title">Période</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-ink/55 text-xs pl-1">Du</label>
            <input className="input !py-2.5" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-ink/55 text-xs pl-1">Au</label>
            <input className="input !py-2.5" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {([
            ['mois', 'Ce mois'],
            ['mois-1', 'Mois dernier'],
            ['trimestre', 'Trimestre'],
            ['annee', 'Année'],
          ] as const).map(([k, label]) => (
            <button key={k} className="chip shrink-0 active:scale-95" onClick={() => preset(k)}>{label}</button>
          ))}
        </div>
      </section>

      {/* Récapitulatif */}
      {loading ? (
        <div className="glass p-8 text-center text-ink/55 animate-pulse">Chargement…</div>
      ) : (
        <>
          <section className="glass-strong p-4">
            <h2 className="section-title mb-3">Récapitulatif à transmettre</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-ink/60">Ventes TTC ({sales.length})</span>
              <span className="text-right font-bold text-ink">{fmt(ca)}</span>
              <span className="text-ink/60">dont remises accordées</span>
              <span className="text-right text-ink">{fmt(remises)}</span>
              <span className="text-ink/60">Ventes HT</span>
              <span className="text-right text-ink">{fmt(caHT)}</span>
              <span className="text-ink/60">TVA collectée ({vatRate} %)</span>
              <span className="text-right text-ink">{fmt(tva)}</span>
              <span className="text-ink/60">Marge brute</span>
              <span className="text-right font-semibold text-emerald-600">{fmt(marge)}</span>
              <span className="text-ink/60">Achats reçus ({purchases.length})</span>
              <span className="text-right text-ink">{fmt(achats)}</span>
            </div>
            {vatRate === 0 && (
              <p className="text-ink/45 text-xs mt-3">TVA non applicable, art. 293 B du CGI (franchise en base).</p>
            )}
          </section>

          <section className="glass p-4 space-y-2">
            <h2 className="section-title mb-1">Exports pour le comptable (Excel)</h2>
            <button className="btn-glass w-full !py-3 !justify-start" onClick={exportRecapFactures} disabled={sales.length === 0}>
              <IconDownload /> Récap des factures de vente ({sales.length})
            </button>
            <button className="btn-glass w-full !py-3 !justify-start" onClick={exportVentesDetail} disabled={sales.length === 0}>
              <IconDownload /> Ventes détaillées, ligne par article
            </button>
            <button className="btn-glass w-full !py-3 !justify-start" onClick={exportAchats} disabled={purchases.length === 0}>
              <IconDownload /> Achats fournisseurs reçus ({purchases.length})
            </button>
            <p className="text-ink/45 text-xs pt-1">
              Fichiers CSV ouvrables directement dans Excel (accents et décimales au format français). Les ventes annulées sont exclues.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

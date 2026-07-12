'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDay, fmtQty } from '@/lib/utils';
import { IconBack } from '@/components/Icons';
import type { Sale } from '@/lib/types';

type Company = {
  name: string;
  legal_form: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  vat_number: string | null;
  vat_rate: number;
  invoice_footer: string | null;
  logo_url: string | null;
  invoice_color: string | null;
};

/**
 * Facture groupée : plusieurs ventes fusionnées sur un seul document.
 * Ouvert depuis le Journal des ventes (mode « Fusionner »).
 */
function FactureGroupee() {
  const params = useSearchParams();
  const ids = (params.get('ids') || '').split(',').filter(Boolean);
  const [sales, setSales] = useState<Sale[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    const sb = supabase();
    Promise.all([
      sb
        .from('sales')
        .select('*, vendors(name), customers(name, first_name, address, phone, email), sale_items(*)')
        .in('id', ids)
        .is('canceled_at', null)
        .order('created_at'),
      sb.from('company_settings').select('*').maybeSingle(),
    ]).then(([{ data: s }, { data: c }]) => {
      setSales((s as any) || []);
      setCompany((c as any) || null);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  if (loading) return <div className="glass p-8 text-center text-ink/55 animate-pulse mt-4">Chargement…</div>;
  if (sales.length === 0)
    return (
      <div className="glass p-8 text-center text-ink/55 mt-4">
        Aucune vente valide à regrouper. <Link href="/ventes" className="text-crystal-700 underline">Retour au journal</Link>
      </div>
    );

  const rate = Number(company?.vat_rate ?? 20) / 100;
  const totalTTC = sales.reduce((s, x) => s + Number(x.total), 0);
  const remises = sales.reduce((s, x) => s + Number(x.discount || 0), 0);
  const totalHT = totalTTC / (1 + rate);
  const totalTVA = totalTTC - totalHT;
  const pieces = sales.reduce((s, x) => s + (x.sale_items || []).reduce((y, it) => y + it.qty, 0), 0);
  const color = company?.invoice_color || '#257ceb';
  const numeros = sales.map((s) => `#${s.number}`).join(', ');
  const num = `FAC-G-${new Date().getFullYear()}-${sales.map((s) => s.number).join('.')}`;

  // Client / revendeur affiché : seulement s'il est le même sur toutes les ventes
  const custNames = Array.from(new Set(sales.map((s: any) => s.customers?.name || null)));
  const vendNames = Array.from(new Set(sales.map((s: any) => s.vendors?.name || null)));
  const cust = custNames.length === 1 ? (sales[0] as any).customers : null;
  const vend = vendNames.length === 1 ? (sales[0] as any).vendors : null;

  return (
    <div className="space-y-4 pb-8">
      <header className="no-print flex items-center gap-3 pt-2">
        <Link href="/ventes" className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-ink flex-1">Facture groupée ({sales.length} ventes)</h1>
        <button className="btn-primary !py-2 !px-4 text-sm" onClick={() => window.print()}>
          Imprimer / PDF
        </button>
      </header>

      <div className="bg-white rounded-3xl p-6 text-[#1c2733] print:rounded-none print:p-0">
        <div className="flex items-start justify-between gap-4 border-b-4 pb-4" style={{ borderColor: color }}>
          <div>
            {company?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt="" className="h-12 mb-2 object-contain" />
            )}
            <p className="font-bold text-lg" style={{ color }}>{company?.name || 'Ma Société'}</p>
            {company?.legal_form && <p className="text-xs text-gray-500">{company.legal_form}</p>}
            {company?.address && <p className="text-xs text-gray-500 whitespace-pre-line">{company.address}</p>}
            <p className="text-xs text-gray-500">{[company?.phone, company?.email].filter(Boolean).join(' · ')}</p>
            {company?.siret && <p className="text-xs text-gray-500">SIRET {company.siret}{company?.vat_number ? ` · TVA ${company.vat_number}` : ''}</p>}
          </div>
          <div className="text-right">
            <h2 className="font-bold text-xl">FACTURE</h2>
            <p className="font-semibold">{num}</p>
            <p className="text-sm text-gray-500">Date : {fmtDay(new Date())}</p>
            <p className="text-xs text-gray-500">Regroupe les ventes {numeros}</p>
          </div>
        </div>

        {(cust || vend) && (
          <div className="mt-4 rounded-xl border border-gray-200 p-3 inline-block min-w-[45%]">
            <p className="text-xs text-gray-500">Facturé à :</p>
            <p className="font-bold">{cust ? [cust.first_name, cust.name].filter(Boolean).join(' ') : vend?.name}</p>
            {cust?.address && <p className="text-sm text-gray-500">{cust.address}</p>}
            {(cust?.phone || cust?.email) && <p className="text-sm text-gray-500">{[cust.phone, cust.email].filter(Boolean).join(' · ')}</p>}
          </div>
        )}

        <table className="w-full mt-5 text-sm">
          <thead>
            <tr className="text-white" style={{ background: color }}>
              <th className="text-left px-3 py-2 rounded-l-lg">Vente</th>
              <th className="text-left px-3 py-2">Article</th>
              <th className="text-right px-3 py-2">Qté</th>
              <th className="text-right px-3 py-2">PU TTC</th>
              <th className="text-right px-3 py-2 rounded-r-lg">Total</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s, si) =>
              (s.sale_items || []).map((it, ii) => (
                <tr key={it.id} className={(si + ii) % 2 ? '' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    #{s.number} <span className="text-gray-400">· {fmtDay(s.created_at)}</span>
                  </td>
                  <td className="px-3 py-2">
                    {it.product_name}
                    {it.variant_label && <span className="text-gray-500"> · {it.variant_label}</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{fmtQty(it.qty)}</td>
                  <td className="px-3 py-2 text-right">{fmt(Number(it.unit_price))}</td>
                  <td className="px-3 py-2 text-right">{fmt(it.qty * Number(it.unit_price))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Nombre de pièces</span>
              <span className="font-semibold">{fmtQty(pieces)}</span>
            </div>
            {remises > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Remises déjà déduites</span>
                <span className="font-semibold">−{fmt(remises)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Total HT</span>
              <span className="font-semibold">{fmt(totalHT)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">TVA {Math.round(rate * 100)} %</span>
              <span className="font-semibold">{fmt(totalTVA)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1">
              <span className="text-gray-700 font-semibold">Total TTC</span>
              <span className="font-bold text-lg" style={{ color }}>{fmt(totalTTC)}</span>
            </div>
          </div>
        </div>

        {company?.invoice_footer && <p className="mt-6 text-xs text-gray-400">{company.invoice_footer}</p>}
      </div>
    </div>
  );
}

export default function FactureGroupeePage() {
  return (
    <Suspense fallback={<div className="glass p-8 text-center text-ink/55 animate-pulse mt-4">Chargement…</div>}>
      <FactureGroupee />
    </Suspense>
  );
}

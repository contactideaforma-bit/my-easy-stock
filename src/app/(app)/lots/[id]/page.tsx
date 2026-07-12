'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDay, fmtQty, variantLabel } from '@/lib/utils';
import { IconBack } from '@/components/Icons';
import type { Allocation, VendorPayment } from '@/lib/types';

type Company = {
  name: string;
  legal_form: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  vat_number: string | null;
  invoice_footer: string | null;
  logo_url: string | null;
  invoice_color: string | null;
};

/**
 * Document imprimable d'un lot remis en dépôt à un revendeur :
 * détail des pièces aux prix convenus, reversement attendu, échéance,
 * reversements déjà encaissés sur ce lot, reste dû.
 */
export default function LotDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const [alloc, setAlloc] = useState<Allocation | null>(null);
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [company, setCompany] = useState<Company | null>(null);

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data: a }, { data: pay }, { data: c }] = await Promise.all([
      sb
        .from('allocations')
        .select('*, vendors(name, phone), allocation_items(*, product_variants(size, color, sku, products(name, sale_price)))')
        .eq('id', id)
        .single(),
      sb.from('vendor_payments').select('*').eq('allocation_id', id).order('created_at'),
      sb.from('company_settings').select('*').maybeSingle(),
    ]);
    setAlloc(a as any);
    setPayments((pay as any) || []);
    setCompany((c as any) || null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!alloc) return <div className="glass p-8 text-center text-ink/55 animate-pulse mt-4">Chargement…</div>;

  const items = alloc.allocation_items || [];
  const linePrice = (it: any) => Number(it.agreed_price ?? it.product_variants?.products?.sale_price ?? 0);
  const pieces = items.reduce((s, it) => s + it.qty, 0);
  const valeur = items.reduce((s, it) => s + it.qty * linePrice(it), 0);
  const du =
    alloc.due_type === 'ventes' || alloc.due_amount == null ? null : Number(alloc.due_amount);
  const paye = payments.reduce((s, p) => s + Number(p.amount), 0);
  const reste = du != null ? Math.max(0, du - paye) : null;
  const color = company?.invoice_color || '#257ceb';
  const year = new Date(alloc.created_at).getFullYear();
  const num = `LOT-${year}-${alloc.id.slice(0, 6).toUpperCase()}`;
  const overdue = alloc.due_date && (reste == null || reste > 0) && new Date(alloc.due_date) < new Date();

  return (
    <div className="space-y-4 pb-8">
      <header className="no-print flex items-center gap-3 pt-2">
        <Link href={`/vendeurs/${alloc.vendor_id}`} className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-ink flex-1">Lot {num}</h1>
        <button className="btn-primary !py-2 !px-4 text-sm" onClick={() => window.print()}>
          Imprimer / PDF
        </button>
      </header>

      {/* Document */}
      <div className="bg-white rounded-3xl p-6 text-[#1c2733] print:rounded-none print:p-0" id="document">
        <div className="flex items-start justify-between gap-4 border-b-4 pb-4" style={{ borderColor: color }}>
          <div>
            {company?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo_url} alt="" className="h-12 mb-2 object-contain" />
            )}
            <p className="font-bold text-lg" style={{ color }}>{company?.name || 'Ma Société'}</p>
            {company?.legal_form && <p className="text-xs text-gray-500">{company.legal_form}</p>}
            {company?.address && <p className="text-xs text-gray-500 whitespace-pre-line">{company.address}</p>}
            <p className="text-xs text-gray-500">
              {[company?.phone, company?.email].filter(Boolean).join(' · ')}
            </p>
            {company?.siret && <p className="text-xs text-gray-500">SIRET {company.siret}</p>}
          </div>
          <div className="text-right">
            <h2 className="font-bold text-xl">BON DE REMISE EN DÉPÔT</h2>
            <p className="font-semibold">{num}</p>
            <p className="text-sm text-gray-500">Date : {fmtDay(alloc.created_at)}</p>
            {alloc.due_date && (
              <p className={`text-sm font-semibold ${overdue ? 'text-rose-600' : 'text-gray-600'}`}>
                Reversement attendu le {fmtDay(alloc.due_date)}{overdue ? ' — EN RETARD' : ''}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 p-3 inline-block min-w-[45%]">
          <p className="text-xs text-gray-500">Marchandise confiée à :</p>
          <p className="font-bold">{alloc.vendors?.name}</p>
          {alloc.vendors?.phone && <p className="text-sm text-gray-500">{alloc.vendors.phone}</p>}
        </div>

        <table className="w-full mt-5 text-sm">
          <thead>
            <tr className="text-white" style={{ background: color }}>
              <th className="text-left px-3 py-2 rounded-l-lg">Article</th>
              <th className="text-left px-3 py-2">Déclinaison</th>
              <th className="text-right px-3 py-2">Qté</th>
              <th className="text-right px-3 py-2">Prix convenu</th>
              <th className="text-right px-3 py-2 rounded-r-lg">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: any, i) => (
              <tr key={it.id} className={i % 2 ? '' : 'bg-gray-50'}>
                <td className="px-3 py-2">{it.product_variants?.products?.name}</td>
                <td className="px-3 py-2 text-gray-500">{it.product_variants ? variantLabel(it.product_variants) : ''}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmtQty(it.qty)}</td>
                <td className="px-3 py-2 text-right">{fmt(linePrice(it))}</td>
                <td className="px-3 py-2 text-right">{fmt(it.qty * linePrice(it))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Nombre de pièces</span>
              <span className="font-semibold">{fmtQty(pieces)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Valeur du lot (prix convenus)</span>
              <span className="font-semibold">{fmt(valeur)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1">
              <span className="text-gray-600 font-medium">Reversement convenu</span>
              <span className="font-bold" style={{ color }}>
                {alloc.due_type === 'ventes' || du == null
                  ? 'Au réel des ventes'
                  : `${fmt(du)}${alloc.due_type === 'pourcentage' && alloc.due_rate ? ` (${alloc.due_rate} % du lot)` : ''}`}
              </span>
            </div>
            {paye > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Déjà reversé sur ce lot</span>
                <span className="font-semibold text-emerald-600">{fmt(paye)}</span>
              </div>
            )}
            {reste != null && (
              <div className="flex justify-between border-t border-gray-200 pt-1">
                <span className="text-gray-600 font-medium">Reste dû</span>
                <span className={`font-bold ${reste > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {reste > 0 ? fmt(reste) : 'Soldé'}
                </span>
              </div>
            )}
          </div>
        </div>

        {payments.length > 0 && (
          <div className="mt-4 text-xs text-gray-500">
            Reversements encaissés : {payments.map((p) => `${fmt(Number(p.amount))} le ${fmtDay(p.created_at)}`).join(' · ')}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400">
          Marchandise remise en dépôt-vente : elle reste la propriété de {company?.name || 'la société'} jusqu&apos;à
          son reversement intégral. {company?.invoice_footer || ''}
        </p>
      </div>
    </div>
  );
}

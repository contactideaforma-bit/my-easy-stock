'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { fmt, fmtDay } from '@/lib/utils';
import { IconBack } from '@/components/Icons';
import { customerLabel } from '@/lib/types';
import type { Customer, Sale } from '@/lib/types';

type Company = {
  name: string;
  legal_form: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  siret: string | null;
  vat_number: string | null;
  vat_rate: number;
  iban: string | null;
  bic: string | null;
  invoice_footer: string | null;
  logo_url: string | null;
  invoice_color: string | null;
  invoice_theme: 'classique' | 'moderne' | 'minimal' | null;
};

export default function FacturePage() {
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const load = useCallback(async () => {
    const sb = supabase();
    const [{ data: s }, { data: c }, { data: cl }] = await Promise.all([
      sb.from('sales').select('*, customers(name, first_name, phone, email, address), vendors(name), sale_items(*)').eq('id', id).single(),
      sb.from('company_settings').select('*').maybeSingle(),
      sb.from('customers').select('*').order('name'),
    ]);
    setSale(s as any);
    setCompany((c as any) || null);
    setCustomers((cl as any) || []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function attachCustomer(customerId: string) {
    if (!customerId) return;
    await supabase().from('sales').update({ customer_id: customerId }).eq('id', id);
    load();
  }

  if (!sale) return <div className="glass p-8 text-center text-ink/55 animate-pulse mt-4">Chargement…</div>;

  const rate = Number(company?.vat_rate ?? 20) / 100;
  const totalTTC = Number(sale.total);
  const remise = Number(sale.discount || 0);
  const sousTotal = totalTTC + remise;
  const totalHT = totalTTC / (1 + rate);
  const totalTVA = totalTTC - totalHT;
  const year = new Date(sale.created_at).getFullYear();
  const invoiceNumber = `FAC-${year}-${String(sale.number).padStart(5, '0')}`;
  const methodLabel = sale.payment_method === 'especes' ? 'Espèces' : sale.payment_method === 'carte' ? 'Carte bancaire' : 'Crédit';
  const color = company?.invoice_color || '#257ceb';
  const theme = company?.invoice_theme || 'classique';
  const cust = sale.customers as (Customer & { email?: string | null; address?: string | null }) | null;

  return (
    <div className="space-y-4 pb-8">
      <header className="no-print flex items-center gap-3 pt-2">
        <Link href="/ventes" className="btn-glass !p-2"><IconBack /></Link>
        <h1 className="text-xl font-bold text-ink flex-1">Facture {invoiceNumber}</h1>
        <button className="btn-primary !py-2 !px-4 text-sm" onClick={() => window.print()}>
          Imprimer / PDF
        </button>
      </header>

      {!company?.siret && (
        <p className="no-print text-orange-700/90 text-xs px-1">
          Complétez votre <Link href="/societe" className="underline font-medium">profil société</Link> (SIRET, adresse, TVA) pour une facture conforme.
        </p>
      )}

      {!sale.customer_id && (
        <div className="no-print glass p-3 flex items-center gap-2">
          <span className="text-ink/60 text-sm shrink-0">Client :</span>
          <select className="input !py-2 flex-1" defaultValue="" onChange={(e) => attachCustomer(e.target.value)}>
            <option value="" className="text-black">Client de passage (sans nom)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id} className="text-black">{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ------- Document facture ------- */}
      <div className="bg-white text-black rounded-2xl p-6 shadow-lg print:shadow-none print:rounded-none print:p-0">
        {/* En-tête (selon le thème choisi) */}
        <div
          className={`flex justify-between items-start pb-4 ${theme === 'classique' ? 'border-b-2' : ''} ${theme === 'minimal' ? 'border-b border-gray-200' : ''} ${theme === 'moderne' ? 'rounded-xl p-4 -mx-1' : ''}`}
          style={theme === 'classique' ? { borderColor: color } : theme === 'moderne' ? { background: color } : undefined}
        >
          <div className="flex items-start gap-3">
            {company?.logo_url && (
              <div className={`w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center shrink-0 ${theme === 'moderne' ? 'bg-white' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain" />
              </div>
            )}
            <div className={theme === 'moderne' ? 'text-white' : ''}>
              <p className="text-xl font-extrabold" style={theme === 'moderne' ? undefined : { color: theme === 'minimal' ? '#111827' : color }}>
                {company?.name || 'Ma Société'}
              </p>
              {company?.legal_form && <p className={`text-xs ${theme === 'moderne' ? 'text-white/80' : 'text-gray-600'}`}>{company.legal_form}</p>}
              {company?.address && <p className={`text-xs whitespace-pre-line mt-1 ${theme === 'moderne' ? 'text-white/80' : 'text-gray-600'}`}>{company.address}</p>}
              <p className={`text-xs mt-1 ${theme === 'moderne' ? 'text-white/80' : 'text-gray-600'}`}>
                {[company?.phone, company?.email].filter(Boolean).join(' · ')}
              </p>
              {company?.siret && <p className={`text-xs ${theme === 'moderne' ? 'text-white/80' : 'text-gray-600'}`}>SIRET : {company.siret}</p>}
              {company?.vat_number && <p className={`text-xs ${theme === 'moderne' ? 'text-white/80' : 'text-gray-600'}`}>TVA : {company.vat_number}</p>}
            </div>
          </div>
          <div className={`text-right ${theme === 'moderne' ? 'text-white' : ''}`}>
            <p className="text-lg font-bold uppercase tracking-wide">Facture</p>
            <p className="text-sm font-semibold">{invoiceNumber}</p>
            <p className={`text-xs mt-1 ${theme === 'moderne' ? 'text-white/80' : 'text-gray-600'}`}>Date : {fmtDay(sale.created_at)}</p>
            {sale.vendors?.name && <p className={`text-xs ${theme === 'moderne' ? 'text-white/80' : 'text-gray-600'}`}>Vendeur : {sale.vendors.name}</p>}
          </div>
        </div>

        {/* Client */}
        <div className="py-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Facturé à</p>
          <p className="font-semibold text-sm">{cust ? customerLabel(cust) : 'Client de passage'}</p>
          {cust?.address && <p className="text-xs text-gray-600 whitespace-pre-line">{cust.address}</p>}
          {(cust?.phone || cust?.email) && (
            <p className="text-xs text-gray-600">{[cust?.phone, cust?.email].filter(Boolean).join(' · ')}</p>
          )}
        </div>

        {/* Lignes */}
        <table className="w-full text-sm">
          <thead>
            <tr
              className={`text-xs uppercase ${theme === 'moderne' ? '' : 'text-gray-500 border-b border-gray-200'}`}
              style={theme === 'moderne' ? { background: `${color}18`, color } : undefined}
            >
              <th className="text-left py-2 font-medium">Désignation</th>
              <th className="text-center py-2 font-medium">Qté</th>
              <th className="text-right py-2 font-medium">PU HT</th>
              <th className="text-right py-2 font-medium">Total HT</th>
            </tr>
          </thead>
          <tbody>
            {(sale.sale_items || []).map((it) => {
              const puHT = Number(it.unit_price) / (1 + rate);
              return (
                <tr key={it.id} className="border-b border-gray-100">
                  <td className="py-2">
                    {it.product_name}
                    {it.variant_label && <span className="text-gray-500"> — {it.variant_label}</span>}
                  </td>
                  <td className="text-center py-2">{it.qty}</td>
                  <td className="text-right py-2">{fmt(puHT)}</td>
                  <td className="text-right py-2">{fmt(it.qty * puHT)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totaux */}
        <div className="flex justify-end pt-4">
          <div className="w-56 space-y-1 text-sm">
            {remise > 0 && (
              <>
                <div className="flex justify-between"><span className="text-gray-600">Sous-total TTC</span><span>{fmt(sousTotal)}</span></div>
                <div className="flex justify-between" style={{ color: '#c74815' }}>
                  <span>Remise</span><span>−{fmt(remise)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between"><span className="text-gray-600">Total HT</span><span>{fmt(totalHT)}</span></div>
            <div className="flex justify-between">
              <span className="text-gray-600">TVA {rate > 0 ? `(${(rate * 100).toFixed(rate * 100 % 1 ? 1 : 0)} %)` : ''}</span>
              <span>{fmt(totalTVA)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-300">
              <span>Total TTC</span><span style={{ color }}>{fmt(totalTTC)}</span>
            </div>
          </div>
        </div>

        {/* Paiement */}
        <div className="pt-5 text-xs text-gray-600 space-y-1">
          <p>Mode de règlement : {methodLabel}{sale.payment_method !== 'credit' ? ' — payée' : ''}</p>
          {company?.iban && <p>IBAN : {company.iban}{company.bic ? ` · BIC : ${company.bic}` : ''}</p>}
          {rate === 0 && <p>TVA non applicable, art. 293 B du CGI.</p>}
          {company?.invoice_footer && <p className="whitespace-pre-line pt-1">{company.invoice_footer}</p>}
          <p className="pt-2 text-gray-400">
            En cas de retard de paiement, indemnité forfaitaire pour frais de recouvrement : 40 €. Pas d&apos;escompte pour paiement anticipé.
          </p>
        </div>
      </div>
    </div>
  );
}

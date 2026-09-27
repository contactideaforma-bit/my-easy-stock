import { notFound } from 'next/navigation';
import { adminClient } from '@/lib/server';
import { eur, frDate, invoiceBalance, todayISO } from '@/lib/utils';
import type { Cabinet, Client, Invoice } from '@/lib/types';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Facture', robots: { index: false } };

// Page publique d'une facture (lien envoyé au client dans les emails et SMS)
export default async function PublicInvoice({ params }: { params: { token: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) notFound();
  const sb = adminClient();
  const { data: inv } = await sb.from('mya_invoices').select('*').eq('public_token', params.token).neq('status', 'brouillon').maybeSingle();
  if (!inv) notFound();
  const [{ data: cab }, { data: client }] = await Promise.all([
    sb.from('mya_cabinets').select('*').eq('id', inv.cabinet_id).single(),
    sb.from('mya_clients').select('*').eq('id', inv.client_id).single(),
  ]);
  const i = inv as Invoice; const c = cab as Cabinet; const cl = client as Client;
  const balance = invoiceBalance(i);
  const late = i.status === 'envoyee' && i.due_date < todayISO();

  return (
    <main className="min-h-dvh bg-paper py-6 px-4 print:p-0 print:bg-white">
      <div className="mx-auto max-w-3xl">
        {i.status === 'envoyee' && balance > 0 && (
          <div className="no-print mb-4 border-2 border-ink rounded-2xl bg-white p-4 sm:p-5 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-ink-soft">{late ? 'Échéance dépassée — merci de régulariser' : `À régler avant le ${frDate(i.due_date)}`}</p>
              <p className="font-display text-3xl">{eur(balance)}</p>
              {c.iban && <p className="text-sm mt-1">Virement : <b className="font-mono">{c.iban}</b>{c.bic ? ` · BIC ${c.bic}` : ''} · référence <b>{i.number}</b></p>}
            </div>
            <div className="flex flex-col gap-2">
              {i.payment_link && <a href={i.payment_link} target="_blank" rel="noreferrer" className="btn-primary">Payer en ligne</a>}
              <PrintButton />
            </div>
          </div>
        )}
        {(i.status !== 'envoyee' || balance <= 0) && <div className="no-print mb-4 flex justify-end"><PrintButton /></div>}

        <article className="bg-white border border-paper-line rounded-2xl p-6 sm:p-10 print:border-0 print:rounded-none print:p-0 text-[13px] text-ink relative">
          {i.status === 'payee' && <span className="absolute top-8 right-8 rotate-[-8deg] border-2 border-sage-600 text-sage-700 font-bold px-3 py-1 rounded-lg text-lg">PAYÉE</span>}
          {i.status === 'annulee' && <span className="absolute top-8 right-8 rotate-[-8deg] border-2 border-clay-600 text-clay-700 font-bold px-3 py-1 rounded-lg text-lg">ANNULÉE</span>}
          <header className="flex flex-wrap justify-between gap-6">
            <div>
              {c.logo_url ? <img src={c.logo_url} alt="" className="h-14 mb-3 object-contain" /> : <p className="font-display text-2xl mb-2">{c.name}</p>}
              <p className="font-semibold">{c.legal_name || c.name}</p>
              {c.address && <p className="whitespace-pre-line text-ink-soft">{c.address}</p>}
              <p className="text-ink-soft">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
              {c.siret && <p className="text-ink-soft">SIRET {c.siret}</p>}
              {c.vat_number && <p className="text-ink-soft">TVA {c.vat_number}</p>}
            </div>
            <div className="text-right">
              <p className="font-display text-3xl">Facture</p>
              <p className="font-semibold">N° {i.number}</p>
              <p className="text-ink-soft">Date : {frDate(i.issue_date)}</p>
              <p className="text-ink-soft">Échéance : {frDate(i.due_date)}</p>
            </div>
          </header>

          <section className="mt-8 ml-auto w-full sm:w-1/2 border border-ink rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-mute">Facturé à</p>
            <p className="font-semibold">{cl.name}</p>
            {cl.contact_name && <p>{cl.contact_name}</p>}
            {cl.address && <p className="whitespace-pre-line text-ink-soft">{cl.address}</p>}
            {cl.siren && <p className="text-ink-soft">SIREN {cl.siren}</p>}
          </section>

          <p className="mt-8 font-semibold">{i.label}</p>
          <table className="w-full mt-3">
            <thead><tr className="border-b-2 border-ink text-left text-[11px] uppercase tracking-wide">
              <th className="py-2">Désignation</th><th className="py-2 text-right w-16">Qté</th><th className="py-2 text-right w-28">PU HT</th><th className="py-2 text-right w-28">Total HT</th>
            </tr></thead>
            <tbody>
              {i.lines.map((l, k) => (
                <tr key={k} className="border-b border-paper-line">
                  <td className="py-2.5">{l.label}</td><td className="py-2.5 text-right">{l.qty}</td>
                  <td className="py-2.5 text-right">{eur(l.unit_price)}</td><td className="py-2.5 text-right">{eur(l.qty * l.unit_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 ml-auto w-full sm:w-72 space-y-1">
            <div className="flex justify-between"><span>Total HT</span><span>{eur(i.amount_ht)}</span></div>
            <div className="flex justify-between"><span>TVA {i.vat_rate} %</span><span>{eur(i.amount_ttc - i.amount_ht)}</span></div>
            <div className="flex justify-between font-bold text-base border-t-2 border-ink pt-2"><span>Total TTC</span><span>{eur(i.amount_ttc)}</span></div>
            {Number(i.paid_amount) > 0 && <div className="flex justify-between text-sage-700"><span>Déjà réglé</span><span>− {eur(i.paid_amount)}</span></div>}
            {Number(i.paid_amount) > 0 && <div className="flex justify-between font-bold"><span>Reste à payer</span><span>{eur(balance)}</span></div>}
          </div>

          {c.iban && (
            <section className="mt-8 border border-ink rounded-xl p-4">
              <p className="font-semibold">Règlement par virement</p>
              <p>IBAN : <span className="font-mono">{c.iban}</span>{c.bic && <> · BIC : <span className="font-mono">{c.bic}</span></>}</p>
              <p>Référence à indiquer : {i.number}</p>
            </section>
          )}
          {i.notes && <p className="mt-6 whitespace-pre-line">{i.notes}</p>}
          {c.invoice_footer && <p className="mt-8 text-[11px] text-ink-mute">{c.invoice_footer}</p>}
        </article>
      </div>
    </main>
  );
}

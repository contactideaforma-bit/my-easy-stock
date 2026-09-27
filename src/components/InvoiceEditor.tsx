'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, supabase } from '@/lib/supabase';
import { useCabinet } from './Cabinet';
import { ClientSelect, Field } from './Bits';
import { IconPlus, IconX } from './Icons';
import { addDays, computeTotals, eur, todayISO } from '@/lib/utils';
import type { Invoice, InvoiceLine } from '@/lib/types';

export default function InvoiceEditor({ initial, clientId }: { initial?: Invoice; clientId?: string | null }) {
  const router = useRouter();
  const { cabinet, bump } = useCabinet();
  const [client, setClient] = useState<string | null>(initial?.client_id ?? clientId ?? null);
  const [label, setLabel] = useState(initial?.label ?? 'Honoraires');
  const [issue, setIssue] = useState(initial?.issue_date ?? todayISO());
  const [due, setDue] = useState(initial?.due_date ?? addDays(todayISO(), cabinet.payment_terms_days));
  const [vat, setVat] = useState<number>(initial?.vat_rate ?? cabinet.default_vat_rate);
  const [lines, setLines] = useState<InvoiceLine[]>(initial?.lines?.length ? initial.lines : [{ label: '', qty: 1, unit_price: 0 }]);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [payLink, setPayLink] = useState(initial?.payment_link ?? '');
  const [sms, setSms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Pré-remplissage avec les honoraires habituels du client
  useEffect(() => {
    if (initial || !client) return;
    supabase().from('mya_clients').select('fee_amount,fee_label,fee_frequency,preferred_channel').eq('id', client).single().then(({ data }) => {
      if (!data) return;
      setSms(data.preferred_channel === 'sms');
      if (data.fee_amount && lines.length === 1 && !lines[0].label) {
        setLines([{ label: data.fee_label || `Honoraires ${data.fee_frequency !== 'ponctuel' ? data.fee_frequency : ''}`.trim(), qty: 1, unit_price: Number(data.fee_amount) }]);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  const t = computeTotals(lines, vat);
  const setLine = (i: number, k: keyof InvoiceLine, v: string) =>
    setLines((s) => s.map((l, j) => (j === i ? { ...l, [k]: k === 'label' ? v : Number(v) } : l)));

  async function save(send: boolean) {
    if (!client) return setErr('Choisissez un client.');
    if (t.ttc <= 0) return setErr('Le montant doit être supérieur à 0.');
    setBusy(true); setErr(null);
    const row = {
      cabinet_id: cabinet.id, client_id: client, label, issue_date: issue, due_date: due, vat_rate: vat,
      lines: lines.filter((l) => l.label || l.unit_price), amount_ht: t.ht, amount_ttc: t.ttc,
      notes: notes || null, payment_link: payLink || null,
    };
    const res = initial
      ? await supabase().from('mya_invoices').update(row).eq('id', initial.id).select('id').single()
      : await supabase().from('mya_invoices').insert({ ...row, status: 'brouillon' }).select('id').single();
    if (res.error) { setBusy(false); return setErr(res.error.message); }
    const id = res.data.id as string;
    if (send) {
      try {
        await api('/api/invoices/send', { invoiceId: id, channels: sms ? ['email', 'sms'] : ['email'] });
      } catch (e: any) {
        setBusy(false); bump();
        setErr(`Facture validée mais l'envoi a échoué : ${e.message}`);
        return router.push(`/factures/${id}`);
      }
    }
    bump();
    router.push(`/factures/${id}`);
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="card-pad space-y-3">
          <Field label="Client *"><ClientSelect value={client} onChange={setClient} placeholder="Choisir un client…" /></Field>
          <Field label="Objet"><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date d'émission"><input type="date" className="input" value={issue} onChange={(e) => { setIssue(e.target.value); setDue(addDays(e.target.value, cabinet.payment_terms_days)); }} /></Field>
            <Field label="Échéance"><input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
        </div>

        <div className="card-pad space-y-3">
          <h2 className="h2">Prestations</h2>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end">
              <Field label={i === 0 ? 'Désignation' : ''} className="col-span-12 sm:col-span-7"><input className="input" value={l.label} onChange={(e) => setLine(i, 'label', e.target.value)} placeholder="Tenue comptable — septembre" /></Field>
              <Field label={i === 0 ? 'Qté' : ''} className="col-span-3 sm:col-span-1"><input type="number" step="0.5" className="input px-2" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} /></Field>
              <Field label={i === 0 ? 'Prix HT' : ''} className="col-span-6 sm:col-span-3"><input type="number" step="0.01" className="input" value={l.unit_price} onChange={(e) => setLine(i, 'unit_price', e.target.value)} /></Field>
              <button type="button" onClick={() => setLines((s) => s.filter((_, j) => j !== i))} disabled={lines.length === 1} className="col-span-3 sm:col-span-1 btn-ghost px-2 py-2.5" aria-label="Retirer"><IconX className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" className="btn-soft btn-sm" onClick={() => setLines((s) => [...s, { label: '', qty: 1, unit_price: 0 }])}><IconPlus className="w-4 h-4" />Ajouter une ligne</button>
        </div>

        <div className="card-pad space-y-3">
          <Field label="Lien de paiement en ligne (facultatif)"><input className="input" value={payLink} onChange={(e) => setPayLink(e.target.value)} placeholder="https://… (Qonto, Stripe, SumUp…)" /></Field>
          <Field label="Mention sur la facture"><textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card-pad space-y-2 lg:sticky lg:top-6">
          <div className="flex justify-between text-sm"><span className="text-ink-mute">Total HT</span><span>{eur(t.ht)}</span></div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-ink-mute flex items-center gap-1">TVA
              <select className="input w-auto py-1 px-2 text-xs" value={vat} onChange={(e) => setVat(Number(e.target.value))}>
                <option value={20}>20 %</option><option value={10}>10 %</option><option value={0}>0 %</option>
              </select></span>
            <span>{eur(t.tva)}</span>
          </div>
          <div className="flex justify-between font-display text-2xl pt-2 border-t border-paper-line"><span>Total</span><span>{eur(t.ttc)}</span></div>

          <label className="flex items-center gap-2 text-sm pt-3">
            <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} className="accent-sage-600 w-4 h-4" />Prévenir aussi par SMS
          </label>
          {err && <p className="text-sm text-clay-700 bg-clay-50 rounded-lg px-3 py-2">{err}</p>}
          <button className="btn-primary w-full" disabled={busy} onClick={() => save(true)}>{busy ? '…' : 'Valider et envoyer'}</button>
          <button className="btn-ghost w-full" disabled={busy} onClick={() => save(false)}>Enregistrer en brouillon</button>
          <p className="text-[11px] text-ink-mute pt-1">À la validation, la facture reçoit son numéro définitif et entre dans le circuit de relances automatiques.</p>
        </div>
      </div>
    </div>
  );
}

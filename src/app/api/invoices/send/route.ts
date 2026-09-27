import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/server';
import { sendInvoiceMessage, type Channel } from '@/lib/reminders';
import { INVOICE_BODY, INVOICE_SUBJECT } from '@/lib/messages';
import type { Cabinet, Client, Invoice } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Valide un brouillon (numéro définitif) puis l'envoie au client. */
export async function POST(req: Request) {
  const ctx = await userFromRequest(req);
  if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { invoiceId, channels } = (await req.json()) as { invoiceId: string; channels?: Channel[] };

  const { sb } = ctx;
  const { data: inv } = await sb.from('mya_invoices').select('*').eq('id', invoiceId).single();
  if (!inv) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
  const [{ data: cab }, { data: client }] = await Promise.all([
    sb.from('mya_cabinets').select('*').eq('id', inv.cabinet_id).single(),
    sb.from('mya_clients').select('*').eq('id', inv.client_id).single(),
  ]);

  let invoice = inv as Invoice;
  if (invoice.status === 'brouillon') {
    const { data: number, error } = await sb.rpc('mya_next_invoice_number', { cab: inv.cabinet_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const { data: upd, error: e2 } = await sb.from('mya_invoices')
      .update({ number, status: 'envoyee', sent_at: new Date().toISOString() })
      .eq('id', invoiceId).select('*').single();
    if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });
    invoice = upd as Invoice;
  } else if (invoice.status !== 'envoyee') {
    return NextResponse.json({ error: 'Cette facture ne peut plus être envoyée' }, { status: 400 });
  }

  const r = await sendInvoiceMessage({
    sb, cab: cab as Cabinet, inv: invoice, client: client as Client,
    channels: channels?.length ? channels : ['email'],
    subject: INVOICE_SUBJECT, body: INVOICE_BODY, kind: 'envoi_facture', automatic: false, userId: ctx.user.id,
  });
  return NextResponse.json({ number: invoice.number, results: r.results });
}

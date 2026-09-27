import { NextResponse } from 'next/server';
import { userFromRequest } from '@/lib/server';
import { sendInvoiceMessage, type Channel } from '@/lib/reminders';
import type { Cabinet, Client, Invoice } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Relance manuelle (bouton « Relancer maintenant »). */
export async function POST(req: Request) {
  const ctx = await userFromRequest(req);
  if (!ctx) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const b = (await req.json()) as { invoiceId: string; channel: Channel; subject: string; body: string; smsBody?: string; step?: number | null };
  const { sb } = ctx;
  const { data: inv } = await sb.from('mya_invoices').select('*').eq('id', b.invoiceId).single();
  if (!inv) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 });
  const [{ data: cab }, { data: client }] = await Promise.all([
    sb.from('mya_cabinets').select('*').eq('id', inv.cabinet_id).single(),
    sb.from('mya_clients').select('*').eq('id', inv.client_id).single(),
  ]);
  const r = await sendInvoiceMessage({
    sb, cab: cab as Cabinet, inv: inv as Invoice, client: client as Client, channels: [b.channel],
    subject: b.subject, body: b.body, smsBody: b.smsBody, step: b.step ?? null,
    kind: 'relance', automatic: false, userId: ctx.user.id,
  });
  if (r.results.some((x) => x.ok)) {
    // Une relance manuelle compte comme l'étape correspondante : l'automate ne la renverra pas
    const level = Math.max(inv.reminder_level, b.step ?? inv.reminder_level);
    await sb.from('mya_invoices').update({ reminder_level: level, last_reminder_at: new Date().toISOString() }).eq('id', inv.id);
  }
  return NextResponse.json({ results: r.results });
}

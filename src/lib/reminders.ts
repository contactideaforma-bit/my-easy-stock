// Moteur de relances : utilisé par la tâche quotidienne ET par les boutons « Relancer maintenant ».
import type { SupabaseClient } from '@supabase/supabase-js';
import { appUrl, sendEmail, sendSms } from './server';
import { invoiceVars as baseVars, smsText as baseSms } from './messages';
import { fillTemplate, intlPhone } from './utils';
import type { Cabinet, Client, Invoice } from './types';

export const invoiceVars = (inv: Invoice, client: Partial<Client>, cab: Cabinet) => baseVars(inv, client, cab, appUrl());
export const smsText = (inv: Invoice, client: Partial<Client>, cab: Cabinet, tone: string) => baseSms(inv, client, cab, tone, appUrl());


export type Channel = 'email' | 'sms' | 'whatsapp';

interface SendArgs {
  sb: SupabaseClient;
  cab: Cabinet;
  inv: Invoice;
  client: Partial<Client>;
  channels: Channel[];
  subject: string;
  body: string;
  /** Texte SMS personnalisé (sinon version courte automatique). */
  smsBody?: string | null;
  tone?: string;
  step?: number | null;
  kind: 'envoi_facture' | 'relance';
  automatic: boolean;
  userId?: string | null;
}

/** Envoie un message sur plusieurs canaux et trace chaque tentative dans le journal. */
export async function sendInvoiceMessage(a: SendArgs) {
  const vars = invoiceVars(a.inv, a.client, a.cab);
  const subject = fillTemplate(a.subject, vars);
  const body = fillTemplate(a.body, vars);
  const results: { channel: Channel; ok: boolean; error?: string; link?: string }[] = [];

  for (const ch of a.channels) {
    let ok = false;
    let error: string | undefined;
    let recipient: string | null = null;
    let message = body;
    let status: 'envoye' | 'echec' | 'prepare' = 'echec';

    if (ch === 'email') {
      recipient = a.client.email || null;
      if (!recipient) error = 'Pas d’email pour ce client';
      else {
        const r = await sendEmail({ to: recipient, subject, text: body, replyTo: a.cab.email, fromName: a.cab.name });
        ok = r.ok;
        error = r.ok ? undefined : r.error;
      }
      status = ok ? 'envoye' : 'echec';
    } else if (ch === 'sms') {
      recipient = intlPhone(a.client.phone);
      message = a.smsBody
        ? fillTemplate(a.smsBody, vars)
        : a.kind === 'envoi_facture'
          ? `${a.cab.name} : votre facture ${vars.numero} (${vars.montant}) est disponible : ${vars.lien}`
          : smsText(a.inv, a.client, a.cab, a.tone || 'courtois');
      if (!recipient) error = 'Pas de numéro de mobile valide';
      else {
        const r = await sendSms({ to: recipient, text: message, sender: a.cab.sms_sender || a.cab.name });
        ok = r.ok;
        error = r.ok ? undefined : r.error;
      }
      status = ok ? 'envoye' : 'echec';
    } else if (ch === 'whatsapp') {
      // WhatsApp : message préparé, envoyé d'un clic par la personne
      recipient = intlPhone(a.client.phone);
      message = body;
      ok = !!recipient;
      status = ok ? 'prepare' : 'echec';
      if (!ok) error = 'Pas de numéro de mobile valide';
    }

    await a.sb.from('mya_reminders_log').insert({
      cabinet_id: a.cab.id,
      invoice_id: a.inv.id,
      client_id: a.inv.client_id,
      kind: a.kind,
      step: a.step ?? null,
      channel: ch,
      status,
      recipient,
      subject: ch === 'email' ? subject : null,
      message,
      error: error ?? null,
      automatic: a.automatic,
      sent_by: a.userId ?? null,
    });
    results.push({ channel: ch, ok, error });
  }
  return { results, subject, body };
}

export { dueRule, nextRuleDate } from './schedule';

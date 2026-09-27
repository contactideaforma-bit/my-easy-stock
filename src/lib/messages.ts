// Construction des messages (pur : utilisable navigateur + serveur)
import { daysBetween, eur, fillTemplate, frDate, invoiceBalance, todayISO } from './utils';
import type { Cabinet, Client, Invoice } from './types';

export function invoiceVars(inv: Invoice, client: Partial<Client>, cab: Cabinet, baseUrl: string) {
  const retard = Math.max(0, daysBetween(inv.due_date, todayISO()));
  return {
    client: client.name,
    contact: client.contact_name || client.name,
    numero: inv.number || 'brouillon',
    montant: eur(inv.amount_ttc),
    reste: eur(invoiceBalance(inv)),
    echeance: frDate(inv.due_date, { day: 'numeric', month: 'long', year: 'numeric' }),
    jours_retard: retard,
    lien: `${baseUrl.replace(/\/$/, '')}/f/${inv.public_token}`,
    lien_paiement: paymentLink(inv, client, cab) ?? `${baseUrl.replace(/\/$/, '')}/f/${inv.public_token}`,
    iban: cab.iban || '(voir facture)',
    cabinet: cab.name,
    tel_cabinet: cab.phone || '',
    email_cabinet: cab.email || '',
  };
}

/** Version courte pour SMS (160-300 caractères). */
export function smsText(inv: Invoice, client: Partial<Client>, cab: Cabinet, tone: string, baseUrl: string) {
  const v = invoiceVars(inv, client, cab, baseUrl);
  const head = tone === 'mise_en_demeure' ? 'DERNIER RAPPEL' : tone === 'ferme' ? 'Relance' : 'Rappel';
  return `${cab.name} - ${head} : facture ${v.numero} (${v.reste}) échue le ${frDate(inv.due_date)}. Règlement : ${v.lien}${cab.phone ? ' Tél ' + cab.phone : ''}`;
}

export const INVOICE_SUBJECT = 'Votre facture {numero} — {cabinet}';
export const INVOICE_BODY =
  'Bonjour {contact},\n\nVeuillez trouver votre facture {numero} d\'un montant de {montant}, à régler avant le {echeance}.\n\nConsulter, télécharger et régler la facture : {lien}\nIBAN : {iban}\n\nMerci pour votre confiance,\n{cabinet}';

/**
 * Lien de paiement de la banque du cabinet.
 * - un lien saisi sur la facture est prioritaire ;
 * - sinon le modèle des Paramètres, qui peut contenir {montant} (120.50), {montant_centimes} (12050),
 *   {numero} et {client} pour pré-remplir la page de paiement de la banque.
 */
export function paymentLink(inv: Pick<Invoice, 'payment_link' | 'number' | 'amount_ttc' | 'paid_amount'>, client: Partial<Client>, cab: Pick<Cabinet, 'payment_link_template'>): string | null {
  if (inv.payment_link) return inv.payment_link;
  const tpl = cab.payment_link_template?.trim();
  if (!tpl) return null;
  const due = invoiceBalance(inv);
  return fillTemplate(tpl, {
    montant: due.toFixed(2),
    montant_centimes: Math.round(due * 100),
    numero: encodeURIComponent(inv.number ?? ''),
    client: encodeURIComponent(client.name ?? ''),
  });
}

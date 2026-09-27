// Utilitaires partagés (navigateur + serveur)

export const eur = (n: number | null | undefined) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n ?? 0));

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Date du jour au format AAAA-MM-JJ, en heure de Paris. */
export function todayISO(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(d);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours entre deux dates ISO (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00Z').getTime() - new Date(a + 'T12:00:00Z').getTime()) / 86400000);
}

export function frDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00Z') : new Date(iso);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...opts }).format(d);
}

export function frTime(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function relDay(iso: string | null): string {
  if (!iso) return '';
  const n = daysBetween(todayISO(), iso);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  if (n < 0) return `il y a ${-n} j`;
  if (n < 7) return frDate(iso, { weekday: 'long' });
  return frDate(iso, { day: 'numeric', month: 'short' });
}

/** Remplace les {variables} d'un modèle de message. */
export function fillTemplate(tpl: string, vars: Record<string, string | number | null | undefined>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])));
}

/** Numéro FR → format international sans « + » (33612345678). */
export function intlPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = phone.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  else if (p.startsWith('00')) p = p.slice(2);
  else if (p.startsWith('0') && p.length === 10) p = '33' + p.slice(1);
  return p.length >= 10 ? p : null;
}

export function whatsappLink(phone: string | null | undefined, text: string) {
  const p = intlPhone(phone);
  return p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : null;
}

export function invoiceBalance(inv: { amount_ttc: number; paid_amount: number }) {
  return round2(Number(inv.amount_ttc) - Number(inv.paid_amount));
}

export function isOverdue(inv: { status: string; due_date: string }) {
  return inv.status === 'envoyee' && inv.due_date < todayISO();
}

export function computeTotals(lines: { qty: number; unit_price: number }[], vatRate: number) {
  const ht = round2(lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0));
  const ttc = round2(ht * (1 + Number(vatRate || 0) / 100));
  return { ht, tva: round2(ttc - ht), ttc };
}

export const FREQ_MONTHS: Record<string, number> = { mensuel: 1, trimestriel: 3, annuel: 12 };

export const LABELS = {
  channel: { telephone: 'Téléphone', email: 'Email', whatsapp: 'WhatsApp', sms: 'SMS', visite: 'Visite', autre: 'Autre' } as Record<string, string>,
  priority: { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' } as Record<string, string>,
  requestStatus: { nouvelle: 'Nouvelle', en_cours: 'En cours', attente_client: 'Attente client', traitee: 'Traitée' } as Record<string, string>,
  taskStatus: { a_faire: 'À faire', en_cours: 'En cours', fait: 'Fait' } as Record<string, string>,
  category: { saisie: 'Saisie', tva: 'TVA', bilan: 'Bilan', social: 'Social / paie', juridique: 'Juridique', fiscal: 'Fiscal', admin: 'Administratif', relance: 'Relance', autre: 'Autre' } as Record<string, string>,
  recurrence: { aucune: 'Une seule fois', hebdo: 'Chaque semaine', mensuelle: 'Chaque mois', trimestrielle: 'Chaque trimestre', annuelle: 'Chaque année' } as Record<string, string>,
  apptKind: { cabinet: 'Au cabinet', visio: 'Visio', telephone: 'Téléphone', chez_client: 'Chez le client' } as Record<string, string>,
  invoiceStatus: { brouillon: 'Brouillon', envoyee: 'À encaisser', payee: 'Payée', annulee: 'Annulée' } as Record<string, string>,
  method: { virement: 'Virement', prelevement: 'Prélèvement', cheque: 'Chèque', especes: 'Espèces', carte: 'Carte', autre: 'Autre' } as Record<string, string>,
  kind: { societe: 'Société', entreprise_individuelle: 'Entreprise individuelle', particulier: 'Particulier', association: 'Association', sci: 'SCI' } as Record<string, string>,
  freq: { mensuel: 'Mensuel', trimestriel: 'Trimestriel', annuel: 'Annuel', ponctuel: 'Ponctuel' } as Record<string, string>,
  tone: { courtois: 'Courtois', ferme: 'Ferme', mise_en_demeure: 'Avant mise en demeure' } as Record<string, string>,
};

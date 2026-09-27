// Calcul du calendrier de relances (pur, utilisable côté navigateur)
import { daysBetween, todayISO } from './utils';
import type { Invoice, ReminderRule } from './types';

/** Quelle étape du scénario doit partir aujourd'hui pour cette facture ? */
export function dueRule(inv: Invoice, rules: ReminderRule[], today = todayISO()): ReminderRule | null {
  const offset = daysBetween(inv.due_date, today); // jours après échéance (négatif = avant)
  const eligible = rules
    .filter((r) => r.active && r.step > inv.reminder_level && offset >= r.offset_days)
    .sort((a, b) => b.step - a.step);
  // On n'envoie que l'étape la plus avancée atteinte (pas de rafale de messages en retard)
  return eligible[0] ?? null;
}

/** Prochaine relance prévue (pour l'affichage). */
export function nextRuleDate(inv: Invoice, rules: ReminderRule[]) {
  const next = rules.filter((r) => r.active && r.step > inv.reminder_level).sort((a, b) => a.step - b.step)[0];
  if (!next) return null;
  const d = new Date(inv.due_date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + next.offset_days);
  return { rule: next, date: d.toISOString().slice(0, 10) };
}

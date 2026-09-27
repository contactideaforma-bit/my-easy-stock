// Calendrier fiscal automatique : transforme la fiche d'un client en échéances (tâches).
// Dates « cibles cabinet » : volontairement un peu en avance sur les dates limites légales,
// qui varient selon le SIREN, la forme et le régime. À ajuster dans Paramètres (jour TVA).
import { addDays, addMonths, frDate } from './utils';
import type { Client } from './types';

export interface FiscalItem {
  fiscal_key: string;
  title: string;
  due_date: string;
  category: 'tva' | 'fiscal' | 'bilan' | 'juridique';
  priority: 'normale' | 'haute';
  notes?: string;
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const pad = (n: number) => String(n).padStart(2, '0');
const d = (y: number, m: number, day: number) => `${y}-${pad(m)}-${pad(day)}`; // m : 1-12

const SOCIETES = /\b(SARL|EURL|SAS|SASU|SA|SNC|SCI|SELARL|SELAS|SCP|SCM)\b/i;

export function isCompany(c: Pick<Client, 'kind' | 'legal_form'>) {
  return c.kind === 'societe' || c.kind === 'sci' || SOCIETES.test(c.legal_form ?? '');
}

export function isIS(c: Pick<Client, 'tax_regime' | 'kind' | 'legal_form'>) {
  const r = (c.tax_regime ?? '').toUpperCase();
  if (/\bIS\b/.test(r)) return true;
  if (/\bIR\b|MICRO|BNC|BIC/.test(r)) return false;
  // Par défaut : SARL / SAS… à l'IS, SCI et EURL à l'IR
  return c.kind === 'societe' && !/\b(SCI|EURL)\b/i.test(c.legal_form ?? '');
}

/** Toutes les échéances d'un client entre `from` et `from + horizonDays` (dates ISO). */
export function fiscalCalendar(
  c: Pick<Client, 'kind' | 'legal_form' | 'tax_regime' | 'vat_regime' | 'fiscal_year_end'>,
  from: string,
  horizonDays: number,
  vatDay = 15,
): FiscalItem[] {
  const to = addDays(from, horizonDays);
  const y0 = Number(from.slice(0, 4));
  const out: FiscalItem[] = [];
  const push = (it: FiscalItem) => { if (it.due_date >= from && it.due_date <= to) out.push(it); };

  const [cm, cd] = (c.fiscal_year_end || '12-31').split('-').map(Number);
  const calendarYear = cm === 12 && cd === 31;
  const company = isCompany(c);
  const is = isIS(c);
  const particulier = c.kind === 'particulier';

  for (let y = y0 - 1; y <= y0 + 1; y++) {
    // ---------- TVA ----------
    if (c.vat_regime === 'mensuel') {
      for (let m = 1; m <= 12; m++) {
        const due = addMonths(d(y, m, vatDay), 1);
        push({ fiscal_key: `tva-${y}-${pad(m)}`, title: `TVA ${/^[aeiouéèà]/.test(MOIS[m - 1]) ? 'd’' : 'de '}${MOIS[m - 1]} ${y} (CA3)`, due_date: due, category: 'tva', priority: 'haute' });
      }
    }
    if (c.vat_regime === 'trimestriel') {
      for (let q = 1; q <= 4; q++) {
        const due = addMonths(d(y, q * 3, vatDay), 1);
        push({ fiscal_key: `tva-${y}-T${q}`, title: `TVA du ${q}${q === 1 ? 'er' : 'e'} trimestre ${y} (CA3)`, due_date: due, category: 'tva', priority: 'haute' });
      }
    }
    if (c.vat_regime === 'annuel') {
      push({ fiscal_key: `tva-ca12-${y}`, title: `Déclaration annuelle de TVA ${y} (CA12)`, due_date: calendarYear ? d(y + 1, 5, 3) : addMonths(d(y, cm, cd), 3), category: 'tva', priority: 'haute' });
      push({ fiscal_key: `tva-acompte1-${y}`, title: `Acompte de TVA de juillet ${y} (55 %)`, due_date: d(y, 7, 15), category: 'tva', priority: 'normale' });
      push({ fiscal_key: `tva-acompte2-${y}`, title: `Acompte de TVA de décembre ${y} (40 %)`, due_date: d(y, 12, 15), category: 'tva', priority: 'normale' });
    }

    if (particulier) {
      push({ fiscal_key: `ir-${y}`, title: `Déclaration de revenus ${y - 1}`, due_date: d(y, 5, 20), category: 'fiscal', priority: 'haute', notes: 'Date limite selon le département : vérifier le calendrier de l’année.' });
      continue;
    }

    // ---------- Clôture de l'exercice qui se termine en année y ----------
    const lastDay = new Date(Date.UTC(y, cm, 0)).getUTCDate();
    const closing = d(y, cm, Math.min(cd, lastDay));
    const label = calendarYear ? `${y}` : `clos le ${frDate(closing, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    push({ fiscal_key: `pieces-${y}`, title: `Demander les pièces de clôture (exercice ${label})`, due_date: addDays(closing, 7), category: 'bilan', priority: 'normale', notes: 'Relevés bancaires, factures, stocks, caisse, emprunts…' });
    push({
      fiscal_key: `liasse-${y}`,
      title: `Bilan et liasse fiscale — exercice ${label}`,
      due_date: calendarYear ? d(y + 1, 5, 15) : addDays(addMonths(closing, 3), 15),
      category: 'bilan', priority: 'haute',
    });

    if (is) {
      // Solde d'IS : le 15 du 4e mois suivant la clôture (15 mai pour une clôture au 31/12)
      const solde = calendarYear ? d(y + 1, 5, 15) : addMonths(d(y, cm, 15), 4);
      push({ fiscal_key: `is-solde-${y}`, title: `Solde de l'impôt sur les sociétés (exercice ${label})`, due_date: solde, category: 'fiscal', priority: 'haute' });
      // Acomptes d'IS : 15 mars, juin, septembre, décembre (exercice civil ; décalés sinon)
      const firstMonth = calendarYear ? 3 : ((cm + 2) % 12) + 1;
      for (let k = 0; k < 4; k++) {
        const due = addMonths(d(y, firstMonth, 15), k * 3);
        push({ fiscal_key: `is-acompte-${due.slice(0, 7)}`, title: `Acompte d'IS n°${k + 1}`, due_date: due, category: 'fiscal', priority: 'normale' });
      }
    }

    if (company) {
      push({ fiscal_key: `ag-${y}`, title: `Assemblée d'approbation des comptes (exercice ${label})`, due_date: addMonths(closing, 6), category: 'juridique', priority: 'normale' });
      if (!/\bSCI\b/i.test(c.legal_form ?? '') && c.kind !== 'sci') {
        push({ fiscal_key: `greffe-${y}`, title: `Dépôt des comptes au greffe (exercice ${label})`, due_date: addMonths(closing, 7), category: 'juridique', priority: 'normale' });
      }
    }

    // ---------- CFE ----------
    push({ fiscal_key: `cfe-${y}`, title: `CFE ${y} : vérifier l'avis et le paiement`, due_date: d(y, 12, 15), category: 'fiscal', priority: 'normale' });
  }

  return out.sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
}

/** Lignes prêtes à insérer dans mya_tasks (doublons ignorés grâce à fiscal_key). */
export function fiscalTaskRows(
  c: Pick<Client, 'id' | 'cabinet_id' | 'name' | 'owner_member' | 'kind' | 'legal_form' | 'tax_regime' | 'vat_regime' | 'fiscal_year_end'>,
  from: string, horizonDays: number, vatDay: number,
) {
  return fiscalCalendar(c, from, horizonDays, vatDay).map((it) => ({
    cabinet_id: c.cabinet_id, client_id: c.id, title: it.title, due_date: it.due_date, category: it.category,
    priority: it.priority, notes: it.notes ?? null, assigned_to: c.owner_member, fiscal_key: it.fiscal_key, recurrence: 'aucune',
  }));
}

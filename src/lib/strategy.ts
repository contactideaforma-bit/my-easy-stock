export type StrategyInputs = {
  goal: string;        // objectif principal
  audience: string;    // clients visés
  zone: string;        // zone géographique
  offer: string;       // offre / différenciation
  competitors: string; // concurrents connus
  horizon: string;     // 3, 6 ou 12 mois
};

export type Strategy = {
  positionnement: string;
  objectif: string;
  kpis: { nom: string; cible: string; delai: string }[];
  cibles: string[];
  piliers: {
    theme: string;
    intention: string;
    mots_cles: { kw: string; priorite: number; difficulte: string }[];
    page: { url: string | null; titre: string; statut: 'existante' | 'a_optimiser' | 'a_creer' };
  }[];
  quick_wins: string[];
  contenus: { titre: string; type: string; mot_cle: string; mois: number }[];
  local: string[];
  autorite: string[];
  risques: string[];
};

export const GOALS = [
  'Recevoir plus de demandes de devis / contacts',
  'Obtenir plus d’appels téléphoniques',
  'Obtenir des demandes de démonstration (logiciel)',
  'Vendre en ligne',
  'Remplir des sessions / inscriptions',
  'Attirer des clients en boutique (local)',
  'Gagner en notoriété',
];

export const PAGE_STATUS: Record<string, string> = { existante: 'Existante', a_optimiser: 'À optimiser', a_creer: 'À créer' };

/** Vrai si la stratégie contient des dates déjà passées (ex. « d'ici fin 2025 » générées sans date du jour). */
export function hasStaleDates(s: Strategy | null | undefined): boolean {
  if (!s) return false;
  const year = new Date().getFullYear();
  const texts = [s.objectif, ...(s.kpis || []).flatMap((k) => [k.cible, k.delai])].filter(Boolean) as string[];
  return texts.some((t) => (t.match(/\b(20\d{2})\b/g) || []).some((y) => Number(y) < year));
}

/** Libellé du mois réel d'un « Mois N » du calendrier éditorial, à partir de la date de création de la stratégie. */
export function monthLabel(createdAt: string, mois: number): string {
  const d = new Date(createdAt);
  d.setDate(1); d.setMonth(d.getMonth() + Math.max(0, (Number(mois) || 1) - 1));
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

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

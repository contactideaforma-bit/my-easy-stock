import type { Site } from './types';
import type { Task } from './tasks';
import { TASK_CATEGORIES } from './tasks';
import type { Strategy } from './strategy';

/** Prompt prêt à coller dans Claude pour réaliser UNE tâche du plan d'action. */
export function buildTaskPrompt(site: Site, t: Task, strategy?: Strategy | null): string {
  const L: string[] = [];
  L.push(`# Tâche SEO à réaliser — ${site.name}`);
  L.push('');
  L.push(`Tu es mon développeur web et consultant SEO. Site : **${site.url}**${site.notes ? ` (${site.notes})` : ''}.`);
  if (strategy) {
    L.push('');
    L.push(`Objectif de la stratégie : ${strategy.objectif}`);
    L.push(`Positionnement : ${strategy.positionnement}`);
    const pil = t.keyword ? strategy.piliers.find((p) => p.mots_cles.some((k) => k.kw.toLowerCase() === t.keyword!.toLowerCase())) : null;
    if (pil) L.push(`Pilier concerné : « ${pil.theme} » — mots-clés : ${pil.mots_cles.map((k) => k.kw).join(', ')}.`);
  }
  L.push('');
  L.push(`## La tâche : ${t.title}`);
  L.push(`Catégorie : ${TASK_CATEGORIES[t.category] || t.category}${t.target_url ? ` · Page : \`${t.target_url}\`` : ''}${t.keyword ? ` · Mot-clé visé : « ${t.keyword} »` : ''}`);
  if (t.detail) { L.push(''); L.push(t.detail); }
  L.push('');
  L.push('## Consignes');
  L.push('1. Trouve le code source du site (dossier connecté ou dépôt GitHub) et repère la technologie utilisée. Si tu n’as pas accès au code, dis-le-moi et donne-moi le contenu prêt à coller.');
  if (t.category === 'creation' || t.category === 'contenu') {
    L.push('2. Rédige un contenu original, utile et précis pour un client réel (pas de remplissage) : un H1 avec le mot-clé, des H2/H3 clairs, une FAQ si pertinent, des liens internes vers les pages de services et de contact, un appel à l’action visible.');
    L.push('3. Ajoute le title (≤ 60 car.), la meta description (120-155 car.) et les données structurées adaptées (JSON-LD). Ajoute la page au sitemap et au menu ou au maillage interne.');
  } else if (t.category === 'local' || t.category === 'autorite' || t.category === 'mesure') {
    L.push('2. Si la tâche se fait hors du code (Google Business Profile, annuaires, Search Console…), donne-moi un pas-à-pas précis avec les liens directs et les textes prêts à copier.');
  } else {
    L.push('2. Applique la correction sur toutes les pages concernées, sans changer le design.');
  }
  L.push(`${t.category === 'creation' || t.category === 'contenu' ? '4' : '3'}. N’invente aucune information (avis, chiffres, certifications, adresses). Garde le ton et la marque du site.`);
  L.push(`${t.category === 'creation' || t.category === 'contenu' ? '5' : '4'}. Vérifie que le site compile, fais un commit clair, puis résume ce qui a été fait et ce qui me reste à faire.`);
  return L.join('\n');
}

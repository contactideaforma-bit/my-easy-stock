import type { AuditRow, Site } from './types';
import { CATEGORY_LABEL, SEVERITY_LABEL } from './types';

const path = (u: string) => u.replace(/^https?:\/\/[^/]+/, '') || '/';

/** Construit un prompt complet à coller dans Claude pour corriger le site à partir de l'audit. */
export function buildFixPrompt(site: Site, a: AuditRow): string {
  const date = new Date(a.created_at).toLocaleDateString('fr-FR', { dateStyle: 'long' });
  const cats = Object.entries(a.summary?.categories || {}).map(([k, v]) => `${CATEGORY_LABEL[k as keyof typeof CATEGORY_LABEL] ?? k} ${v}/100`).join(' · ');
  const L: string[] = [];

  L.push(`# Corrections SEO à appliquer — ${site.name}`);
  L.push('');
  L.push(`Tu es mon développeur web et consultant SEO. Voici l'audit de mon site **${site.url}** réalisé le ${date} avec mon outil MyEasy SEO. Score global : **${a.score}/100** (${cats}). ${a.pages_crawled} pages analysées.`);
  if (site.notes) L.push(`\nActivité / contexte : ${site.notes}`);
  L.push('');
  L.push('## Ce que j\'attends de toi');
  L.push('1. Trouve le code source du site (dossier connecté ou dépôt GitHub). Identifie la technologie (Next.js, HTML, WordPress…) et où sont définis les titres, descriptions et contenus de chaque page. Si tu n\'as pas accès au code, demande-le-moi avant de commencer.');
  L.push('2. Corrige les problèmes ci-dessous **dans l\'ordre des priorités** (Bloquant → À corriger → Bonus).');
  L.push('3. Ne change pas le design ni la structure visuelle du site. Garde le ton et la marque existants. N\'invente pas de fausses informations (avis, chiffres, adresses, certifications).');
  L.push('4. Pour les titles et meta descriptions : un texte unique par page, title de 30 à 60 caractères, description de 120 à 155 caractères, avec le mot-clé principal de la page et un appel à l\'action. Montre-moi tes propositions sous forme de tableau avant de les appliquer si tu as un doute sur le positionnement.');
  L.push('5. Vérifie que le site compile (build) après tes modifications, puis fais un commit clair par groupe de corrections.');
  L.push('6. Termine par un récapitulatif : ce qui a été corrigé, ce qui reste à faire de mon côté (ex. Google Search Console, Google Business Profile), et ce que tu n\'as pas pu corriger et pourquoi.');
  L.push('');

  L.push('## Fondations du site');
  const c = a.site_checks;
  L.push(`- HTTPS : ${c.https ? 'OK' : '**absent**'}`);
  L.push(`- robots.txt : ${c.robots ? (c.robotsBlocksAll ? '**présent mais bloque tout le site**' : 'OK') : '**absent**'}`);
  L.push(`- Sitemap XML : ${c.sitemap ? `OK (${c.sitemap}, ${c.sitemapUrls} adresses)` : '**absent**'}`);
  L.push(`- Favicon : ${c.favicon ? 'OK' : '**absent**'}`);
  const p = a.performance;
  if (p && !p.error) L.push(`- Vitesse mobile (Google PageSpeed) : performance ${p.performance}/100, SEO ${p.seo}/100, accessibilité ${p.accessibility}/100 — LCP ${p.lcp}, CLS ${p.cls}, TBT ${p.tbt}`);
  L.push('');

  L.push('## Problèmes détectés');
  if (!a.issues.length) L.push('Aucun problème détecté.');
  a.issues.forEach((i, n) => {
    L.push(`### ${n + 1}. [${SEVERITY_LABEL[i.severity]}] ${i.title}${i.total > 1 ? ` — ${i.affected.length}/${i.total} pages` : ''}`);
    L.push(`Catégorie : ${CATEGORY_LABEL[i.category]}. Correction attendue : ${i.advice}`);
    if (i.total > 1 && i.affected.length) {
      const list = i.affected.slice(0, 25).map((u) => `- \`${u.replace(/^https?:\/\/[^/]+/, '') || '/'}\``);
      L.push(...list);
      if (i.affected.length > 25) L.push(`- … et ${i.affected.length - 25} autres`);
    }
    L.push('');
  });

  L.push('## État actuel de chaque page');
  L.push('| Page | Title (car.) | Meta description (car.) | H1 | Mots | Images sans alt |');
  L.push('|---|---|---|---|---|---|');
  for (const pg of a.pages) {
    if (pg.error || pg.status >= 400 || pg.status === 0) { L.push(`| \`${path(pg.url)}\` | ⚠ erreur ${pg.status || pg.error} | | | | |`); continue; }
    const t = pg.title ? `${pg.title.replace(/\|/g, '/')} (${pg.title.length})` : '**absent**';
    const d = pg.description ? `${pg.description.replace(/\|/g, '/').slice(0, 140)}${pg.description.length > 140 ? '…' : ''} (${pg.description.length})` : '**absente**';
    const h = pg.h1.length ? pg.h1.map((x) => x.replace(/\|/g, '/')).join(' / ') : '**aucun**';
    L.push(`| \`${path(pg.url)}\` | ${t} | ${d} | ${h} | ${pg.words} | ${pg.imagesNoAlt ? `${pg.imagesNoAlt}/${pg.images}` : '0'} |`);
  }
  L.push('');
  L.push('Une fois les corrections en ligne, je relancerai un audit dans MyEasy SEO pour vérifier la nouvelle note.');
  return L.join('\n');
}

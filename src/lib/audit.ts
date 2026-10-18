import { parsePage } from './html';
import { runPageSpeed } from './psi';
import type { AuditResult, Category, Issue, PageResult, Severity } from './types';

const UA = 'Mozilla/5.0 (compatible; MyEasySEO/1.0; +https://myeasydev-studio.fr)';
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|zip|rar|mp4|mp3|webm|mov|docx?|xlsx?|pptx?|css|js|json|xml|txt|woff2?|ttf)(\?|$)/i;

export function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  const url = new URL(u);
  url.hash = '';
  return url.toString();
}

const bareHost = (h: string) => h.replace(/^www\./i, '').toLowerCase();

async function fetchText(url: string, timeoutMs = 10_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'fr-FR,fr;q=0.9' }, redirect: 'follow', signal: ctrl.signal, cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    const text = /text|xml|html|json/i.test(type) || !type ? await res.text() : '';
    return { ok: res.ok, status: res.status, url: res.url || url, type, text, ms: Date.now() - start };
  } finally {
    clearTimeout(t);
  }
}

async function readSitemap(origin: string, robotsText: string): Promise<{ url: string | null; urls: string[] }> {
  const candidates = Array.from(robotsText.matchAll(/^\s*sitemap:\s*(\S+)/gim)).map((m) => m[1]);
  candidates.push(origin + '/sitemap.xml', origin + '/sitemap_index.xml', origin + '/wp-sitemap.xml');
  for (const c of Array.from(new Set(candidates))) {
    try {
      const r = await fetchText(c, 8000);
      if (!r.ok || !/<(urlset|sitemapindex)/i.test(r.text)) continue;
      let urls = Array.from(r.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1].replace(/&amp;/g, '&'));
      if (/<sitemapindex/i.test(r.text)) {
        const children = urls.slice(0, 3);
        urls = [];
        for (const ch of children) {
          try {
            const rr = await fetchText(ch, 8000);
            urls.push(...Array.from(rr.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1].replace(/&amp;/g, '&')));
          } catch {}
        }
      }
      return { url: c, urls };
    } catch {}
  }
  return { url: null, urls: [] };
}

export async function crawl(startInput: string, opts: { maxPages?: number; budgetMs?: number; withPerf?: boolean } = {}): Promise<AuditResult> {
  const maxPages = opts.maxPages ?? 30;
  const deadline = Date.now() + (opts.budgetMs ?? 38_000);
  const t0 = Date.now();
  const startUrl = normalizeUrl(startInput);
  const start = new URL(startUrl);
  const host = bareHost(start.host);

  const perfPromise = opts.withPerf === false ? Promise.resolve(null) : runPageSpeed(startUrl).catch((e) => ({ strategy: 'mobile' as const, performance: null, seo: null, accessibility: null, bestPractices: null, lcp: null, cls: null, tbt: null, fcp: null, error: String(e?.message || e) }));

  // Page d'accueil d'abord (pour connaître l'URL finale : https / www)
  const first = await fetchText(startUrl).catch((e) => ({ ok: false, status: 0, url: startUrl, type: '', text: '', ms: 0, err: String(e?.message || e) }) as any);
  const finalUrl = new URL(first.url || startUrl);
  const origin = finalUrl.origin;

  let robotsText = '';
  let robots = false;
  try {
    const r = await fetchText(origin + '/robots.txt', 6000);
    if (r.ok && !/<html/i.test(r.text)) { robots = true; robotsText = r.text; }
  } catch {}
  const robotsBlocksAll = /user-agent:\s*\*[\s\S]*?^\s*disallow:\s*\/\s*$/im.test(robotsText);
  const sitemap = await readSitemap(origin, robotsText);

  const pages: PageResult[] = [];
  const seen = new Set<string>();
  const queue: { url: string; depth: number }[] = [];
  const key = (u: string) => { const x = new URL(u); x.hash = ''; return bareHost(x.host) + x.pathname.replace(/\/$/, '') + x.search; };
  const push = (u: string, depth: number) => {
    try {
      const x = new URL(u, origin);
      if (!/^https?:$/.test(x.protocol) || bareHost(x.host) !== host || SKIP_EXT.test(x.pathname)) return;
      x.hash = '';
      const k = key(x.toString());
      if (seen.has(k)) return;
      seen.add(k);
      queue.push({ url: x.toString(), depth });
    } catch {}
  };

  const handle = (url: string, depth: number, r: { status: number; url: string; type: string; text: string; ms: number }) => {
    const isHtml = /html/i.test(r.type) || /<html/i.test(r.text.slice(0, 2000));
    if (!isHtml) {
      pages.push({ url, status: r.status, ms: r.ms, depth, title: null, description: null, h1: [], headings: [], words: 0, images: 0, imagesNoAlt: 0, canonical: null, robots: null, lang: null, viewport: false, og: false, schemaTypes: [], internalLinks: 0, externalLinks: 0, error: r.status >= 400 ? undefined : 'Contenu non HTML' });
      return;
    }
    const p = parsePage(r.text);
    let internal = 0, external = 0;
    for (const l of p.links) {
      if (/^(mailto|tel|javascript):|^#/i.test(l.href)) continue;
      try {
        const x = new URL(l.href, r.url);
        if (bareHost(x.host) === host) { internal++; push(x.toString(), depth + 1); } else external++;
      } catch {}
    }
    pages.push({ url, status: r.status, ms: r.ms, depth, title: p.title, description: p.description, h1: p.h1, headings: p.headings.slice(0, 40), words: p.words, images: p.images, imagesNoAlt: p.imagesNoAlt, canonical: p.canonical, robots: p.robots, lang: p.lang, viewport: p.viewport, og: !!(p.ogTitle && p.ogImage), schemaTypes: p.schemaTypes, internalLinks: internal, externalLinks: external });
  };

  seen.add(key(finalUrl.toString()));
  seen.add(key(startUrl));
  let favicon = false;
  if (first.status) {
    handle(finalUrl.toString(), 0, first);
    favicon = /<link[^>]+rel=["'][^"']*icon/i.test(first.text);
  } else {
    pages.push({ url: startUrl, status: 0, ms: 0, depth: 0, title: null, description: null, h1: [], headings: [], words: 0, images: 0, imagesNoAlt: 0, canonical: null, robots: null, lang: null, viewport: false, og: false, schemaTypes: [], internalLinks: 0, externalLinks: 0, error: first.err || 'Site injoignable' });
  }
  for (const u of sitemap.urls.slice(0, maxPages * 2)) push(u, 1);

  // Exploration en largeur, 6 requêtes en parallèle
  while (queue.length && pages.length < maxPages && Date.now() < deadline) {
    queue.sort((a, b) => a.depth - b.depth);
    const batch = queue.splice(0, Math.min(6, maxPages - pages.length));
    await Promise.all(batch.map(async ({ url, depth }) => {
      try {
        const r = await fetchText(url, Math.max(3000, Math.min(10_000, deadline - Date.now())));
        handle(url, depth, r);
      } catch (e: any) {
        pages.push({ url, status: 0, ms: 0, depth, title: null, description: null, h1: [], headings: [], words: 0, images: 0, imagesNoAlt: 0, canonical: null, robots: null, lang: null, viewport: false, og: false, schemaTypes: [], internalLinks: 0, externalLinks: 0, error: e?.name === 'AbortError' ? 'Délai dépassé' : String(e?.message || e) });
      }
    }));
  }

  const performance = await Promise.race([perfPromise, new Promise<null>((r) => setTimeout(() => r(null), Math.max(1000, deadline + 12_000 - Date.now())))]);

  const result = score({ pages, https: finalUrl.protocol === 'https:', robots, robotsBlocksAll, sitemap, favicon, performance });
  return {
    ...result,
    site_checks: { https: finalUrl.protocol === 'https:', robots, robotsBlocksAll, sitemap: sitemap.url, sitemapUrls: sitemap.urls.length, favicon },
    pages,
    performance,
    summary: { ...result.summary, durationMs: Date.now() - t0, startUrl: finalUrl.toString(), truncated: queue.length > 0 },
  } as AuditResult;
}

type ScoreInput = { pages: PageResult[]; https: boolean; robots: boolean; robotsBlocksAll: boolean; sitemap: { url: string | null }; favicon: boolean; performance: AuditResult['performance'] };

export function score(i: ScoreInput) {
  const html = i.pages.filter((p) => p.status >= 200 && p.status < 400 && !p.error);
  const n = Math.max(1, html.length);
  const issues: Issue[] = [];
  const add = (id: string, category: Category, severity: Severity, weight: number, title: string, advice: string, affected: string[], total = n) => issues.push({ id, category, severity, weight, title, advice, affected, total });

  // — Site
  add('https', 'technique', 'critical', 3, 'Le site n’est pas en HTTPS', 'Installer un certificat SSL (gratuit chez la plupart des hébergeurs) et rediriger tout le trafic http vers https.', i.https ? [] : ['Site'], 1);
  add('robots_block', 'technique', 'critical', 3, 'robots.txt bloque tout le site', 'Retirer la ligne « Disallow: / » du fichier robots.txt, sinon Google ne peut rien indexer.', i.robotsBlocksAll ? ['robots.txt'] : [], 1);
  add('robots', 'technique', 'warning', 1, 'Pas de fichier robots.txt', 'Créer un fichier robots.txt à la racine qui autorise l’exploration et indique l’adresse du sitemap.', i.robots ? [] : ['robots.txt'], 1);
  add('sitemap', 'technique', 'warning', 1.5, 'Pas de sitemap XML trouvé', 'Générer un sitemap.xml (Next.js : app/sitemap.ts ; WordPress : Yoast/RankMath) puis le déclarer dans Google Search Console.', i.sitemap.url ? [] : ['sitemap.xml'], 1);
  add('favicon', 'balises', 'info', 0.5, 'Pas de favicon', 'Ajouter une icône de site : elle s’affiche dans les résultats Google sur mobile.', i.favicon ? [] : ['Site'], 1);

  // — Pages
  const errors = i.pages.filter((p) => p.status >= 400 || p.status === 0);
  add('http_errors', 'technique', 'critical', 3, 'Pages en erreur ou injoignables', 'Corriger ou rediriger (301) ces adresses, et retirer les liens qui pointent vers elles.', errors.map((p) => `${p.url} (${p.status || p.error})`), Math.max(1, i.pages.length));
  add('noindex', 'technique', 'critical', 2, 'Pages exclues de Google (noindex)', 'Vérifier que ces pages doivent vraiment être masquées ; sinon retirer la balise meta robots « noindex ».', html.filter((p) => /noindex/i.test(p.robots || '')).map((p) => p.url));
  add('viewport', 'technique', 'critical', 2, 'Pas adapté au mobile (viewport manquant)', 'Ajouter <meta name="viewport" content="width=device-width, initial-scale=1"> dans le <head>.', html.filter((p) => !p.viewport).map((p) => p.url));
  add('lang', 'technique', 'warning', 0.8, 'Langue de la page non déclarée', 'Ajouter lang="fr" sur la balise <html>.', html.filter((p) => !p.lang).map((p) => p.url));
  add('canonical', 'technique', 'info', 0.8, 'Pas de balise canonical', 'Ajouter <link rel="canonical"> pour indiquer à Google l’adresse de référence de chaque page.', html.filter((p) => !p.canonical).map((p) => p.url));
  add('slow', 'technique', 'warning', 1, 'Pages lentes à répondre (> 1,5 s)', 'Mettre en cache, alléger les images, ou changer d’hébergement si le serveur est lent.', html.filter((p) => p.ms > 1500).map((p) => `${p.url} (${(p.ms / 1000).toFixed(1)} s)`));
  add('schema', 'technique', 'info', 0.6, 'Aucune donnée structurée (Schema.org)', 'Ajouter un JSON-LD adapté (LocalBusiness, Organization, Article, FAQ…) pour obtenir des résultats enrichis.', html.filter((p) => !p.schemaTypes.length).map((p) => p.url));

  add('title_missing', 'balises', 'critical', 3, 'Balise title absente', 'Chaque page doit avoir un titre unique de 30 à 60 caractères contenant son mot-clé principal.', html.filter((p) => !p.title).map((p) => p.url));
  add('title_length', 'balises', 'warning', 1.5, 'Title trop court ou trop long', 'Viser 30 à 60 caractères : au-delà, Google le coupe ; en dessous, il manque d’arguments.', html.filter((p) => p.title && (p.title.length < 30 || p.title.length > 65)).map((p) => `${p.url} (${p.title!.length} car.)`));
  add('title_dup', 'balises', 'warning', 1.5, 'Titles en double', 'Donner à chaque page un titre différent qui décrit son contenu précis.', dupes(html, (p) => p.title));
  add('desc_missing', 'balises', 'critical', 2.5, 'Meta description absente', 'Rédiger une description de 120 à 155 caractères qui donne envie de cliquer (bénéfice + appel à l’action).', html.filter((p) => !p.description).map((p) => p.url));
  add('desc_length', 'balises', 'warning', 1, 'Meta description trop courte ou trop longue', 'Viser 70 à 160 caractères.', html.filter((p) => p.description && (p.description.length < 70 || p.description.length > 160)).map((p) => `${p.url} (${p.description!.length} car.)`));
  add('desc_dup', 'balises', 'warning', 1, 'Meta descriptions en double', 'Écrire une description propre à chaque page.', dupes(html, (p) => p.description));
  add('img_alt', 'balises', 'warning', 1.5, 'Images sans texte alternatif', 'Décrire chaque image dans l’attribut alt (utile pour Google Images et l’accessibilité).', html.filter((p) => p.imagesNoAlt > 0).map((p) => `${p.url} (${p.imagesNoAlt}/${p.images})`));
  add('og', 'balises', 'info', 0.8, 'Aperçu réseaux sociaux incomplet (Open Graph)', 'Ajouter og:title et og:image pour un bel aperçu quand le lien est partagé (WhatsApp, Facebook, LinkedIn).', html.filter((p) => !p.og).map((p) => p.url));

  add('h1_missing', 'contenu', 'critical', 2.5, 'Pas de titre H1', 'Chaque page doit avoir un seul H1 qui annonce clairement le sujet (avec le mot-clé).', html.filter((p) => p.h1.length === 0).map((p) => p.url));
  add('h1_multi', 'contenu', 'warning', 1, 'Plusieurs H1 sur la même page', 'Garder un seul H1 et passer les autres en H2.', html.filter((p) => p.h1.length > 1).map((p) => `${p.url} (${p.h1.length} H1)`));
  add('thin', 'contenu', 'warning', 2, 'Contenu trop mince (< 300 mots)', 'Enrichir le texte : services détaillés, zone d’intervention, questions fréquentes, preuves (avis, réalisations).', html.filter((p) => p.words < 300).map((p) => `${p.url} (${p.words} mots)`));
  add('h_skip', 'contenu', 'info', 0.5, 'Hiérarchie des titres désordonnée', 'Respecter l’ordre H1 → H2 → H3 sans sauter de niveau.', html.filter((p) => p.headings.some((h, k) => k > 0 && h.level - p.headings[k - 1].level > 1)).map((p) => p.url));
  add('orphan', 'contenu', 'info', 0.6, 'Pages avec très peu de liens internes', 'Ajouter des liens vers les autres pages du site (services, contact) pour guider visiteurs et Google.', html.filter((p) => p.internalLinks < 3).map((p) => p.url));

  const cats: Category[] = ['technique', 'contenu', 'balises'];
  const categories: Partial<Record<Category, number>> = {};
  for (const c of cats) {
    const list = issues.filter((x) => x.category === c);
    const w = list.reduce((s, x) => s + x.weight, 0);
    const v = list.reduce((s, x) => s + x.weight * (1 - Math.min(1, x.affected.length / Math.max(1, x.total))), 0);
    categories[c] = Math.round((v / w) * 100);
  }
  if (i.performance?.performance != null) categories.performance = i.performance.performance;
  const weights: Record<Category, number> = { technique: 0.3, contenu: 0.25, balises: 0.3, performance: 0.15 };
  let tw = 0, tv = 0;
  for (const [c, v] of Object.entries(categories) as [Category, number][]) { tw += weights[c]; tv += weights[c] * v; }
  let global = Math.round(tv / tw);
  if (!html.length) global = 0;

  const real = issues.filter((x) => x.affected.length > 0).sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || b.weight * b.affected.length / b.total - a.weight * a.affected.length / a.total);
  const counts = { critical: 0, warning: 0, info: 0 } as Record<Severity, number>;
  real.forEach((x) => counts[x.severity]++);
  return { score: global, issues: real, summary: { categories, counts } };
}

const sevRank = (s: Severity) => (s === 'critical' ? 0 : s === 'warning' ? 1 : 2);

function dupes(pages: PageResult[], f: (p: PageResult) => string | null): string[] {
  const map = new Map<string, string[]>();
  for (const p of pages) { const v = f(p)?.trim().toLowerCase(); if (v) map.set(v, [...(map.get(v) || []), p.url]); }
  return Array.from(map.values()).filter((l) => l.length > 1).flat();
}

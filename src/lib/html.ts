// Analyse HTML légère (sans dépendance) — suffisante pour un audit SEO on-page.

export type Attrs = Record<string, string>;

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

export function parseAttrs(tag: string): Attrs {
  const out: Attrs = {};
  const inner = tag.replace(/^<\s*[a-zA-Z0-9]+/, '').replace(/\/?>$/, '');
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(inner))) {
    out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return out;
}

export function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à').replace(/&ccedil;/g, 'ç')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export function stripTags(s: string): string {
  return decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
}

export type PageData = {
  title: string | null;
  description: string | null;
  robots: string | null;
  canonical: string | null;
  lang: string | null;
  viewport: boolean;
  ogTitle: string | null;
  ogImage: string | null;
  headings: { level: number; text: string }[];
  h1: string[];
  words: number;
  images: number;
  imagesNoAlt: number;
  links: { href: string; text: string; nofollow: boolean }[];
  schemaTypes: string[];
  hasFavicon: boolean;
};

export function parsePage(html: string): PageData {
  const head = html.slice(0, 200_000);
  const titleM = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metas = tags(head, 'meta').map(parseAttrs);
  const meta = (key: string) => {
    const m = metas.find((a) => (a.name || a.property || '').toLowerCase() === key);
    return m?.content?.trim() || null;
  };
  const linksTags = tags(head, 'link').map(parseAttrs);
  const canonical = linksTags.find((l) => (l.rel || '').toLowerCase().split(/\s+/).includes('canonical'))?.href ?? null;
  const hasFavicon = linksTags.some((l) => /icon/i.test(l.rel || ''));
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0];
  const lang = htmlTag ? parseAttrs(htmlTag).lang || null : null;

  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, (s) => (/application\/ld\+json/i.test(s.slice(0, 200)) ? s : ' '))
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const headings: { level: number; text: string }[] = [];
  const hRe = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hRe.exec(body))) headings.push({ level: Number(hm[1]), text: stripTags(hm[2]).slice(0, 160) });

  const imgs = tags(body, 'img').map(parseAttrs);
  const imagesNoAlt = imgs.filter((a) => !('alt' in a) || (a.alt.trim() === '' && a.role !== 'presentation')).length;

  const links: PageData['links'] = [];
  const aRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = aRe.exec(body))) {
    const a = parseAttrs(`<a ${am[1]}>`);
    if (!a.href) continue;
    links.push({ href: a.href, text: stripTags(am[2]).slice(0, 80), nofollow: /nofollow/i.test(a.rel || '') });
  }

  const schemaTypes: string[] = [];
  const ldRe = /<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = ldRe.exec(html))) {
    try {
      const j = JSON.parse(lm[1].trim());
      const collect = (o: any) => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) return o.forEach(collect);
        if (o['@type']) ([] as string[]).concat(o['@type']).forEach((t) => schemaTypes.push(String(t)));
        if (o['@graph']) collect(o['@graph']);
      };
      collect(j);
    } catch {
      schemaTypes.push('(JSON-LD invalide)');
    }
  }

  const bodyOnly = body.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? body;
  const text = stripTags(bodyOnly.replace(/<script\b[\s\S]*?<\/script>/gi, ' '));
  const words = text ? text.split(/\s+/).filter((w) => /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(w)).length : 0;

  return {
    title: titleM ? stripTags(titleM[1]) || null : null,
    description: meta('description'),
    robots: meta('robots'),
    canonical,
    lang,
    viewport: !!meta('viewport'),
    ogTitle: meta('og:title'),
    ogImage: meta('og:image'),
    headings,
    h1: headings.filter((h) => h.level === 1).map((h) => h.text),
    words,
    images: imgs.length,
    imagesNoAlt,
    links,
    schemaTypes: Array.from(new Set(schemaTypes)),
    hasFavicon,
  };
}

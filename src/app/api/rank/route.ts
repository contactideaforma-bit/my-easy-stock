import { NextResponse } from 'next/server';
import { authed, fail } from '@/lib/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const bare = (h: string) => h.replace(/^www\./, '').toLowerCase();

/** Vérifie la position Google d'un mot-clé (via serper.dev — clé SERPER_API_KEY). */
export async function POST(req: Request) {
  const a = await authed(req);
  if (a instanceof NextResponse) return a;
  const key = process.env.SERPER_API_KEY;
  if (!key) return fail('Suivi automatique non activé : ajoutez SERPER_API_KEY (serper.dev) dans Vercel, ou saisissez la position à la main.');
  const { keywordId } = await req.json().catch(() => ({}));
  const { data: kw } = await a.db.from('seo_keywords').select('id,keyword,site_id,seo_sites(url)').eq('id', keywordId).single();
  if (!kw) return fail('Mot-clé introuvable', 404);
  const host = bare(new URL((kw as any).seo_sites.url).host);
  let position: number | null = null;
  let found: string | null = null;
  for (let page = 1; page <= 3 && position === null; page++) {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: kw.keyword, gl: 'fr', hl: 'fr', num: 10, page }),
    });
    const j: any = await res.json();
    if (!res.ok) return fail(j?.message || `Serper ${res.status}`, 502);
    for (const o of j.organic || []) {
      try { if (bare(new URL(o.link).host) === host) { position = o.position + (page - 1) * 10; found = o.link; break; } } catch {}
    }
  }
  const { error } = await a.db.from('seo_keyword_positions').insert({ keyword_id: kw.id, position, found_url: found, source: 'serper' });
  if (error) return fail(error.message, 500);
  return NextResponse.json({ position, found });
}

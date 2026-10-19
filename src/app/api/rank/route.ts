import { NextResponse } from 'next/server';
import { authed, fail } from '@/lib/server';
import { serperPosition } from '@/lib/rank';

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Vérifie la position Google d'un mot-clé (via serper.dev — clé SERPER_API_KEY). */
export async function POST(req: Request) {
  const a = await authed(req);
  if (a instanceof NextResponse) return a;
  const { keywordId } = await req.json().catch(() => ({}));
  const { data: kw } = await a.db.from('seo_keywords').select('id,keyword,site_id,seo_sites(url)').eq('id', keywordId).single();
  if (!kw) return fail('Mot-clé introuvable', 404);
  try {
    const { position, found } = await serperPosition(kw.keyword, (kw as any).seo_sites.url);
    const { error } = await a.db.from('seo_keyword_positions').insert({ keyword_id: kw.id, position, found_url: found, source: 'serper' });
    if (error) return fail(error.message, 500);
    return NextResponse.json({ position, found });
  } catch (e: any) {
    return fail(e?.message || String(e), 400);
  }
}

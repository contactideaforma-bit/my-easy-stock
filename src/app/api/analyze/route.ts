import { NextResponse } from 'next/server';
import { authed, fail } from '@/lib/server';
import { crawl } from '@/lib/audit';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Analyse rapide d'une adresse (prospect, concurrent) sans l'enregistrer. */
export async function POST(req: Request) {
  const a = await authed(req);
  if (a instanceof NextResponse) return a;
  const { url, maxPages } = await req.json().catch(() => ({}));
  if (!url) return fail('Adresse manquante');
  try {
    return NextResponse.json(await crawl(url, { maxPages: Math.min(Number(maxPages) || 10, 30), budgetMs: 30_000 }));
  } catch (e: any) {
    return fail('Analyse impossible : ' + (e?.message || e), 500);
  }
}

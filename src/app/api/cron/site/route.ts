import { NextResponse } from 'next/server';
import { adminDb, cronAllowed } from '@/lib/admin';
import { crawl } from '@/lib/audit';
import { syncAuditTasks } from '@/lib/tasks';
import { serperPosition } from '@/lib/rank';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!cronAllowed(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const db = adminDb();
  const { siteId } = await req.json().catch(() => ({}));
  const { data: site } = await db.from('seo_sites').select('id,url').eq('id', siteId).single();
  if (!site) return NextResponse.json({ error: 'Site introuvable' }, { status: 404 });
  await db.from('seo_sites').update({ last_auto_at: new Date().toISOString() }).eq('id', site.id);
  const out: any = {};
  // Positions d'abord (rapide), en parallèle de l'audit
  const rankJob = (async () => {
    if (!process.env.SERPER_API_KEY) return 'serper absent';
    const { data: kws } = await db.from('seo_keywords').select('id,keyword').eq('site_id', site.id).order('priority').limit(25);
    let n = 0;
    await Promise.all((kws || []).map(async (k) => {
      try { const r = await serperPosition(k.keyword, site.url); await db.from('seo_keyword_positions').insert({ keyword_id: k.id, position: r.position, found_url: r.found, source: 'auto' }); n++; } catch {}
    }));
    return n;
  })();
  try {
    const r = await crawl(site.url, { maxPages: 30, budgetMs: 34_000 });
    await db.from('seo_audits').insert({ site_id: site.id, score: r.score, pages_crawled: r.pages.length, summary: r.summary, site_checks: r.site_checks, pages: r.pages, issues: r.issues, performance: r.performance });
    out.score = r.score;
    out.tasks = await syncAuditTasks(db, site.id, r.issues);
  } catch (e: any) { out.auditError = String(e?.message || e); }
  out.ranks = await rankJob;
  return NextResponse.json(out);
}

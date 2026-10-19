import { NextResponse } from 'next/server';
import { authed, fail } from '@/lib/server';
import { crawl } from '@/lib/audit';
import { syncAuditTasks } from '@/lib/tasks';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const a = await authed(req);
  if (a instanceof NextResponse) return a;
  const { siteId, maxPages } = await req.json().catch(() => ({}));
  const { data: site } = await a.db.from('seo_sites').select('id,url').eq('id', siteId).single();
  if (!site) return fail('Site introuvable', 404);
  try {
    const r = await crawl(site.url, { maxPages: Math.min(Number(maxPages) || 30, 60) });
    const { data, error } = await a.db.from('seo_audits').insert({
      site_id: site.id, score: r.score, pages_crawled: r.pages.length, summary: r.summary, site_checks: r.site_checks, pages: r.pages, issues: r.issues, performance: r.performance,
    }).select('id').single();
    if (error) return fail(error.message, 500);
    const tasks = await syncAuditTasks(a.db, site.id, r.issues).catch(() => null);
    return NextResponse.json({ id: data.id, score: r.score, tasks });
  } catch (e: any) {
    return fail('Audit impossible : ' + (e?.message || e), 500);
  }
}

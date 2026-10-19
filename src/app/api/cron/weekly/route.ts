import { NextResponse } from 'next/server';
import { adminDb, cronAllowed } from '@/lib/admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Lancé chaque jour par Vercel Cron : relance l'audit et les positions des sites dont le dernier suivi date de plus de 6 jours. */
export async function GET(req: Request) {
  if (!cronAllowed(req)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  let db;
  try { db = adminDb(); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  const limit = new Date(Date.now() - 6 * 86400000).toISOString();
  const { data: sites, error } = await db.from('seo_sites').select('id,name,last_auto_at').eq('auto_weekly', true).or(`last_auto_at.is.null,last_auto_at.lt.${limit}`).order('last_auto_at', { ascending: true, nullsFirst: true }).limit(8);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const origin = new URL(req.url).origin;
  // Un appel séparé par site : chacun dispose de son propre délai de 60 s
  const results = await Promise.all((sites || []).map((s) =>
    fetch(`${origin}/api/cron/site`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-key': process.env.SUPABASE_SERVICE_ROLE_KEY! }, body: JSON.stringify({ siteId: s.id }) })
      .then((r) => r.json()).catch((e) => ({ error: String(e) })).then((r) => ({ site: s.name, ...r }))));
  return NextResponse.json({ processed: results.length, results });
}

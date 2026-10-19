import type { SupabaseClient } from '@supabase/supabase-js';
import type { Issue } from './types';

export const TASK_CATEGORIES: Record<string, string> = {
  technique: 'Technique',
  balises: 'Balises',
  contenu: 'Contenu',
  creation: 'Nouvelle page',
  local: 'Local',
  autorite: 'Notoriété',
  mesure: 'Mesure',
};

export type Task = {
  id: string; site_id: string; strategy_id: string | null; source: 'audit' | 'strategy' | 'manual'; issue_id: string | null;
  title: string; detail: string | null; category: string; priority: number; impact: number; effort: number;
  status: 'todo' | 'doing' | 'done'; due_date: string | null; target_url: string | null; keyword: string | null;
  auto_note: string | null; done_at: string | null; created_at: string;
};

const addDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const prio = (s: Issue['severity']) => (s === 'critical' ? 1 : s === 'warning' ? 2 : 3);
const short = (u: string) => u.replace(/^https?:\/\/[^/]+/, '') || '/';

function issueDetail(i: Issue) {
  const pages = i.total > 1 && i.affected.length ? `\n\nPages concernées (${i.affected.length}/${i.total}) :\n${i.affected.slice(0, 15).map((u) => '- ' + short(u)).join('\n')}${i.affected.length > 15 ? `\n- … et ${i.affected.length - 15} autres` : ''}` : '';
  return `${i.advice}${pages}`;
}

/**
 * Synchronise le plan d'action avec un audit :
 * crée une tâche par nouveau problème, ferme celles qui ont disparu, rouvre celles qui reviennent.
 */
export async function syncAuditTasks(db: SupabaseClient, siteId: string, issues: Issue[]) {
  const today = new Date().toLocaleDateString('fr-FR');
  const { data: existing } = await db.from('seo_tasks').select('id,issue_id,status,auto_note').eq('site_id', siteId).eq('source', 'audit');
  const byIssue = new Map((existing || []).map((t: any) => [t.issue_id, t]));
  const current = new Set(issues.map((i) => i.id));
  let created = 0, closed = 0, reopened = 0;

  for (const t of existing || []) {
    if (t.status !== 'done' && !current.has(t.issue_id)) {
      await db.from('seo_tasks').update({ status: 'done', done_at: new Date().toISOString(), auto_note: `Résolu : le problème n’apparaît plus dans l’audit du ${today}.` }).eq('id', t.id);
      closed++;
    }
  }
  const inserts: any[] = [];
  for (const i of issues) {
    const t: any = byIssue.get(i.id);
    if (!t) {
      inserts.push({
        site_id: siteId, source: 'audit', issue_id: i.id, title: i.title, detail: issueDetail(i),
        category: i.category === 'performance' ? 'technique' : i.category, priority: prio(i.severity), impact: prio(i.severity) === 1 ? 3 : prio(i.severity) === 2 ? 2 : 1,
        effort: i.category === 'balises' ? 1 : 2, due_date: addDays(i.severity === 'critical' ? 7 : i.severity === 'warning' ? 21 : 45),
      });
    } else if (t.status === 'done' && !(t.auto_note || '').startsWith('Ignoré')) {
      await db.from('seo_tasks').update({ status: 'todo', done_at: null, detail: issueDetail(i), auto_note: (t.auto_note || '').startsWith('Résolu') ? `Réapparu dans l’audit du ${today}.` : `Toujours détecté dans l’audit du ${today}.` }).eq('id', t.id);
      reopened++;
    } else if (t.status !== 'done') {
      await db.from('seo_tasks').update({ detail: issueDetail(i) }).eq('id', t.id);
    }
  }
  if (inserts.length) { await db.from('seo_tasks').insert(inserts); created = inserts.length; }
  return { created, closed, reopened };
}

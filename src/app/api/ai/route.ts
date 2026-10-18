import { NextResponse } from 'next/server';
import { authed, fail } from '@/lib/server';
import { askClaude } from '@/lib/ai';
import { crawl } from '@/lib/audit';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const a = await authed(req);
  if (a instanceof NextResponse) return a;
  const { siteId, kind, input = {} } = await req.json().catch(() => ({}));
  const { data: site } = await a.db.from('seo_sites').select('*').eq('id', siteId).single();
  if (!site) return fail('Site introuvable', 404);
  const ctx = `Site : ${site.name} — ${site.url}${site.client_name ? ` (client : ${site.client_name})` : ''}${site.notes ? `\nNotes : ${site.notes}` : ''}`;

  let prompt = '';
  try {
    if (kind === 'summary') {
      const { data: audit } = await a.db.from('seo_audits').select('*').eq('id', input.auditId).single();
      if (!audit) return fail('Audit introuvable', 404);
      const issues = (audit.issues || []).slice(0, 18).map((i: any) => `- [${i.severity}] ${i.title} — ${i.affected.length}/${i.total} page(s)`).join('\n');
      prompt = `${ctx}\nAudit du ${new Date(audit.created_at).toLocaleDateString('fr-FR')} : score global ${audit.score}/100, ${audit.pages_crawled} pages analysées.
Scores par catégorie : ${JSON.stringify(audit.summary?.categories)}. Performance mobile : ${JSON.stringify(audit.performance)}.
Problèmes détectés :\n${issues}\n
Rédige une synthèse destinée au client (non technicien) : 1) ## En bref (3 phrases), 2) ## Ce qui va bien, 3) ## Les 5 priorités (tableau : action, pourquoi, difficulté, impact), 4) ## Plan sur 30 jours.`;
      const out = await askClaude(prompt, 2200);
      await a.db.from('seo_audits').update({ ai_summary: out }).eq('id', audit.id);
      await a.db.from('seo_ai_items').insert({ site_id: site.id, kind, input, output: out });
      return NextResponse.json({ output: out });
    }
    if (kind === 'meta') {
      const url = input.url || site.url;
      const r = await crawl(url, { maxPages: 1, withPerf: false, budgetMs: 12_000 });
      const p = r.pages[0];
      prompt = `${ctx}\nPage : ${p?.url}\nTitle actuel : ${p?.title ?? '(aucun)'}\nDescription actuelle : ${p?.description ?? '(aucune)'}\nH1 : ${p?.h1.join(' | ') || '(aucun)'}\nTitres : ${p?.headings.slice(0, 15).map((h) => 'H' + h.level + ' ' + h.text).join(' / ')}\nMot-clé visé : ${input.keyword || '(à déduire)'}\n
Propose : un diagnostic en 2 lignes, puis un tableau de 3 balises title (≤ 60 caractères, indique le nombre de caractères) et un tableau de 3 meta descriptions (120-155 caractères, avec le nombre), puis un H1 recommandé. Donne aussi le code HTML prêt à copier pour la meilleure option.`;
    } else if (kind === 'keywords') {
      prompt = `${ctx}\nActivité / thème : ${input.topic || site.notes || site.name}\nZone : ${input.city || 'France'}\n
Propose 25 mots-clés pertinents pour le référencement (local si une ville est donnée), dans un tableau : mot-clé, intention (info / comparaison / achat / local), difficulté estimée (faible/moyenne/forte), page conseillée. Termine par les 5 mots-clés à travailler en premier et pourquoi. Précise que les volumes sont des estimations à vérifier.`;
    } else if (kind === 'brief') {
      prompt = `${ctx}\nMot-clé principal : ${input.keyword}\nType de page : ${input.pageType || 'page de service'}\n
Rédige un brief de contenu SEO : intention de recherche, title et meta proposés, H1, plan détaillé (H2/H3) avec ce qu'il faut dire dans chaque partie, mots-clés secondaires et champ lexical, FAQ (5 questions), liens internes conseillés, données structurées à ajouter, longueur cible.`;
    } else if (kind === 'free') {
      prompt = `${ctx}\nQuestion : ${input.question}`;
    } else return fail('Type de demande inconnu');

    const out = await askClaude(prompt, 2400);
    await a.db.from('seo_ai_items').insert({ site_id: site.id, kind, input, output: out });
    return NextResponse.json({ output: out });
  } catch (e: any) {
    return fail(e?.message || String(e), 500);
  }
}

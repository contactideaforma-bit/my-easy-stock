import { NextResponse } from 'next/server';
import { authed, fail } from '@/lib/server';
import { askClaudeJSON } from '@/lib/ai';
import type { Strategy, StrategyInputs } from '@/lib/strategy';

export const runtime = 'nodejs';
export const maxDuration = 60;

const short = (u: string) => u.replace(/^https?:\/\/[^/]+/, '') || '/';

/**
 * Étape « strategy » : bâtit la stratégie (piliers, mots-clés, pages, KPI).
 * Étape « plan » : transforme la stratégie en tâches datées sur 12 semaines.
 */
export async function POST(req: Request) {
  const a = await authed(req);
  if (a instanceof NextResponse) return a;
  const { siteId, step, inputs, strategyId } = await req.json().catch(() => ({}));
  const { data: site } = await a.db.from('seo_sites').select('*').eq('id', siteId).single();
  if (!site) return fail('Site introuvable', 404);

  try {
    if (step === 'strategy') {
      const inp = (inputs || {}) as StrategyInputs;
      const { data: audit } = await a.db.from('seo_audits').select('score,pages,issues,summary,created_at').eq('site_id', site.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { data: kws } = await a.db.from('seo_keywords').select('keyword,seo_keyword_positions(position,checked_at)').eq('site_id', site.id);
      const pages = (audit?.pages || []).filter((p: any) => p.status >= 200 && p.status < 400).slice(0, 30)
        .map((p: any) => `- ${short(p.url)} | title: ${p.title ?? '—'} | H1: ${p.h1?.[0] ?? '—'} | ${p.words} mots`).join('\n');
      const issues = (audit?.issues || []).slice(0, 12).map((i: any) => `- ${i.title} (${i.affected.length}/${i.total})`).join('\n');
      const kwText = (kws || []).map((k: any) => { const last = [...(k.seo_keyword_positions || [])].sort((x: any, y: any) => y.checked_at.localeCompare(x.checked_at))[0]; return `- ${k.keyword} : ${last ? last.position ?? 'hors top 30' : 'non mesuré'}`; }).join('\n');

      const prompt = `Construis la stratégie SEO du site ci-dessous, avec un objectif business concret et mesurable.
Site : ${site.name} — ${site.url}
Description : ${site.notes || '(non renseignée)'}
Objectif principal : ${inp.goal || 'plus de contacts'}
Clients visés : ${inp.audience || '(à déduire)'}
Zone : ${inp.zone || 'France'}
Offre / différenciation : ${inp.offer || '(à déduire)'}
Concurrents connus : ${inp.competitors || '(aucun indiqué)'}
Horizon : ${inp.horizon || '6'} mois (à compter d'aujourd'hui, ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })})
${audit ? `Dernier audit : score ${audit.score}/100.\nPages existantes :\n${pages}\nProblèmes principaux :\n${issues}` : 'Aucun audit disponible.'}
${kwText ? `Mots-clés déjà suivis (position Google) :\n${kwText}` : ''}

Contraintes : sois réaliste pour une petite structure (peu de temps, budget limité). Pas de promesse de position garantie.
Les mots-clés doivent être de vraies requêtes que tapent les clients en France (pas de jargon interne). Cible en priorité les requêtes à intention commerciale et de longue traîne accessibles.
Format JSON attendu (textes courts, en français) :
{"positionnement":"2 phrases","objectif":"objectif chiffré et daté","kpis":[{"nom":"","cible":"","delai":""}],"cibles":["persona en 1 ligne"],
"piliers":[{"theme":"","intention":"info|comparaison|achat|local","mots_cles":[{"kw":"","priorite":1,"difficulte":"faible|moyenne|forte"}],"page":{"url":"/chemin existant ou null","titre":"titre de page conseillé","statut":"existante|a_optimiser|a_creer"}}],
"quick_wins":["action rapide à fort effet"],"contenus":[{"titre":"","type":"page|article|faq|etude de cas","mot_cle":"","mois":1}],
"local":["action SEO local, vide si non pertinent"],"autorite":["action de notoriété / liens"],"risques":["point de vigilance"]}
Donne 3 KPI, 4 à 5 piliers de 3 à 4 mots-clés chacun, 4 à 5 quick wins, 6 à 8 contenus répartis sur l'horizon, 2 à 3 actions locales et d'autorité. Textes très courts (une ligne chacun).`;
      const content = await askClaudeJSON<Strategy>(prompt, 3200);
      const { data, error } = await a.db.from('seo_strategies').insert({ site_id: site.id, inputs: inp, content }).select('*').single();
      if (error) return fail(error.message, 500);
      return NextResponse.json(data);
    }

    if (step === 'plan') {
      const { data: strat } = await a.db.from('seo_strategies').select('*').eq('id', strategyId).single();
      if (!strat) return fail('Stratégie introuvable', 404);
      const s = strat.content as Strategy;
      const { data: openAudit } = await a.db.from('seo_tasks').select('title').eq('site_id', site.id).eq('source', 'audit').neq('status', 'done');
      const prompt = `Voici la stratégie SEO du site ${site.name} (${site.url}) :
${JSON.stringify({ objectif: s.objectif, piliers: s.piliers, quick_wins: s.quick_wins, contenus: s.contenus, local: s.local, autorite: s.autorite })}
Tâches techniques déjà prévues par l'audit (ne pas les répéter) :
${(openAudit || []).map((t: any) => '- ' + t.title).join('\n') || '(aucune)'}

Transforme cette stratégie en plan d'action concret sur 12 semaines : 14 à 18 tâches, chacune réalisable en une séance de travail, avec un résultat vérifiable.
Commence par les quick wins et l'optimisation des pages existantes, puis la création des pages piliers, puis contenus, local et notoriété. Inclus 1 tâche de mesure (Google Search Console) en semaine 1.
Format JSON : {"taches":[{"titre":"verbe d'action + objet","detail":"comment faire, 1-2 phrases courtes","categorie":"technique|balises|contenu|creation|local|autorite|mesure","priorite":1,"impact":3,"effort":2,"semaine":1,"url":"/chemin ou null","mot_cle":"mot-clé visé ou null"}]}
priorite/impact/effort de 1 à 3 (priorite 1 = urgent ; impact 3 = fort ; effort 3 = lourd).`;
      const out = await askClaudeJSON<{ taches: any[] }>(prompt, 3200);
      const cats = ['technique', 'balises', 'contenu', 'creation', 'local', 'autorite', 'mesure'];
      const clamp = (n: any, d = 2) => Math.min(3, Math.max(1, Number(n) || d));
      const rows = (out.taches || []).slice(0, 30).map((t) => ({
        site_id: site.id, strategy_id: strat.id, source: 'strategy', title: String(t.titre || '').slice(0, 200), detail: t.detail || null,
        category: cats.includes(t.categorie) ? t.categorie : 'contenu', priority: clamp(t.priorite), impact: clamp(t.impact), effort: clamp(t.effort),
        due_date: new Date(Date.now() + Math.min(12, Math.max(1, Number(t.semaine) || 1)) * 7 * 86400000).toISOString().slice(0, 10),
        target_url: t.url && t.url !== 'null' ? t.url : null, keyword: t.mot_cle && t.mot_cle !== 'null' ? t.mot_cle : null,
      })).filter((r) => r.title);
      // Les tâches « à faire » issues d'une stratégie (ancienne ou recalculée) sont remplacées ; celles en cours ou terminées sont conservées
      await a.db.from('seo_tasks').delete().eq('site_id', site.id).eq('source', 'strategy').eq('status', 'todo');
      const { error } = await a.db.from('seo_tasks').insert(rows);
      if (error) return fail(error.message, 500);
      return NextResponse.json({ created: rows.length });
    }

    if (step === 'refresh') {
      // Réécrit uniquement les éléments datés (objectif, KPI) d'une stratégie générée sans date du jour
      const { data: strat } = await a.db.from('seo_strategies').select('*').eq('id', strategyId).single();
      if (!strat) return fail('Stratégie introuvable', 404);
      const s = strat.content as Strategy;
      const horizon = Number((strat.inputs as StrategyInputs)?.horizon) || 6;
      const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
      const prompt = `Nous sommes le ${today}. La stratégie SEO ci-dessous a été rédigée avec des dates erronées (année passée). L'horizon est de ${horizon} mois à compter d'aujourd'hui.
Objectif actuel : ${s.objectif}
KPI actuels : ${JSON.stringify(s.kpis)}
Réécris ces éléments avec des dates et délais cohérents (entre aujourd'hui et ${horizon} mois), sans changer les chiffres ni le sens. Textes courts.
Format JSON : {"objectif":"objectif chiffré et daté","kpis":[{"nom":"","cible":"","delai":""}]}`;
      const out = await askClaudeJSON<{ objectif: string; kpis: Strategy['kpis'] }>(prompt, 800);
      const content: Strategy = { ...s, objectif: out.objectif || s.objectif, kpis: Array.isArray(out.kpis) && out.kpis.length ? out.kpis : s.kpis };
      const { data, error } = await a.db.from('seo_strategies').update({ content }).eq('id', strat.id).select('*').single();
      if (error) return fail(error.message, 500);
      return NextResponse.json(data);
    }

    if (step === 'track') {
      const { data: strat } = await a.db.from('seo_strategies').select('content').eq('id', strategyId).single();
      const s = strat?.content as Strategy | undefined;
      if (!s) return fail('Stratégie introuvable', 404);
      const rows = s.piliers.flatMap((p) => p.mots_cles.map((k) => ({ site_id: site.id, keyword: k.kw.toLowerCase().trim(), priority: Math.min(3, Math.max(1, k.priorite || 2)), target_url: p.page?.url || null, intent: p.intention })));
      const { error } = await a.db.from('seo_keywords').upsert(rows, { onConflict: 'site_id,keyword', ignoreDuplicates: true });
      if (error) return fail(error.message, 500);
      return NextResponse.json({ added: rows.length });
    }
    return fail('Étape inconnue');
  } catch (e: any) {
    return fail(e?.message || String(e), 500);
  }
}

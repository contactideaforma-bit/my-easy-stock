// Appel à Claude (Anthropic) — clé ANTHROPIC_API_KEY côté serveur uniquement.

const MODELS = [process.env.ANTHROPIC_MODEL, 'claude-sonnet-4-5', 'claude-sonnet-4-0', 'claude-3-5-sonnet-latest'].filter(Boolean) as string[];

const todayFr = () => new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

const system = () => `Tu es un consultant SEO senior francophone qui travaille pour IDEA (studio web MyEasyDev, Marseille).
Tu t'adresses à des petites entreprises locales (artisans, commerces, restaurants, organismes de formation).
Date du jour : ${todayFr()}. Toute date, échéance ou délai que tu écris doit être calculé à partir de cette date (jamais d'année antérieure).
Règles : réponds en français clair, concret et actionnable ; pas de jargon sans explication ; pas de promesses de position garantie ;
formate en Markdown (titres ##, listes, tableaux si utile) ; reste concis.`;

export async function askClaude(prompt: string, maxTokens = 1800): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Clé ANTHROPIC_API_KEY absente : ajoutez-la dans les variables d’environnement Vercel.');
  let lastErr = '';
  for (const model of MODELS) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: system(), messages: [{ role: 'user', content: prompt }] }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (res.ok) return (j.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim();
    lastErr = j?.error?.message || `Erreur IA ${res.status}`;
    if (res.status !== 404 && !/model/i.test(lastErr)) break; // on n'essaie un autre modèle que si celui-ci n'existe pas
  }
  throw new Error(lastErr);
}

/** Demande une réponse JSON (objet) et la parse de façon tolérante. */
export async function askClaudeJSON<T = any>(prompt: string, maxTokens = 3000): Promise<T> {
  const text = await askClaude(prompt + '\n\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans bloc de code.', maxTokens);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Réponse IA illisible, relancez.');
  try { return JSON.parse(text.slice(start, end + 1)); }
  catch { throw new Error('Réponse IA incomplète (trop longue ?), relancez.'); }
}

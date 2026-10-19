const bare = (h: string) => h.replace(/^www\./, '').toLowerCase();

/** Position Google (top 30) d'un domaine sur une requête, via serper.dev. */
export async function serperPosition(keyword: string, siteUrl: string): Promise<{ position: number | null; found: string | null }> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error('Suivi automatique non activé : ajoutez SERPER_API_KEY (serper.dev) dans Vercel, ou saisissez la position à la main.');
  const host = bare(new URL(siteUrl).host);
  for (let page = 1; page <= 3; page++) {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: keyword, gl: 'fr', hl: 'fr', num: 10, page }),
    });
    const j: any = await res.json();
    if (!res.ok) throw new Error(j?.message || `Serper ${res.status}`);
    for (const o of j.organic || []) {
      try { if (bare(new URL(o.link).host) === host) return { position: o.position + (page - 1) * 10, found: o.link }; } catch {}
    }
  }
  return { position: null, found: null };
}

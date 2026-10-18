import type { Performance } from './types';

/** Google PageSpeed Insights (fonctionne sans clé, mais avec un quota réduit : ajouter GOOGLE_PSI_API_KEY). */
export async function runPageSpeed(url: string): Promise<Performance> {
  const p = new URLSearchParams({ url, strategy: 'mobile', locale: 'fr' });
  ['performance', 'seo', 'accessibility', 'best-practices'].forEach((c) => p.append('category', c));
  if (process.env.GOOGLE_PSI_API_KEY) p.set('key', process.env.GOOGLE_PSI_API_KEY);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 48_000);
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${p}`, { signal: ctrl.signal, cache: 'no-store' });
    const j: any = await res.json();
    if (!res.ok) throw new Error(j?.error?.message || `PageSpeed ${res.status}`);
    const cat = j.lighthouseResult?.categories ?? {};
    const a = j.lighthouseResult?.audits ?? {};
    const pct = (x: any) => (typeof x?.score === 'number' ? Math.round(x.score * 100) : null);
    return {
      strategy: 'mobile',
      performance: pct(cat.performance),
      seo: pct(cat.seo),
      accessibility: pct(cat.accessibility),
      bestPractices: pct(cat['best-practices']),
      lcp: a['largest-contentful-paint']?.displayValue ?? null,
      cls: a['cumulative-layout-shift']?.displayValue ?? null,
      tbt: a['total-blocking-time']?.displayValue ?? null,
      fcp: a['first-contentful-paint']?.displayValue ?? null,
    };
  } finally {
    clearTimeout(t);
  }
}

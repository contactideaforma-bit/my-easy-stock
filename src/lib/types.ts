export type Severity = 'critical' | 'warning' | 'info';
export type Category = 'technique' | 'contenu' | 'balises' | 'performance';

export const CATEGORY_LABEL: Record<Category, string> = {
  technique: 'Technique',
  contenu: 'Contenu',
  balises: 'Balises & partage',
  performance: 'Performance',
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Bloquant',
  warning: 'À corriger',
  info: 'Bonus',
};

export type PageResult = {
  url: string;
  status: number;
  ms: number;
  depth: number;
  title: string | null;
  description: string | null;
  h1: string[];
  headings: { level: number; text: string }[];
  words: number;
  images: number;
  imagesNoAlt: number;
  canonical: string | null;
  robots: string | null;
  lang: string | null;
  viewport: boolean;
  og: boolean;
  schemaTypes: string[];
  internalLinks: number;
  externalLinks: number;
  error?: string;
};

export type Issue = {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  advice: string;
  affected: string[];
  total: number;
  weight: number;
};

export type Performance = {
  strategy: 'mobile';
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  lcp: string | null;
  cls: string | null;
  tbt: string | null;
  fcp: string | null;
  error?: string;
};

export type AuditResult = {
  score: number;
  summary: { categories: Partial<Record<Category, number>>; counts: Record<Severity, number>; durationMs: number; startUrl: string; truncated: boolean };
  site_checks: { https: boolean; robots: boolean; robotsBlocksAll: boolean; sitemap: string | null; sitemapUrls: number; favicon: boolean };
  pages: PageResult[];
  issues: Issue[];
  performance: Performance | null;
};

export type Site = {
  id: string;
  owner_id: string;
  name: string;
  url: string;
  client_name: string | null;
  notes: string | null;
  color: string | null;
  auto_weekly?: boolean;
  last_auto_at?: string | null;
  created_at: string;
};

export type AuditRow = AuditResult & { id: string; site_id: string; pages_crawled: number; ai_summary: string | null; created_at: string };

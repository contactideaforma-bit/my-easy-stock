export const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);

export const fmtDate = (d: string | Date) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    typeof d === 'string' ? new Date(d) : d
  );

export const fmtDay = (d: string | Date) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    typeof d === 'string' ? new Date(d) : d
  );

export function variantLabel(v: { size?: string | null; color?: string | null }) {
  return [v.size, v.color].filter(Boolean).join(' · ') || 'Standard';
}

/** Génère un code-barres EAN-13 valide (préfixe interne 20 = usage magasin) */
export function generateEAN13(): string {
  const base = '20' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0');
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
  return base + String((10 - (sum % 10)) % 10);
}

export function generateSKU(name: string, size?: string | null, color?: string | null): string {
  const p = (s: string) => s.normalize('NFD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return [p(name).slice(0, 4), size ? p(size).slice(0, 4) : '', color ? p(color).slice(0, 3) : '', rand]
    .filter(Boolean)
    .join('-');
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysAgo(n: number) {
  const x = startOfDay();
  x.setDate(x.getDate() - n);
  return x;
}

'use client';

/**
 * Export CSV compatible Excel français :
 * séparateur « ; », BOM UTF-8 (accents corrects), nombres avec virgule.
 */

export function csvNumber(n: number): string {
  return String(n ?? 0).replace('.', ',');
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const content = '\uFEFF' + rows.map((r) => r.map(escape).join(';')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Outils partagés pour le scan de bons d'achat (photo → lignes d'articles). */

export type ScanLine = {
  reference: string | null;
  designation: string;
  size: string | null;
  color: string | null;
  qty: number;
  unit_cost: number | null;
};

export type ScanResult = { supplier: string | null; date: string | null; lines: ScanLine[] };

/** Redimensionne la photo côté client (max 1600 px) pour un envoi rapide */
export async function fileToBase64(file: File): Promise<{ data: string; media_type: string }> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = document.createElement('img');
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });
  const max = 1600;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL('image/jpeg', 0.85);
  return { data: out.split(',')[1], media_type: 'image/jpeg' };
}

/** Envoie la photo du bon à l'API d'analyse et retourne les lignes extraites. */
export async function scanBonImage(file: File): Promise<ScanResult> {
  const { data, media_type } = await fileToBase64(file);
  const res = await fetch('/api/scan-bon', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: data, media_type }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Analyse impossible.');
  return { supplier: json.supplier ?? null, date: json.date ?? null, lines: json.lines || [] };
}

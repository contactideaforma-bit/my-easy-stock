'use client';

/** Génère une image de ticket de vente et la partage (WhatsApp, etc.) ou la télécharge. */

export type TicketData = {
  number: number | string;
  date: string | Date;
  items: { name: string; label?: string | null; qty: number; unit_price: number }[];
  total: number;
  method: string;
  vendorName?: string | null;
};

const methodLabel = (m: string) => (m === 'especes' ? 'Espèces' : m === 'carte' ? 'Carte' : 'Crédit');

const eur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}

export async function shareTicket(t: TicketData) {
  const W = 640;
  const M = 44;
  const lineH = 52;
  const H = 300 + t.items.length * lineH + 170;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Fond
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  // Bandeau haut
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#60b8fa');
  grad.addColorStop(1, '#257ceb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 12);

  ctx.fillStyle = '#0d2b4e';
  ctx.font = 'bold 40px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText('My Easy Stock', M, 88);

  ctx.font = '26px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(13,43,78,0.6)';
  const d = typeof t.date === 'string' ? new Date(t.date) : t.date;
  ctx.fillText(
    `Ticket #${t.number} — ${new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)}`,
    M,
    134
  );
  if (t.vendorName) ctx.fillText(`Vendeur : ${t.vendorName}`, M, 170);

  // Séparateur
  let y = t.vendorName ? 205 : 175;
  ctx.strokeStyle = 'rgba(13,43,78,0.15)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(M, y);
  ctx.lineTo(W - M, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Lignes d'articles
  y += 56;
  for (const it of t.items) {
    ctx.fillStyle = '#0d2b4e';
    ctx.font = '28px -apple-system, Helvetica, Arial, sans-serif';
    const price = eur(it.qty * Number(it.unit_price));
    const priceW = ctx.measureText(price).width;
    const name = `${it.qty} × ${it.name}${it.label ? ` (${it.label})` : ''}`;
    ctx.fillText(truncate(ctx, name, W - 2 * M - priceW - 24), M, y);
    ctx.fillText(price, W - M - priceW, y);
    y += lineH;
  }

  // Séparateur + total
  ctx.strokeStyle = 'rgba(13,43,78,0.15)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(M, y - 14);
  ctx.lineTo(W - M, y - 14);
  ctx.stroke();
  ctx.setLineDash([]);

  y += 34;
  ctx.font = 'bold 40px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#0d2b4e';
  ctx.fillText('TOTAL', M, y);
  const totalTxt = eur(t.total);
  ctx.fillStyle = '#257ceb';
  ctx.fillText(totalTxt, W - M - ctx.measureText(totalTxt).width, y);

  ctx.font = '26px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(13,43,78,0.6)';
  ctx.fillText(`Paiement : ${methodLabel(t.method)}`, M, y + 46);

  ctx.font = 'italic 26px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(13,43,78,0.45)';
  ctx.fillText('Merci pour votre achat !', M, y + 96);

  // Export + partage
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b as Blob), 'image/png'));
  const file = new File([blob], `ticket-${t.number}.png`, { type: 'image/png' });

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Ticket #${t.number}` });
      return;
    } catch {
      /* partage annulé → téléchargement */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ticket-${t.number}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

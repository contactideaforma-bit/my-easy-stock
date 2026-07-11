import { NextRequest, NextResponse } from 'next/server';

/**
 * Analyse d'un bon d'achat fournisseur (photo ou fichier).
 * L'image est envoyée à l'API Anthropic (vision) qui en extrait les lignes :
 * référence, désignation, taille, couleur, quantité, prix unitaire.
 *
 * Nécessite la variable d'environnement ANTHROPIC_API_KEY
 * (local : .env.local — Vercel : Settings → Environment Variables).
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const EXTRACTION_PROMPT = `Tu analyses la photo d'un bon d'achat / bon de commande / facture fournisseur (textile ou chaussures, en français le plus souvent).

Extrais chaque ligne d'article et réponds UNIQUEMENT avec un JSON valide, sans texte autour, au format :
{
  "supplier": "nom du fournisseur ou null",
  "date": "date du document (AAAA-MM-JJ) ou null",
  "lines": [
    {
      "reference": "référence/SKU/code-barres de la ligne ou null",
      "designation": "désignation de l'article",
      "size": "taille/pointure ou null",
      "color": "couleur ou null",
      "qty": nombre de pièces (entier),
      "unit_cost": prix unitaire HT en euros (nombre) ou null
    }
  ]
}

Règles :
- Une ligne par combinaison article/taille/couleur si le bon les détaille.
- Si seul un total de ligne est indiqué, calcule unit_cost = total / qty.
- N'invente rien : mets null quand l'information n'apparaît pas.
- Si l'image n'est pas un document d'achat lisible, réponds {"supplier":null,"date":null,"lines":[]}.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Clé API manquante : ajoutez ANTHROPIC_API_KEY dans les variables d'environnement (Vercel ou .env.local)." },
      { status: 500 }
    );
  }

  let body: { image?: string; media_type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  const { image, media_type } = body;
  if (!image || !media_type) {
    return NextResponse.json({ error: 'Image manquante.' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type, data: image } },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `Analyse impossible (API ${res.status}). ${detail.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const text: string = (data.content || []).map((b: any) => b.text || '').join('');
    // Récupère le premier objet JSON de la réponse
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Le document n'a pas pu être interprété." }, { status: 422 });
    }
    const parsed = JSON.parse(match[0]);
    const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
    return NextResponse.json({
      supplier: parsed.supplier ?? null,
      date: parsed.date ?? null,
      lines: lines
        .filter((l: any) => l && l.designation && Number(l.qty) > 0)
        .map((l: any) => ({
          reference: l.reference ?? null,
          designation: String(l.designation),
          size: l.size ?? null,
          color: l.color ?? null,
          qty: Math.max(1, Math.floor(Number(l.qty) || 1)),
          unit_cost: l.unit_cost != null ? Number(l.unit_cost) : null,
        })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Erreur d'analyse : ${e?.message || e}` }, { status: 500 });
  }
}

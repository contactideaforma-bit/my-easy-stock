# MyEasy SEO — by IDEA · MyEasyDev

Outil SEO pour les sites d'IDEA et, à terme, ceux de ses clients.
Next.js 14 (App Router) · Supabase · Vercel · Claude (Anthropic). Thème « verre liquide » clair.

## Fonctions
- **Tableau de bord** : tous les sites suivis avec leur score.
- **Audit** (jusqu'à 30 pages, ~40 s) : HTTPS, robots.txt, sitemap, erreurs HTTP, noindex, viewport, langue, canonical, temps de réponse, données structurées, title/meta (absence, longueur, doublons), H1, contenu mince, alt des images, Open Graph, maillage interne + vitesse mobile Google PageSpeed. Score global et par catégorie, historique.
- **Analyse rapide** : diagnostic d'un site prospect/concurrent sans l'enregistrer (bouton « Suivre ce site »).
- **Mots-clés** : suivi des positions (automatique avec Serper, sinon saisie manuelle), évolution.
- **Assistant IA** : synthèse d'audit pour le client, balises title/meta, idées de mots-clés, brief de contenu, question libre. Historique conservé.
- **Rapport client** imprimable / PDF.

## Données
Tables `seo_*` (migration `supabase/migrations/200_seo_tool.sql`), protégées par RLS : chaque site appartient à son créateur ;
`seo_site_members` permettra plus tard de donner un accès lecture/édition à un client.

## Anciens projets (masqués, pas supprimés)
- My Easy Stock → branche `archive/my-easy-stock`
- My Assistanad → branche `archive/my-assistanad` (+ tag `my-assistanad-final`)
Leurs tables Supabase (`products…`, `mya_*`) sont intactes.

## Variables d'environnement
Voir `.env.local.example`.

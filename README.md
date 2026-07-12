# My Easy Stock 💎

Gestion de stock **textile & chaussures** pour grossiste — mobile-first, thème clair translucide « reflets d'eau », bleu cristallin léger.

## Fonctionnalités

- **Catalogue** : produits avec photo, marque, catégorie, déclinaisons taille × couleur générées automatiquement
- **Code-barres** : EAN-13 généré pour chaque variante, étiquettes imprimables, scan caméra mobile
- **Vendeurs & lots en dépôt** : création de vendeurs, remise de lots (le stock passe du dépôt au vendeur), reprise de marchandise, vue « qui détient quoi »
- **Caisse** : vente sur le stock du dépôt **ou** d'un vendeur, scan ou recherche, espèces (calcul de monnaie) / carte / crédit client
- **Tableau de bord** : ventes du mois (nombre + montant), classement par vendeur, stock dépôt / chez les vendeurs, alertes stock bas
- **Inventaire** : session de comptage par scan, calcul des écarts, correction automatique du stock
- **Clients** : ardoise crédit, règlements, historique
- **Fournisseurs** : commandes d'achat, réception = entrée en stock
- **Stats** : CA, marge brute, graphique journalier, top produits
- **Multi-utilisateurs** : rôles admin / vendeur (1er compte créé = admin)
- Installable sur l'écran d'accueil du téléphone (PWA)

## Installation

### 1. Supabase
1. Créer un projet sur [supabase.com](https://supabase.com)
2. **SQL Editor → New query** : exécuter toutes les migrations de `supabase/migrations/` dans l'ordre (001 → 008)
3. **Authentication** : désactiver *Allow new users to sign up* (comptes créés uniquement par l'admin via le dashboard) et *Confirm email*
4. **Settings → API** : copier `Project URL` et `anon public key`

### 2. Local (VSCode)
```bash
cp .env.local.example .env.local   # y coller vos 2 clés Supabase
npm install
npm run dev
```

### 3. GitHub + Vercel
1. Créer un repo GitHub `my-easy-stock`, pousser le code (voir bloc push)
2. Sur [vercel.com](https://vercel.com) : **Import** le repo
3. Ajouter les 2 variables d'environnement `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy** — l'app est en ligne, le client l'ajoute à son écran d'accueil 📲

> ⚠️ Le scan caméra nécessite HTTPS : il fonctionne sur Vercel et sur `localhost`, pas en IP locale.

## Confidentialité : 1 compte = 1 boutique

Depuis la migration 008, **chaque compte est cloisonné** : ses produits, ventes, clients, vendeurs et son profil société n'appartiennent qu'à lui et sont invisibles des autres comptes (sécurité appliquée par la base, Row Level Security). Un nouveau compte démarre avec sa propre boutique vide (catégories de base pré-créées).

## Compte de démonstration

1. Supabase → Authentication → Users → **Add user** : créer le compte démo (ex. `demo@votre-domaine.fr`) — cocher « Auto Confirm User »
2. Ouvrir `supabase/seed_demo.sql`, remplacer l'email en haut du script par celui du compte démo, puis l'exécuter dans le SQL Editor — la boutique fictive « Maison Riviera » (10 références grossiste × ~300 déclinaisons, ≈6 900 pièces, 12 clients, 6 revendeurs, 48 ventes, achats) est créée **dans ce compte uniquement**, sans toucher aux autres
3. Transmettre les identifiants au prospect, puis changer le mot de passe après la démo : Authentication → Users → utilisateur demo → « ⋯ » → Update password

## Stack
Next.js 14 (App Router) · Tailwind CSS · Supabase (Postgres + Auth + Storage) · ZXing (scan) · JsBarcode (étiquettes) · Vercel

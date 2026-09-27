# My Assistanad

Assistante personnelle et suivi des paiements pour cabinet comptable — by IDEAFORMA.

Tout le cabinet au même endroit : clients, demandes entrantes, tâches, agenda, factures d'honoraires, et **relances de paiement qui partent toutes seules**.

## Ce que fait l'appli

- **Ma journée** : RDV du jour et du lendemain, tâches en retard / du jour, demandes en attente, argent à encaisser, impayés de plus de 30 jours à appeler
- **Demandes** : chaque appel, mail, WhatsApp ou passage noté en 10 secondes (touche **N** sur ordinateur), priorité, responsable, transformable en tâche
- **Tâches** : échéances, priorités, par collaborateur ; les tâches répétées (TVA mensuelle, paies, bilans) se recréent seules une fois cochées
- **Agenda** : vue semaine, couleur par collaborateur, **rappel automatique au client la veille** (email + SMS), confirmation WhatsApp en 1 clic
- **Clients** : fiche dossier complète (SIREN, régimes, clôture, mission, honoraires), fil de suivi de tous les échanges, délai moyen de paiement et étiquette bon / lent / mauvais payeur
- **Factures d'honoraires** : numérotation continue légale, paiements partiels, page publique de la facture (consultation, impression PDF, IBAN, lien de paiement)
- **Honoraires récurrents** : les factures mensuelles / trimestrielles / annuelles sont préparées (ou envoyées) automatiquement
- **Relances** : scénario en 4 étapes modifiable (J-3 courtois → J+3 → J+10 ferme → J+25 avant mise en demeure), email + SMS automatiques, WhatsApp en 1 clic, pause par facture ou par client, journal complet. Si une relance ne peut pas partir (pas d'email…), une tâche est créée : rien ne passe à la trappe
- **Programme du jour** envoyé par email à 8 h à chaque membre
- **Équipe** : titulaire + collaborateurs, chacun ses tâches / demandes / RDV ; données cloisonnées par cabinet (Row Level Security)

## Installation

### 1. Supabase (même projet que My Easy Stock)
1. **SQL Editor → New query** : coller et exécuter `supabase/migrations/100_my_assistanad.sql`.
   Les tables sont préfixées `mya_` : les anciennes tables de My Easy Stock restent intactes.
2. **Authentication → Users → Add user** : créer le compte de la comptable (cocher *Auto Confirm User*).
3. **Settings → API** : copier `Project URL`, `anon public` et `service_role` (secrète).

### 2. Emails et SMS
- **Emails** : créer un compte sur [resend.com](https://resend.com), vérifier le domaine d'envoi (ex. `cabinet-nad.fr`), créer une clé API. Gratuit jusqu'à 3 000 emails / mois.
- **SMS** : compte [brevo.com](https://brevo.com) → SMS → acheter un pack de crédits, créer une clé API.

### 3. Vercel
Dans le projet Vercel existant → **Settings → Environment Variables**, ajouter :

| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | déjà présente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | déjà présente |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` |
| `NEXT_PUBLIC_APP_URL` | l'adresse de l'appli, ex. `https://my-assistanad.vercel.app` |
| `RESEND_API_KEY` | clé Resend |
| `MAIL_FROM` | `Cabinet Nad <relances@cabinet-nad.fr>` |
| `BREVO_API_KEY` | clé Brevo |
| `CRON_SECRET` | une longue phrase au hasard |

Puis pousser sur `main` : Vercel redéploie. Le fichier `vercel.json` programme la tâche quotidienne à 6 h UTC (8 h à Paris en été, 7 h en hiver).

### 4. Premier lancement
La comptable se connecte → elle nomme son cabinet → **Paramètres** : IBAN, adresse, SIRET, logo → **Équipe** : ajout des collaborateurs → **Clients** : création des dossiers avec leurs honoraires.

Tester la tâche quotidienne à la main : ouvrir `https://…/api/cron/daily?secret=VOTRE_CRON_SECRET`.

## Local
```bash
cp .env.local.example .env.local   # compléter les clés
npm install
npm run dev
```

## My Easy Stock (archivé)
Le code est conservé sur la branche `archive/my-easy-stock` (tag `my-easy-stock-v1`).
Pour le retrouver : `git checkout archive/my-easy-stock`.

## Stack
Next.js 14 (App Router) · Tailwind CSS · Supabase (Postgres + Auth + RLS) · Resend (email) · Brevo (SMS) · Vercel (hébergement + Cron)

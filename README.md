# FLOW VL PAVA — ACX Flow

Facturation mensuelle **Videotron PAV Affaire** (VL PAV Affaire).
Thème **Glassy V22** repris de Juridique (`Formajob/juridique`).

## Ce qui est inclus

- `src/styles/glass.css` — thème Glassy V22 (724 lignes, copie exacte Juridique)
- `src/styles/globals.css` — tokens Flow (navy `#0b1330`, cyan `#26d4ea`, Inter)
- `src/app/layout.tsx` — fusion : metadata « ACX Flow » + `body.g-body` + bloc `.g-aurora`
- `src/components/layout/Sidebar.tsx` — menu portable (prop), SVG inline, Suspense
- `src/components/layout/RoleLayout.tsx` — coquille `g-app`
- `src/app/admin/page.tsx` — tableau de bord (g-top, g-hero, g-kpis, g-kpi, g-grid-2, g-card, g-list, g-bars, g-table, g-badge, g-btn)
- `src/app/login/page.tsx` — login autonome `lg-autonome-v6`
- `src/app/page.tsx` — `redirect('/login')`
- `src/lib/pava-store.ts` — lignes sept./oct. 2026, Price Plan, détection automatique des incohérences
- `src/lib/pava-menu.ts` — 8 onglets : Tableau de bord, Réception, Analyse, Règles, Contrôle, Validation, Factures, Administration

## Lancer en local

Prérequis : Node.js 18+

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000 → redirection `/login` → accès démo `/admin`.

Vérifications avant de livrer :

```bash
npx tsc --noEmit
npm run build
```

## Mettre sur GitHub (nouveau dépôt)

1. Dézipper le dossier sur ton PC.
2. Créer un nouveau dépôt vide sur GitHub (ex. `Formajob/pava`), **sans** README, sans licence.
3. Dans le dossier du projet :

```bash
git init
git add .
git commit -m "FLOW VL PAVA — thème Glassy V22"
git branch -M main
git remote add origin https://github.com/Formajob/pava.git
git push -u origin main
```

> Ne jamais faire `git push` sans demande explicite. Ne jamais committer de `.env` ni de clé.

## Déployer sur Vercel

1. Aller sur https://vercel.com → **Add New → Project**.
2. Choisir le dépôt GitHub `Formajob/pava` → **Import**.
3. Réglages :
   - Framework Preset : **Next.js**
   - Build Command : `npm run build` (par défaut)
   - Output Directory : `.next` (par défaut)
4. **Deploy**. Vercel détecte Next.js automatiquement.
5. Si des variables d'environnement sont nécessaires plus tard, les ajouter dans **Settings → Environment Variables** (jamais dans Git).

> Ne pas déployer sans demande explicite.

## Base de données Supabase (base partagée « flow »)

La base **flow** contient aussi les tables des autres clients Flow — toutes les tables PAVA sont donc **préfixées `pava_`**.

1. Ouvrir Supabase → projet de la base **flow** → **SQL Editor**.
2. Coller le contenu de `supabase/migrations/001_pava_tables.sql` et **Run**. Le script est idempotent (relançable).
3. Tables créées :
   - `pava_commandes` — commandes de facture (nom obligatoire, mois, statut, étape)
   - `pava_fichiers` — fichiers Excel/CSV importés par commande
   - `pava_lignes` — data importés, ligne Excel d'origine conservée (`brut` JSONB), ligne de total exclue des calculs
   - `pava_decisions` — décisions sur incohérences, uniques par (commande, réf) pour ne pas re-flagger
   - `pava_historique` — historique de chaque modification sur la commande
   - `pava_params` — Price Plan et paramètres de règles éditables (une ligne globale + une par commande)
   - `pava_versions` — version du fichier Excel à chaque étape (bucket Storage `pava-exports`)
4. RLS activé sur toutes les tables sans policy : seul le serveur (SERVICE_ROLE_KEY) y accède pour l'instant ; contrôle d'accès fin plus tard.
5. Règle métier : une commande `validee` (Directeur) ne peut **pas** être supprimée (trigger SQL).
6. Renseigner `.env.local` (voir `.env.example`) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

> Testé sur PostgreSQL 17 : création, idempotence, cascade, trigger de suppression interdite, unicité des décisions, RLS.

## Brancher l'application sur Supabase

L'application enregistre maintenant les données dans la base (et non plus en localStorage) dès que les variables Supabase sont définies. Sans variables, elle retombe automatiquement sur le mode démo.

1. Supabase → projet de la base **flow** → **Project Settings → API** :
   - `Project URL` → c'est `NEXT_PUBLIC_SUPABASE_URL`
   - `service_role` (secret) → c'est `SUPABASE_SERVICE_ROLE_KEY`
2. À la racine du projet, créer `.env.local` (jamais dans Git) :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
3. Relancer le serveur : `npm run dev` (les variables sont lues au démarrage).
4. Vérifier : `/admin/importation` doit afficher « Chargement des commandes depuis la base… » puis aucune commande — les données viennent de la base.

Routes API créées (serveur uniquement, clé service_role jamais exposée au navigateur) :

| Route | Rôle |
|---|---|
| `GET /api/pava/state` | état complet (commandes + paramètres) |
| `POST /api/pava/commandes` | créer une commande (nom obligatoire) |
| `GET/PATCH/DELETE /api/pava/commandes/[id]` | commande complète / statut+étape / suppression (bloquée si validée) |
| `POST /api/pava/commandes/[id]/fichiers` | import : fichier + lignes par lots de 500 |
| `PUT /api/pava/commandes/[id]/decisions` | décision sur incohérence (upsert, pas de re-flag) |
| `POST /api/pava/commandes/[id]/historique` | tracer une action |
| `POST /api/pava/commandes/[id]/versions` | tracer une version Excel par étape |
| `PATCH/DELETE /api/pava/lignes/[id]` | corriger / supprimer une ligne |
| `GET/PUT /api/pava/params` | Price Plan + règles |

Sur Vercel : **Settings → Environment Variables** → ajouter les deux mêmes variables, puis **Redeploy**.

## Règles

- Ordre des imports CSS : `globals.css` puis `glass.css`.
- Une page hors RoleLayout porte `position:relative; z-index:1; isolation:isolate` sur son conteneur.
- L'Analyste importe et analyse sans voir les montants finaux. L'Admin et le Directeur voient tout.
- Validation mensuelle en deux niveaux : Admin puis Directeur.
- Septembre 2026 = facture validée. Octobre 2026 = facture en cours.

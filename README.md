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

## Règles

- Ordre des imports CSS : `globals.css` puis `glass.css`.
- Une page hors RoleLayout porte `position:relative; z-index:1; isolation:isolate` sur son conteneur.
- L'Analyste importe et analyse sans voir les montants finaux. L'Admin et le Directeur voient tout.
- Validation mensuelle en deux niveaux : Admin puis Directeur.
- Septembre 2026 = facture validée. Octobre 2026 = facture en cours.

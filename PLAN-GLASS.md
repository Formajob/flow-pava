# FLOW VL PAVA — Thème Glassy V22 appliqué ✅

*Produit cible : FLOW VL PAVA (facturation VL PAV Affaire, Videotron).*
*Source : `Formajob/juridique` branche `main` — 5 fichiers lus en entier via raw.githubusercontent.com.*

## Contrôles validés
- `glass.css` : 724 lignes, `:root` avec `--g-blue:#2563eb`, `--g-cyan:#0891b2`, `--g-violet:#7c3aed`, `--g-navy:#0b1330`, `--g-paper:#e6eeff`
- `layout.tsx` : `className="g-body"` et bloc `.g-aurora`
- `Sidebar.tsx` : imports `@/lib/menu`, `@/lib/workflow-store`, `@/components/brand/FlowBrand`
- `login/page.tsx` : `SIGNATURE-LOGIN: lg-autonome-v6` et `<meta name="acx-login" ...>`
- `page.tsx` : `redirect('/login')`

## Fichiers créés (appliqués)
- `src/styles/glass.css` — copie exacte des 724 lignes Juridique
- `src/styles/globals.css` — tokens Flow (copie Juridique, 919 lignes)
- `src/app/layout.tsx` — fusion : metadata PAVA + SessionProvider + imports globals puis glass + `body.g-body` + bloc `.g-aurora`
- `src/components/layout/Sidebar.tsx` — portable, menu en prop, SVG inline, Suspense inclus
- `src/components/layout/RoleLayout.tsx` — coquille `g-app` + Suspense, fond déjà rendu par layout
- `src/components/brand/FlowBrand.tsx` — logo + « By ACX Maroc »
- `src/components/providers/session-provider.tsx` — stub local (brancher next-auth en prod)
- `src/app/admin/page.tsx` — tableau de bord PAVA, classes g- (g-top, g-hero, g-kpis, g-kpi, g-grid-2, g-card, g-list, g-bars, g-table, g-badge, g-btn), montants masqués pour l'Analyste
- `src/app/admin/layout.tsx` — RoleLayout
- `src/app/login/page.tsx` — copie du login Juridique, textes PAVA, signature `lg-autonome-v6` conservée
- `src/app/page.tsx` — `redirect('/login')`
- `src/lib/pava-store.ts` — lignes sept./oct., Price Plan, détection automatique (même logique que la démo)
- `src/lib/pava-menu.ts` — 8 onglets PAVA passés en prop au Sidebar
- `public/acx-flow-logo-light.png`, `public/acx-flow-logo-transparent.png` — logos

## Fichiers modifiés (fusion, jamais écrasement)
- `src/app/layout.tsx` : gardé metadata PAVA + SessionProvider, ajouté imports globals puis glass, `body.g-body`, bloc `.g-aurora`
- `src/styles/globals.css` : tokens Flow conservés

## À ne surtout pas copier (non copiés)
- `src/lib/menu.ts`, `src/lib/workflow-store.ts`, `src/lib/workflow-branch.ts`, `src/lib/demo-*.ts` (métier Juridique)
- `src/app/admin/dossiers/*`, `src/app/juriste/*`, `src/app/assistant/*` (routes Juridique)
- `src/components/dossiers/*`, `src/components/presence/*` (composants Juridique)
- `supabase/migrations/*` (schéma Juridique)
- Tout `.env`, toute clé, tout mot de passe

## Vérifications
- `npx tsc --noEmit` : OK (après ajout de `next-auth`)
- `npm run build` : OK — routes `/`, `/admin`, `/login`
- Ordre des imports CSS = globals puis glass
- Page hors RoleLayout (login) : `position:relative; z-index:1; isolation:isolate` via `.lg` + masquage `.g-aurora`
- Aucun déploiement, aucun push

## Lancer en local
```
cd flow-pava-next
npm install
npm run dev
```
Puis ouvrir http://localhost:3000 → redirection `/login` → accès démo `/admin`.

-- ============================================================
-- FLOW VL PAVA — 003 : lignes en blob par fichier (fin de la
-- table ligne-par-ligne pava_lignes)
-- ============================================================
-- Pourquoi : un import mensuel contient ~3 500 lignes. Les
-- stocker une par une dans une table gonfle la base (3 500
-- rangées par commande) et ralentit les chargements.
--
-- Nouveau modèle :
--   pava_fichiers.contenu  : toutes les lignes du fichier dans
--                            UN SEUL champ JSON (1 rangée par
--                            fichier importé, ligne source `brut`
--                            conservée dedans)
--   pava_corrections       : petites retouches par ligne
--                            (overlay, UNIQUE commande+ligne)
--   pava_commandes.stats   : totaux pré-calculés (le tableau de
--                            bord n'a plus besoin des lignes)
--
-- Le state de l'application ne charge plus les lignes de toutes
-- les commandes : elles sont lues à la demande, commande par
-- commande (GET /api/pava/commandes/[id]/lignes).
--
-- À exécuter dans Supabase → SQL Editor (base « flow »),
-- après 001 et 002.
-- ============================================================

-- 1. Le blob de lignes sur le fichier importé
ALTER TABLE pava_fichiers ADD COLUMN IF NOT EXISTS contenu JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Totaux pré-calculés sur la commande
ALTER TABLE pava_commandes ADD COLUMN IF NOT EXISTS stats JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Corrections d'une ligne (overlay, jamais 3 500 rangées)
CREATE TABLE IF NOT EXISTS pava_corrections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id  UUID NOT NULL REFERENCES pava_commandes(id) ON DELETE CASCADE,
  ligne_ref    TEXT NOT NULL,
  patch        JSONB NOT NULL DEFAULT '{}'::jsonb,
  supprime     BOOLEAN NOT NULL DEFAULT FALSE,
  date_maj     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE pava_corrections ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS pava_corrections_uniq ON pava_corrections (commande_id, ligne_ref);

-- 4. Migration des données existantes : pava_lignes → blob par fichier
--    (clés camelCase, même forme que ce que l'application envoie)
UPDATE pava_fichiers f
SET contenu = COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
      'id', l.id::text,
      'mois', l.mois, 'feuille', l.feuille, 'ligneExcel', l.ligne_excel,
      'compte', l.compte, 'produit', l.produit, 'famille', l.famille, 'type', l.type,
      'desc', l.desc_service, 'categorie', l.categorie, 'source', l.source,
      'puissance', l.puissance, 'quantite', l.quantite,
      'montantOrigine', l.montant_origine, 'montantCalcule', l.montant_calcule,
      'ajustement', l.ajustement, 'statut', l.statut, 'incoherence', l.incoherence,
      'incomplet', CASE WHEN l.incomplet THEN 'Grille incomplète' ELSE '' END,
      'brut', l.brut
    ) ORDER BY l.ligne_excel NULLS LAST
  ) FROM pava_lignes l WHERE l.fichier_id = f.id
), '[]'::jsonb);

-- 5. Stats initiales des commandes existantes (depuis les blobs)
WITH el AS (
  SELECT f.commande_id,
         l,
         COALESCE((l->>'quantite')::int, 1) AS q,
         COALESCE((l->>'montantCalcule')::numeric, 0) + COALESCE((l->>'ajustement')::numeric, 0) AS m,
         COALESCE((l->>'montantOrigine')::numeric, 0) AS mo,
         (COALESCE(l->>'incoherence', '') <> '' OR COALESCE(l->>'incomplet', '') <> '') AS inco
  FROM pava_fichiers f
  CROSS JOIN LATERAL jsonb_array_elements(f.contenu) l
),
parcat AS (
  SELECT commande_id, l->>'categorie' AS cat, sum(q) AS n, sum(m) AS m
  FROM el GROUP BY 1, 2
)
UPDATE pava_commandes c
SET stats = jsonb_build_object(
  'nbLignes',       (SELECT count(*) FROM el WHERE commande_id = c.id),
  'totalFacture',   (SELECT COALESCE(sum(mo), 0) FROM el WHERE commande_id = c.id),
  'totalCalcule',   (SELECT COALESCE(sum(m), 0) FROM el WHERE commande_id = c.id),
  'nbIncoherences', (SELECT count(*) FROM el WHERE commande_id = c.id AND inco),
  'parCategorie',   COALESCE((SELECT jsonb_object_agg(cat, jsonb_build_object('n', n, 'm', m))
                              FROM parcat WHERE commande_id = c.id), '{}'::jsonb)
)
WHERE EXISTS (SELECT 1 FROM pava_fichiers f WHERE f.commande_id = c.id);

-- 6. La table ligne-par-ligne n'est plus utilisée par l'application
DROP TABLE IF EXISTS pava_lignes;
-- Fin 003

-- ============================================================
-- FLOW VL PAVA — Schéma Supabase (base partagée « flow »)
-- ============================================================
-- IMPORTANT : la base « flow » contient les tables des autres
-- clients Flow. Toutes les tables PAVA sont donc préfixées
-- « pava_ » pour éviter toute collision.
--
-- À exécuter dans Supabase → SQL Editor sur la base « flow ».
-- Script idempotent : relançable sans erreur.
--
-- Sécurité : RLS activé sur toutes les tables, sans policy.
--   → anon / authenticated ne peuvent rien lire ni écrire.
--   → l'application passe par la SERVICE_ROLE_KEY (serveur
--     Next.js uniquement), qui contourne le RLS.
--   → le contrôle d'accès fin (rôles Admin/Directeur/Analyste)
--     sera ajouté plus tard dans les routes API.
--
-- Règle métier : une commande validée par le Directeur ne peut
-- pas être supprimée (trigger pava_commandes avant DELETE).
-- ============================================================

-- ─── Table: pava_commandes ───────────────────────────────────────────────
-- Chaque facture = une commande / entrée / projet avec historique.
CREATE TABLE IF NOT EXISTS pava_commandes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom           TEXT NOT NULL,                              -- « Facture Novembre », « facture_test »… (obligatoire)
  mois          TEXT,                                      -- '2026-10'
  statut        TEXT NOT NULL DEFAULT 'en_cours',          -- en_cours | valide_admin | validee
  etape         TEXT NOT NULL DEFAULT 'importation',       -- importation | analyse | controle | regles | validation | factures
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_maj      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cree_par      TEXT,
  CONSTRAINT pava_commandes_statut_chk CHECK (statut IN ('en_cours', 'valide_admin', 'validee'))
);

CREATE INDEX IF NOT EXISTS pava_commandes_statut_idx ON pava_commandes (statut);
CREATE INDEX IF NOT EXISTS pava_commandes_nom_idx    ON pava_commandes (nom);

-- ─── Table: pava_fichiers ────────────────────────────────────────────────
-- Fichiers Excel/CSV importés pour une commande.
CREATE TABLE IF NOT EXISTS pava_fichiers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id  UUID NOT NULL REFERENCES pava_commandes(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,                              -- nom du fichier importé
  feuilles     TEXT[] NOT NULL DEFAULT '{}',               -- feuilles détectées (format/nature)
  nb_lignes    INTEGER NOT NULL DEFAULT 0,
  mois         TEXT,
  date_import  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  importe_par  TEXT
);

CREATE INDEX IF NOT EXISTS pava_fichiers_commande_idx ON pava_fichiers (commande_id);

-- ─── Table: pava_lignes ──────────────────────────────────────────────────
-- « Data importés » : lignes normalisées + ligne Excel d'origine conservée
-- pour traçabilité (brut = ligne source intacte, jamais modifiée).
CREATE TABLE IF NOT EXISTS pava_lignes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id      UUID NOT NULL REFERENCES pava_commandes(id) ON DELETE CASCADE,
  fichier_id       UUID REFERENCES pava_fichiers(id) ON DELETE SET NULL,
  mois             TEXT,
  feuille          TEXT,                                   -- feuille Excel d'origine
  ligne_excel      INTEGER,                                -- n° de ligne d'origine (traçabilité)
  compte           TEXT,                                   -- no_cli
  produit          TEXT,                                   -- CAB, TPC, CELL, REDO, TIPN, WIFIPRO…
  famille          TEXT,                                   -- INT, TEL, TSF…
  type             TEXT,                                   -- FORFAIT, EQUIPEMENT…
  desc_service     TEXT,                                   -- description / code service
  categorie        TEXT NOT NULL DEFAULT 'AJOUT',          -- AJOUT | RENOUVELLEMENT | SACA | NON_FACTUREE
  source           TEXT,                                   -- 43, 45, 41, 07
  puissance        TEXT,
  quantite         INTEGER NOT NULL DEFAULT 1,
  montant_origine  NUMERIC(12,2),                          -- montant facturé (ligne source)
  montant_calcule  NUMERIC(12,2),                          -- recalculé par le moteur (price plan)
  ajustement       NUMERIC(12,2) NOT NULL DEFAULT 0,       -- correction manuelle (Contrôle)
  statut           TEXT,                                   -- COMPLETEE, etc.
  incoherence      TEXT,                                   -- raison si incohérence
  incomplet        BOOLEAN NOT NULL DEFAULT FALSE,         -- grille incomplète (R10)
  ligne_total      BOOLEAN NOT NULL DEFAULT FALSE,         -- ligne de total : exclue des calculs
  brut             JSONB,                                  -- ligne source brute, intacte
  date_creation    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_maj         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pava_lignes_categorie_chk CHECK (categorie IN ('AJOUT', 'RENOUVELLEMENT', 'SACA', 'NON_FACTUREE'))
);

CREATE INDEX IF NOT EXISTS pava_lignes_commande_idx       ON pava_lignes (commande_id);
CREATE INDEX IF NOT EXISTS pava_lignes_tracabilite_idx    ON pava_lignes (commande_id, feuille, ligne_excel);
CREATE INDEX IF NOT EXISTS pava_lignes_famille_idx        ON pava_lignes (commande_id, famille);
CREATE INDEX IF NOT EXISTS pava_lignes_categorie_idx      ON pava_lignes (commande_id, categorie);
CREATE INDEX IF NOT EXISTS pava_lignes_incoherence_idx    ON pava_lignes (commande_id) WHERE incoherence IS NOT NULL;

-- ─── Table: pava_decisions ───────────────────────────────────────────────
-- Décisions sur les incohérences (valider / rejeter / ignorer / corriger).
-- unicité (commande, réf anomalie) ⇒ le même cas n'est pas re-flaggé
-- le mois suivant : la décision est conservée.
CREATE TABLE IF NOT EXISTS pava_decisions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id    UUID NOT NULL REFERENCES pava_commandes(id) ON DELETE CASCADE,
  ref_anomalie   TEXT NOT NULL,                            -- ex. 'R04|FAC PAVA|123'
  regle          TEXT,                                    -- R01…R13
  statut         TEXT NOT NULL DEFAULT 'ouvert',           -- ouvert | valide | rejete | ignore | corrige
  commentaire    TEXT NOT NULL DEFAULT '',                 -- obligatoire pour « ignorer »
  date_decision  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decide_par     TEXT,
  CONSTRAINT pava_decisions_statut_chk CHECK (statut IN ('ouvert', 'valide', 'rejete', 'ignore', 'corrige')),
  CONSTRAINT pava_decisions_unique UNIQUE (commande_id, ref_anomalie)
);

CREATE INDEX IF NOT EXISTS pava_decisions_commande_idx ON pava_decisions (commande_id);

-- ─── Table: pava_historique ──────────────────────────────────────────────
-- Historique complet : chaque modification (import, analyse, contrôle,
-- validation, export) est enregistrée sur la commande.
CREATE TABLE IF NOT EXISTS pava_historique (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  commande_id  UUID NOT NULL REFERENCES pava_commandes(id) ON DELETE CASCADE,
  date_action  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action       TEXT NOT NULL,
  auteur       TEXT,
  details      JSONB
);

CREATE INDEX IF NOT EXISTS pava_historique_commande_idx ON pava_historique (commande_id, date_action DESC);

-- ─── Table: pava_params ──────────────────────────────────────────────────
-- Price Plan + paramètres de règles, éditables (jamais codés en dur).
-- commande_id NULL = paramètres globaux par défaut (une seule ligne).
CREATE TABLE IF NOT EXISTS pava_params (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id  UUID REFERENCES pava_commandes(id) ON DELETE CASCADE,  -- NULL = global
  params       JSONB NOT NULL,                             -- PavaParams (price plan, n_mois, sources…)
  date_maj     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  maj_par      TEXT
);

-- Une seule ligne de params globale (NULL) + au plus une par commande :
CREATE UNIQUE INDEX IF NOT EXISTS pava_params_unique ON pava_params (COALESCE(commande_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS pava_params_commande_idx ON pava_params (commande_id);

-- ─── Table: pava_versions ────────────────────────────────────────────────
-- Version du fichier Excel de la commande à chaque étape du flux.
-- Le fichier lui-même va dans le bucket Storage « pava-exports »
-- (chemin_storage) ; ici on garde la trace des versions.
CREATE TABLE IF NOT EXISTS pava_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id    UUID NOT NULL REFERENCES pava_commandes(id) ON DELETE CASCADE,
  numero         INTEGER NOT NULL,                         -- 1, 2, 3… par commande
  etape          TEXT NOT NULL,                            -- importation | analyse | controle | regles | validation | factures
  nom_fichier    TEXT NOT NULL,                            -- « Facture Novembre.xlsx »
  nb_lignes      INTEGER,
  total_calcule  NUMERIC(12,2),
  chemin_storage TEXT,                                     -- ex. commandes/<id>/v3-analyse.xlsx
  date_version   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cree_par       TEXT,
  CONSTRAINT pava_versions_unique UNIQUE (commande_id, numero)
);

CREATE INDEX IF NOT EXISTS pava_versions_commande_idx ON pava_versions (commande_id, numero DESC);

-- ============================================================
-- RLS : activé partout, aucune policy → seul le service role
-- (serveur Next.js) accède aux données pour l'instant.
-- ============================================================
ALTER TABLE pava_commandes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pava_fichiers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pava_lignes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pava_decisions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pava_historique ENABLE ROW LEVEL SECURITY;
ALTER TABLE pava_params     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pava_versions   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- date_maj automatique sur UPDATE (commandes + lignes)
-- ============================================================
CREATE OR REPLACE FUNCTION pava_set_date_maj()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_maj = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pava_commandes_date_maj ON pava_commandes;
CREATE TRIGGER pava_commandes_date_maj BEFORE UPDATE ON pava_commandes
  FOR EACH ROW EXECUTE FUNCTION pava_set_date_maj();

DROP TRIGGER IF EXISTS pava_lignes_date_maj ON pava_lignes;
CREATE TRIGGER pava_lignes_date_maj BEFORE UPDATE ON pava_lignes
  FOR EACH ROW EXECUTE FUNCTION pava_set_date_maj();

-- ============================================================
-- Règle métier : interdiction de supprimer une commande
-- validée par le Directeur (contrôle d'accès fin plus tard).
-- Pour contourner (accès dédié) : repasser le statut à
-- « en_cours » d'abord, ou utiliser un rôle dédié plus tard.
-- ============================================================
CREATE OR REPLACE FUNCTION pava_bloque_suppression_validee()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.statut = 'validee' THEN
    RAISE EXCEPTION 'Commande « % » validée par le Directeur : suppression interdite.', OLD.nom;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pava_commandes_bloque_suppression ON pava_commandes;
CREATE TRIGGER pava_commandes_bloque_suppression BEFORE DELETE ON pava_commandes
  FOR EACH ROW EXECUTE FUNCTION pava_bloque_suppression_validee();

-- ============================================================
-- Bucket Storage « pava-exports » : fichiers Excel versionnés
-- par étape (nommés d'après la commande). Optionnel : ignore
-- l'erreur si le schéma storage n'est pas accessible.
-- ============================================================
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('pava-exports', 'pava-exports', FALSE)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN insufficient_privilege OR undefined_table THEN
    RAISE NOTICE 'Bucket pava-exports non créé (storage inaccessible) — à créer via le dashboard Supabase.';
END;
$$;

-- ============================================================
-- Données initiales : Price Plan global par défaut
-- (identique à DEFAULT_PARAMS dans src/lib/pava/types.ts).
-- ============================================================
INSERT INTO pava_params (commande_id, params, maj_par)
VALUES (
  NULL,
  '{
    "renouvellement": 65,
    "internet": { "15": 150, "100": 200, "200": 250, "400": 300, "500": 300, "Giga": 300 },
    "tpc": { "60": 150, "36": 100, "12": 100, "24": 100, "sans": 100 },
    "sim": 150,
    "tv": 100,
    "tipn": 100,
    "wifipro": 50,
    "redo": 40,
    "forfait5050": 200,
    "n_mois": 3,
    "demenagement_payable": false,
    "sources": ["43", "45", "41", "07"]
  }'::jsonb,
  'init'
)
ON CONFLICT DO NOTHING;
-- Fin du schéma PAVA

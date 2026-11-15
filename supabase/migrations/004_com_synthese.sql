-- ============================================================
-- FLOW VL PAVA — 004 : références de rapprochement (OPTIONNELLE)
-- ============================================================
-- ⚠️ NON REQUISE par le code actuel : les routes n'écrivent ni ne
-- lisent ces colonnes. À exécuter UNIQUEMENT quand le re-branchement
-- des règles R08 (fichier COM) et R12 (synthèse du sommaire) sera
-- fait — elles stockeront alors :
--   • com       : lignes du fichier COM importées comme RÉFÉRENCE
--   • synthese  : totaux lus sur la feuille sommaire du fichier
-- Idempotente (IF NOT EXISTS) : sans danger si exécutée plus tôt.
-- ============================================================

ALTER TABLE pava_fichiers ADD COLUMN IF NOT EXISTS com JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE pava_fichiers ADD COLUMN IF NOT EXISTS synthese JSONB;
-- Fin 004

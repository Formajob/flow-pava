-- ============================================================
-- FLOW VL PAVA — 004 : références de rapprochement
-- ============================================================
-- Active les contrôles qui étaient muets faute de données :
--   • com       : lignes du fichier COM importé comme RÉFÉRENCE
--                 (règle R08 : source 45 absente du COM, doublons COM)
--   • synthese  : totaux lus sur la feuille sommaire du fichier
--                 (règle R12 : recalculé vs synthèse du fichier)
-- Les feuilles COM / synthèse ne sont JAMAIS importées comme lignes
-- facturables — uniquement comme référence de contrôle.
-- À exécuter dans Supabase → SQL Editor (base « flow »).
-- ============================================================

ALTER TABLE pava_fichiers ADD COLUMN IF NOT EXISTS com JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE pava_fichiers ADD COLUMN IF NOT EXISTS synthese JSONB;
-- Fin 004

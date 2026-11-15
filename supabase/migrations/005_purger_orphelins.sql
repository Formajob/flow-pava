-- ============================================================
-- FLOW VL PAVA — 005 : hygiène base (OPTIONNELLE)
-- ============================================================
-- Utile si la base a été créée avant l'ajout des FK dans la
-- migration 001 : purge les orphelins puis restaure les clés
-- étrangères ON DELETE CASCADE. Termine par un rechargement du
-- cache de schéma PostgREST.
-- NON REQUISE par le code (les routes n'utilisent plus aucune
-- requête embarquée) — à exécuter seulement pour l'intégrité.
-- Idempotente : sans danger si réexécutée.
-- ============================================================

-- 1) Purger les lignes orphelines (commande supprimée sans cascade)
DELETE FROM pava_corrections WHERE commande_id IS NOT NULL AND commande_id NOT IN (SELECT id FROM pava_commandes);
DELETE FROM pava_decisions  WHERE commande_id IS NOT NULL AND commande_id NOT IN (SELECT id FROM pava_commandes);
DELETE FROM pava_historique WHERE commande_id IS NOT NULL AND commande_id NOT IN (SELECT id FROM pava_commandes);
DELETE FROM pava_versions   WHERE commande_id IS NOT NULL AND commande_id NOT IN (SELECT id FROM pava_commandes);
DELETE FROM pava_fichiers   WHERE commande_id IS NOT NULL AND commande_id NOT IN (SELECT id FROM pava_commandes);
DELETE FROM pava_params     WHERE commande_id IS NOT NULL AND commande_id NOT IN (SELECT id FROM pava_commandes);

-- 2) Restaurer les FK ON DELETE CASCADE (si absentes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pava_fichiers_commande_fk') THEN
    ALTER TABLE pava_fichiers   ADD CONSTRAINT pava_fichiers_commande_fk   FOREIGN KEY (commande_id) REFERENCES pava_commandes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pava_decisions_commande_fk') THEN
    ALTER TABLE pava_decisions  ADD CONSTRAINT pava_decisions_commande_fk  FOREIGN KEY (commande_id) REFERENCES pava_commandes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pava_corrections_commande_fk') THEN
    ALTER TABLE pava_corrections ADD CONSTRAINT pava_corrections_commande_fk FOREIGN KEY (commande_id) REFERENCES pava_commandes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pava_historique_commande_fk') THEN
    ALTER TABLE pava_historique ADD CONSTRAINT pava_historique_commande_fk FOREIGN KEY (commande_id) REFERENCES pava_commandes(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pava_versions_commande_fk') THEN
    ALTER TABLE pava_versions   ADD CONSTRAINT pava_versions_commande_fk   FOREIGN KEY (commande_id) REFERENCES pava_commandes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3) Recharger le cache de schéma PostgREST (Supabase)
NOTIFY pgrst, 'reload schema';

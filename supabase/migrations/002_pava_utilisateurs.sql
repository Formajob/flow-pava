-- ============================================================
-- FLOW VL PAVA — 002 : table des utilisateurs (accès + mots de passe)
-- ============================================================
-- Comme demandé : les accès sont gérés dans Supabase pour pouvoir
-- changer les mots de passe et ajouter des utilisateurs sans toucher
-- au code. À exécuter dans Supabase → SQL Editor (base « flow »).
--
-- Mots de passe : hash scrypt (format « scrypt$salt$hash »), jamais
-- en clair. Mot de passe par défaut des 3 comptes initiaux :
--     pava2026
-- À changer depuis la page Administration de l'application
-- (ou via l'API PATCH /api/pava/utilisateurs/[id]).
--
-- multi_roles = TRUE : l'utilisateur choisit son rôle à la connexion
-- (Analyste / Admin / Directeur) — c'est le cas de jawad@acx.ma.
-- RLS activé sans policy : seul le serveur (service role) y accède.
-- ============================================================

CREATE TABLE IF NOT EXISTS pava_utilisateurs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  nom           TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'analyste',
  multi_roles   BOOLEAN NOT NULL DEFAULT FALSE,
  mot_de_passe  TEXT,
  actif         BOOLEAN NOT NULL DEFAULT TRUE,
  date_creation TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_maj      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pava_utilisateurs_role_chk CHECK (role IN ('analyste', 'admin', 'directeur'))
);

ALTER TABLE pava_utilisateurs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS pava_utilisateurs_email_idx ON pava_utilisateurs (email);

-- date_maj automatique
CREATE OR REPLACE FUNCTION pava_set_date_maj()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_maj = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pava_utilisateurs_date_maj ON pava_utilisateurs;
CREATE TRIGGER pava_utilisateurs_date_maj BEFORE UPDATE ON pava_utilisateurs
  FOR EACH ROW EXECUTE FUNCTION pava_set_date_maj();

-- ============================================================
-- Comptes initiaux — mot de passe par défaut : pava2026
-- (hash scrypt, un sel différent par compte)
-- ============================================================
INSERT INTO pava_utilisateurs (email, nom, role, multi_roles, mot_de_passe) VALUES
(
  'jawad@acx.ma', 'Jawad', 'admin', TRUE,
  'scrypt$79ab59b6a10bbd0b042a66c202070c12$5fdf0a1b1dc3f4579dc8dbcf8fbfdf2f7892d4a64d7dff888d9d5f181036b64d3783b471ddc1c96fdc325d75adf1c903141fc91c20b56b50ca717d063470c0b9'
),
(
  'ghita.khalil@videotron.com', 'Ghita Khalil', 'analyste', FALSE,
  'scrypt$c93ac7d0cf7f6ffb3da1c97e97736127$b0a65903efa2f30dde6df0dbdecc2f94c6698b8e4325373bd458e51ce10238a335eadfeb40484f1a4d8b38c5125dd1902f89a2aa6bc761ba6d5b86adf6c300e1'
),
(
  'marzouk.ousmane@videotron.com', 'Marzouk Ousmane', 'directeur', FALSE,
  'scrypt$3f5af9135da639de6035f5dcb2271062$485d2218f8b494fdaac6c1872078be06dfc2770e2868e9679c4adf532ed0f2fd602a98cdc7d9e3b4e7583cc965930e71cd5c3bbfdb98916c4864ff771e51d5e5'
)
ON CONFLICT (email) DO NOTHING;
-- Fin 002

-- ═══════════════════════════════════════════════════════════════════
-- MISE À JOUR DES MOTS DE PASSE PAVA (audit sécurité C2)
-- ═══════════════════════════════════════════════════════════════════
-- Le mot de passe par défaut « pava2026 » est public (présent dans le dépôt).
-- Avant toute mise en production : exécuter ce script sur la base Supabase
-- (SQL Editor), puis transmettre chaque mot de passe à son propriétaire par
-- un canal SÉCURISÉ (jamais par e-mail en clair ni dans le dépôt).
-- Les mots de passe peuvent être changés ensuite depuis Gestion → Utilisateurs.
--
-- Hash : scrypt (64 octets, sel aléatoire 16 octets) — même format que
-- l'application (src/lib/pava/auth-db.ts).

UPDATE pava_utilisateurs SET mot_de_passe = 'scrypt$7ae02033261fba8e572b21915feac952$1c422b691d557625c715b6ecfa70557be39291fd983cd050982a68afdd7912f322021819fac6507a5e159c23a8ab44bf16467f3d11bdb454ed18d9280dd2f20f' WHERE email = 'jawad@acx.ma';
UPDATE pava_utilisateurs SET mot_de_passe = 'scrypt$d045618a245f6ed3be0fa379e37995c0$fafe05fd06cdadd751ce1cc80fa129dbf28d4ab8e325d0d570e83ca0a02e1abfcfd92bfa63f00d953ff039ee86dcace12f567f117b2017947a4fcb64e6811693' WHERE email = 'ghita.khalil@videotron.com';
UPDATE pava_utilisateurs SET mot_de_passe = 'scrypt$133037c66108940126062f856cf00b5d$cbc6c2e3ff97bc1646b12876f988d2a329267a5df1c4733726947422bd3c923f910d98e67a0b033de00941824be5c30deb97146e39f143f91f2a77fe0a9c8fb0' WHERE email = 'marzouk.ousmane@videotron.com';

-- ⚠ Si vos e-mails réels diffèrent (ex. prenom.nom@acx.ma), adaptez les WHERE
-- ci-dessus — les mots de passe restent valables.

-- Vérification : 3 lignes modifiées attendues.
SELECT email, role, actif, (mot_de_passe LIKE 'scrypt$%') AS hash_ok FROM pava_utilisateurs ORDER BY email;

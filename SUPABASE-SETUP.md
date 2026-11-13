# Brancher FLOW VL PAVA sur Supabase — guide pas à pas

## 1. Ouvrir la page des clés Supabase

1. Aller sur **https://supabase.com/dashboard**
2. Ouvrir le projet de la base **flow** (celui qui contient les tables `pava_*`)
3. Menu gauche en bas : **⚙️ Project Settings**
4. Onglet **API**

Tu vois trois choses sur cette page :

| Ce que tu vois | Ce que tu copies |
|---|---|
| **Project URL** (ex. `https://abcdefgh.supabase.co`) | → `NEXT_PUBLIC_SUPABASE_URL` |
| **Project API keys** → `anon` `public` | ❌ NON, pas celle-là |
| **Project API keys** → `service_role` (marqué `secret`) | → `SUPABASE_SERVICE_ROLE_KEY` |

> La clé `service_role` est masquée : clique sur **Reveal** (l'œil) pour l'afficher, puis copie-la en entier (elle est longue, commence par `eyJ...`).
>
> Si ta page affiche les « nouvelles » clés (`publishable` / `secret`) : c'est la clé **`secret`** (nouveau format, commence par `sb_secret_`) qu'il faut — elle remplace `service_role`.

## 2. Remplir le fichier .env.local

Le fichier `.env.local` est à la **racine du projet**, à côté de `package.json`.
Il contient déjà `NEXTAUTH_SECRET` (généré) — il reste 2 valeurs à coller :

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co      ← ton Project URL
SUPABASE_SERVICE_ROLE_KEY=eyJ...la longue clé secret...   ← ta clé service_role
```

Règles :
- **pas de guillemets**, **pas d'espace** autour du `=`
- tout sur **une seule ligne** par variable
- le fichier doit s'appeler exactement `.env.local` — pas `.env.local.txt`
  (dans l'Explorateur Windows : Affichage → cocher « Extensions de noms de fichiers »)

## 3. Redémarrer le serveur

Les variables ne sont lues **qu'au démarrage** :

```
Ctrl+C          (arrêter le serveur en cours)
npm run dev     (relancer)
```

## 4. Vérifier que c'est réglé

| Test | Résultat attendu |
|---|---|
| Ouvrir `http://localhost:3000/api/pauve/state`… correction : `/api/pava/state` | `{"commandes":[...],"params":{...}}` (pas d'erreur) |
| Bandeau en haut des pages admin | le bandeau rouge « Mode démo » a **disparu** |
| Administration | carte « Stockage des données » = **Base de données Supabase** (vert) |
| Créer une commande + importer un Excel | les lignes apparaissent dans Supabase → Table Editor → `pava_commandes`, `pava_fichiers`, `pava_lignes`, `pava_historique` |

## 5. Si tu testes sur Vercel (flow-pava.vercel.app)

Mêmes variables dans **Vercel → ton projet → Settings → Environment Variables** :

| Nom | Valeur |
|---|---|
| `NEXTAUTH_SECRET` | la même que dans ton `.env.local` |
| `NEXTAUTH_URL` | `https://flow-pava.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | ton Project URL Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ta clé service_role |

Puis **Deployments → … → Redeploy** (important : les variables ne s'appliquent qu'aux déploiements faits après leur ajout).

## 6. Gérer les accès et les mots de passe (table `pava_utilisateurs`)

Les comptes ne sont **plus dans le code** : ils sont dans la table Supabase `pava_utilisateurs`.

**a) Créer la table (une seule fois)** — Supabase → SQL Editor → coller le contenu de
`supabase/migrations/002_pava_utilisateurs.sql` → **Run**.
Le script crée la table et les 3 comptes existants :

| Adresse | Rôle | Mot de passe par défaut |
|---|---|---|
| `jawad@acx.ma` | Admin (+ Analyste/Directeur au choix) | `pava2026` |
| `ghita.khalil@videotron.com` | Analyste | `pava2026` |
| `marzouk.ousmane@videotron.com` | Directeur | `pava2026` |

**b) Changer un mot de passe ou ajouter un utilisateur** — connexion Admin → page
**Administration** → section « Comptes utilisateurs » :
- bouton **Mot de passe** : en définir un nouveau (6 caractères minimum) ;
- formulaire **Ajouter un utilisateur** : e-mail, nom, rôle (Analyste / Admin / Directeur),
  mot de passe, case **Multi-rôles** si la personne doit choisir son rôle à la connexion ;
- **Désactiver** bloque la connexion sans supprimer l'historique ; **Supprimer** retire le compte.

Les mots de passe sont stockés **hashés** (scrypt) — jamais en clair, et jamais affichés.
Un compte désactivé ou supprimé est refusé dès la connexion suivante.

**c) Sécurité** : la table est en RLS sans policy → inaccessible depuis l'extérieur avec la
clé anon ; seules les routes API du serveur (clé service_role) y touchent, et elles exigent
une session Admin. La gestion des comptes n'apparaît que pour l'Admin connecté.

> ⚠️ Après avoir exécuté le script SQL, les mots de passe deviennent obligatoires :
> `jawad@acx.ma / pava2026` pour la première connexion — **change-le ensuite**
> depuis la page Administration.

## 7. Erreurs connues

| Message | Cause | Solution |
|---|---|---|
| « There is a problem with the server configuration » | `NEXTAUTH_SECRET` absent (build de production / Vercel) | il est déjà dans le `.env.local` fourni — vérifier qu'il est bien chargé (redémarrer) |
| `/api/pava/state` répond « Supabase non configuré » | `.env.local` absent, mal nommé, ou serveur non redémarré | étapes 2 et 3 |
| Bandeau rouge « Mode démo » | `NEXT_PUBLIC_SUPABASE_URL` vide/faux | vérifier la valeur collée (étape 2) |
| Erreur 500 avec « Invalid API key » | la clé collée n'est pas `service_role` (anon) ou est tronquée | re-copier la clé complète |
| Rien dans les tables Supabase | app en mode démo au moment du test | refaire le test après connexion (étape 4) |

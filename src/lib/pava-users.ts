/**
 * Utilisateurs FLOW VL PAVA — accès par adresse e-mail.
 * La connexion n'accepte que ces adresses ; le rôle découle de l'adresse.
 *
 * Compte multi-rôles : jawad@acx.ma peut choisir son accès
 * (Analyste / Admin / Directeur) à la connexion et dans Administration.
 * Les autres adresses ont un rôle fixe.
 * (Mots de passe : démo pour l'instant — à brancher plus tard sur une
 * table pava_utilisateurs avec vrais mots de passe.)
 */

export type PavaRole = 'admin' | 'analyste' | 'directeur';

export interface PavaUser {
  email: string;
  nom: string;
  role: PavaRole;       // rôle par défaut
  roles: PavaRole[];    // rôles autorisés (plusieurs = sélection possible)
  titre: string;
}

export const UTILISATEURS_PAVA: PavaUser[] = [
  { email: 'jawad@acx.ma', nom: 'Jawad', role: 'admin', roles: ['analyste', 'admin', 'directeur'], titre: 'Admin · ACX Maroc' },
  { email: 'ghita.khalil@videotron.com', nom: 'Ghita Khalil', role: 'analyste', roles: ['analyste'], titre: 'Analyste · Videotron' },
  { email: 'marzouk.ousmane@videotron.com', nom: 'Marzouk Ousmane', role: 'directeur', roles: ['directeur'], titre: 'Directeur · Videotron' },
];

export const TITRE_ROLE: Record<PavaRole, string> = {
  admin: 'Admin',
  analyste: 'Analyste',
  directeur: 'Directeur',
};

/** Recherche insensible à la casse / aux espaces. */
export function trouverUtilisateur(email: string | null | undefined): PavaUser | null {
  const e = (email || '').trim().toLowerCase();
  if (!e) return null;
  return UTILISATEURS_PAVA.find((u) => u.email === e) || null;
}

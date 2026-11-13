import crypto from 'node:crypto';
import { getSupabase } from '@/lib/supabase';

/**
 * Authentification PAVA contre la table pava_utilisateurs (Supabase).
 * Mots de passe hashés en scrypt — format « scrypt$salt$hash ».
 * Utilisé uniquement côté serveur (route NextAuth + routes API).
 */

export interface UtilisateurDb {
  id: string;
  email: string;
  nom: string;
  role: 'analyste' | 'admin' | 'directeur';
  multi_roles: boolean;
  mot_de_passe: string | null;
  actif: boolean;
}

export function hasherMotDePasse(motDePasse: string): string {
  const sel = crypto.randomBytes(16);
  const hash = crypto.scryptSync(motDePasse, sel, 64);
  return `scrypt$${sel.toString('hex')}$${hash.toString('hex')}`;
}

export function verifierMotDePasse(motDePasse: string, stocke: string | null): boolean {
  if (!stocke) return true; // compte sans mot de passe défini : accès libre (transition)
  const parties = stocke.split('$');
  if (parties.length !== 3 || parties[0] !== 'scrypt') return false;
  try {
    const [, selHex, hashHex] = parties;
    const calcule = crypto.scryptSync(motDePasse, Buffer.from(selHex, 'hex'), 64);
    const attendu = Buffer.from(hashHex, 'hex');
    return calcule.length === attendu.length && crypto.timingSafeEqual(calcule, attendu);
  } catch {
    return false;
  }
}

/** Cherche un utilisateur actif par e-mail (insensible à la casse). */
export async function chercherUtilisateurDb(email: string): Promise<UtilisateurDb | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('pava_utilisateurs')
    .select('id, email, nom, role, multi_roles, mot_de_passe, actif')
    .ilike('email', email.trim())
    .eq('actif', true)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0] as UtilisateurDb;
}

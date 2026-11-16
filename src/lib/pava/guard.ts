import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export interface Acteur {
  email: string;
  role: string;
}

/** Utilisateur connecté (lu dans le jeton signé), ou null.
 * L'auteur d'une action ne vient JAMAIS du corps de la requête (audit M2). */
export async function acteurDe(req: NextRequest): Promise<Acteur | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  const token = await getToken({ req, ...(secret ? { secret } : {}) });
  if (!token?.email) return null;
  return { email: String(token.email), role: String(token.role || '') };
}

/** Erreur de base de données : détail dans les logs serveur, message générique
 * au navigateur (audit M6 — ne plus fuiter error.message / le schéma). */
export function msgDb(err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  console.error('[api pava] erreur base :', detail);
  return 'Erreur base de données — réessayez.';
}

/** Réponse 401 standard quand une route vérifie l'acteur elle-même. */
export function nonAuthentifie(): NextResponse {
  return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
}

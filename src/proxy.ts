import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Garde d'accès GLOBALE (Next 16 : « proxy », ex-middleware).
 * Aucune route /api/pava/* ni page /admin/* n'est joignable sans session valide
 * (correctif C1 de l'audit de sécurité : avant, seules les routes utilisateurs
 * vérifiaient la session — toutes les données étaient lisibles/modifiables sans
 * connexion). Les règles fines de rôles sont vérifiées ici pour les méthodes
 * sensibles, et dans les routes pour celles qui dépendent du corps.
 */
const ROLES_PARAMS = ['admin', 'directeur']; // modifier le price plan / les règles
const ROLES_SUPPRESSION = ['admin']; // supprimer une commande

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.NEXTAUTH_SECRET;
  const token = await getToken({ req, ...(secret ? { secret } : {}) });

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  const role = String(token.role || '');
  if (req.method === 'PUT' && pathname === '/api/pava/params' && !ROLES_PARAMS.includes(role)) {
    return NextResponse.json({ error: 'Rôle insuffisant.' }, { status: 403 });
  }
  if (req.method === 'DELETE' && /^\/api\/pava\/commandes\/[^/]+$/.test(pathname) && !ROLES_SUPPRESSION.includes(role)) {
    return NextResponse.json({ error: 'Rôle insuffisant.' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/pava/:path*', '/admin/:path*'],
};

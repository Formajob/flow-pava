import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { trouverUtilisateur, type PavaRole } from '@/lib/pava-users';

/**
 * NextAuth — route API /api/auth/[...nextauth]
 * Nécessaire pour useSession() et signIn() sur /login.
 *
 * Accès : seules les adresses de src/lib/pava-users.ts peuvent se connecter.
 * Compte multi-rôles (jawad@acx.ma) : le rôle choisi à la connexion est
 * honoré s'il fait partie des rôles autorisés. Les autres adresses ont un
 * rôle fixe, quel que soit le rôle demandé.
 * Mot de passe : non vérifié en démo (brancher plus tard la table
 * pava_utilisateurs avec de vrais mots de passe).
 */
const handler = NextAuth({
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
        role: { label: 'Rôle (comptes multi-rôles)', type: 'text' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const utilisateur = trouverUtilisateur(email);
        if (!utilisateur) return null; // adresse non autorisée

        // Rôle demandé (boutons d'accès) : honoré seulement si autorisé.
        const demande = (credentials?.role || '').trim().toLowerCase() as PavaRole;
        const role = utilisateur.roles.includes(demande) ? demande : utilisateur.role;

        return { id: utilisateur.email, email: utilisateur.email, name: utilisateur.nom, role, roles: utilisateur.roles };
      },
    }),
  ],
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.role) token.role = user.role;
      if (user?.roles) token.roles = user.roles;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.roles = token.roles;
      }
      return session;
    },
  },
});

export { handler as GET, handler as POST };

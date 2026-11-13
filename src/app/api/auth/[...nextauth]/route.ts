import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { trouverUtilisateur, type PavaRole } from '@/lib/pava-users';
import { chercherUtilisateurDb, verifierMotDePasse } from '@/lib/pava/auth-db';
import { getSupabase } from '@/lib/supabase';

/**
 * NextAuth — route API /api/auth/[...nextauth]
 *
 * Accès (mode base de données — table pava_utilisateurs) :
 *   - e-mail doit exister et le compte être actif ;
 *   - le mot de passe est vérifié contre le hash scrypt ;
 *   - multi_roles = TRUE : l'utilisateur choisit son rôle à la connexion
 *     (boutons Analyste / Admin / Directeur) ; sinon rôle fixe.
 *
 * Mode démo (Supabase non configuré) : comptes de src/lib/pava-users.ts,
 * mot de passe non vérifié — pour développer sans la base.
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

        if (getSupabase()) {
          // --- Mode base : table pava_utilisateurs ---
          const u = await chercherUtilisateurDb(email);
          if (!u) return null; // inconnu ou désactivé
          if (!verifierMotDePasse(password, u.mot_de_passe)) return null; // mauvais mot de passe

          const roleDefaut = u.role as PavaRole;
          const roles: PavaRole[] = u.multi_roles ? ['analyste', 'admin', 'directeur'] : [roleDefaut];
          const demande = (credentials?.role || '').trim().toLowerCase() as PavaRole;
          const role = roles.includes(demande) ? demande : roleDefaut;

          return { id: u.email, email: u.email, name: u.nom, role, roles };
        }

        // --- Mode démo : comptes en code, mot de passe libre ---
        const utilisateur = trouverUtilisateur(email);
        if (!utilisateur) return null;
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

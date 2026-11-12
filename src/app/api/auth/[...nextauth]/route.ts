import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

/**
 * NextAuth — route API /api/auth/[...nextauth]
 * Nécessaire pour useSession() et signIn() sur /login.
 * Sans cette route, /api/auth/session répond 404.
 *
 * Authentification démo : tout e-mail + mot de passe non vide passe.
 * En production, brancher ici la vraie vérification (base utilisateurs).
 */
const handler = NextAuth({
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;
        // Démo : accepter tout identifiant non vide.
        return { id: email, email, name: email.split('@')[0] };
      },
    }),
  ],
  pages: { signIn: '/login' },
});

export { handler as GET, handler as POST };

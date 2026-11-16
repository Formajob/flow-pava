import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { trouverUtilisateur, type PavaRole } from '@/lib/pava-users';
import { chercherUtilisateurDb, verifierMotDePasse } from '@/lib/pava/auth-db';
import { getSupabase } from '@/lib/supabase';

/** Compteurs d'échecs de connexion par e-mail (audit E4). */
const tentatives = new Map<string, { n: number; blocage: number }>();
const MAX_TENTATIVES = 5;
const BLOCAGE_MS = 15 * 60 * 1000;

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
  secret: process.env.NEXTAUTH_SECRET,
  // Session de 8 h au lieu de 30 jours (audit M1) — un compte désactivé ou
  // dont le rôle change ne garde son accès que jusqu'à cette échéance.
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
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

        // Anti-force-brute (audit E4) : 5 échecs par e-mail → 15 min de blocage.
        // Compteur en mémoire (par instance serveur) — compléter idéalement par
        // une règle de limitation de débit côté pare-feu Vercel.
        const t = tentatives.get(email);
        if (t && t.blocage > Date.now()) return null;
        const echec = () => {
          const e = tentatives.get(email) || { n: 0, blocage: 0 };
          e.n += 1;
          if (e.n >= MAX_TENTATIVES) { e.blocage = Date.now() + BLOCAGE_MS; e.n = 0; }
          tentatives.set(email, e);
        };

        if (getSupabase()) {
          // --- Mode base : table pava_utilisateurs ---
          const u = await chercherUtilisateurDb(email);
          if (!u) { echec(); return null; } // inconnu ou désactivé
          if (!verifierMotDePasse(password, u.mot_de_passe)) { echec(); return null; } // mauvais mot de passe
          tentatives.delete(email); // succès : compteur remis à zéro

          const roleDefaut = u.role as PavaRole;
          const roles: PavaRole[] = u.multi_roles ? ['analyste', 'admin', 'directeur'] : [roleDefaut];
          const demande = (credentials?.role || '').trim().toLowerCase() as PavaRole;
          const role = roles.includes(demande) ? demande : roleDefaut;

          return { id: u.email, email: u.email, name: u.nom, role, roles };
        }

        // --- Mode démo : comptes en code, mot de passe libre ---
        // JAMAIS en production : si Supabase est mal configuré, on REFUSE
        // (fail closed, audit C3a) au lieu d'ouvrir l'accès. Escape hatch local
        // explicite : PAVA_ALLOW_DEMO=1 (tests/démo sans base).
        if (process.env.NODE_ENV === 'production' && process.env.PAVA_ALLOW_DEMO !== '1') return null;
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

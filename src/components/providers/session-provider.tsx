'use client';

import type { ReactNode } from 'react';
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

/**
 * SessionProvider PAVA — vrai provider next-auth.
 * Nécessaire pour useSession() et signIn() sur la page /login.
 * Sans lui, la page plante côté navigateur (« This page couldn't load »).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}

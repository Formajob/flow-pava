import type { DefaultSession } from 'next-auth';

/** Augmentation NextAuth : le rôle PAVA (et les rôles autorisés) voyagent dans la session. */
declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & { role?: string; roles?: string[] };
  }
  interface User {
    role?: string;
    roles?: string[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string;
    roles?: string[];
  }
}

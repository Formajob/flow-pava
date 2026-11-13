'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import BarreChargement from '../pava/BarreChargement';
import { PAVA_MENU, PAVA_SPACE_LABEL } from '@/lib/pava-menu';
import { getPavaState, setPavaRole, EST_MODE_DB, type Role } from '@/lib/pava-store';
import { TITRE_ROLE, type PavaRole } from '@/lib/pava-users';

/**
 * Coquille PAVA — même structure que Juridique.
 * Le fond animé est déjà rendu par src/app/layout.tsx : ne pas en ajouter un second ici.
 *
 * Accès : la session NextAuth décide du rôle. Compte multi-rôles
 * (jawad@acx.ma) : le rôle choisi (à la connexion ou dans Administration)
 * est conservé tant qu'il reste autorisé. Rôle fixe pour les autres.
 * Sans session → retour au /login.
 *
 * Bandeau mode démo : si Supabase n'est pas configuré (.env.local),
 * un avertissement s'affiche en haut de chaque page — les données restent
 * dans le navigateur au lieu d'aller dans la base.
 */
export default function RoleLayout({ children }: { children?: ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  const roleSession = (session?.user?.role as PavaRole | undefined) || null;
  const rolesAutorises = (session?.user?.roles as PavaRole[] | undefined) || [];
  const cleRoles = rolesAutorises.join('|');

  // Rôle de la session → store (une seule fois par changement)
  useEffect(() => {
    if (!roleSession || rolesAutorises.length === 0) return;
    if (rolesAutorises.length === 1) {
      setPavaRole(rolesAutorises[0] as Role);
    } else {
      // Compte multi-rôles : garder le rôle choisi s'il est autorisé
      const actuel = getPavaState().role;
      if (!rolesAutorises.includes(actuel as PavaRole)) setPavaRole(roleSession as Role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleSession, cleRoles]);

  // Accès protégé : pas de session → /login
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const nom = session?.user?.name || 'Admin';
  const meta = roleSession ? `${TITRE_ROLE[roleSession]} · Flow` : 'Admin · Flow';

  return (
    <div className="g-app">
      <Suspense fallback={<div className="g-side g-glass" />}>
        <Sidebar items={PAVA_MENU} spaceLabel={PAVA_SPACE_LABEL} userName={nom} userMeta={meta} />
      </Suspense>
      <main className="g-main">
        {monte && !EST_MODE_DB && (
          <div
            role="alert"
            style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap',
              padding: '12px 16px', marginBottom: 14, borderRadius: 14,
              border: '1px solid rgba(220,38,38,.25)', background: 'rgba(220,38,38,.07)',
              color: '#991b1b', fontSize: 13, lineHeight: 1.5,
            }}
          >
            <b>⚠ Mode démo — les données ne vont PAS dans Supabase.</b>
            <span>
              Elles restent dans ce navigateur (localStorage). Pour enregistrer dans la base « flow » : créez
              <b> .env.local </b> à la racine du projet (à côté de package.json) avec
              <b> NEXT_PUBLIC_SUPABASE_URL </b> et <b> SUPABASE_SERVICE_ROLE_KEY</b>, puis relancez
              <b> npm run dev</b>. Vérifiez aussi que le fichier ne s&apos;appelle pas « .env.local.txt » (Windows) et
              testez <b>/api/pava/state</b> : il doit renvoyer <b>{'{"commandes":[…]}'}</b> et non une erreur.
            </span>
          </div>
        )}
        <BarreChargement />
        {children}
      </main>
    </div>
  );
}

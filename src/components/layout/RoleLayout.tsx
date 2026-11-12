'use client';

import { Suspense, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import { PAVA_MENU, PAVA_SPACE_LABEL } from '@/lib/pava-menu';

interface RoleLayoutProps {
  userName?: string;
  userMeta?: string;
  children: ReactNode;
}

/**
 * Coquille PAVA — même structure que Juridique.
 * Le fond animé est déjà rendu par src/app/layout.tsx : ne pas en ajouter un second ici.
 */
export default function RoleLayout({
  userName = 'Admin',
  userMeta = 'Admin · Flow',
  children,
}: RoleLayoutProps) {
  return (
    <div className="g-app">
      <Suspense fallback={<div className="g-side g-glass" />}>
        <Sidebar items={PAVA_MENU} spaceLabel={PAVA_SPACE_LABEL} userName={userName} userMeta={userMeta} />
      </Suspense>
      <main className="g-main">{children}</main>
    </div>
  );
}

import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@/styles/glass.css';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/components/providers/session-provider';

export const metadata: Metadata = {
  title: 'ACX Flow',
  description: 'Application PAVA - Facturation VL PAV Affaire (Videotron)',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y=".9em" font-size="28">ACX</text></svg>',
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="g-body">
        {/* Fond décoratif commun à toutes les pages (habillage Glassy V22). */}
        <div className="g-aurora" aria-hidden="true">
          <span className="g-orb g-orb--1" />
          <span className="g-orb g-orb--2" />
          <div className="g-grid" />
        </div>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

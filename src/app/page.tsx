import { redirect } from 'next/navigation';

/**
 * La racine redirige vers la page de connexion unique.
 * Même règle que Juridique : une seule page de login, pas de seconde carte.
 */
export default function HomePage() {
  redirect('/login');
}

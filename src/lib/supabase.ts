import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté SERVEUR uniquement (routes API Next.js).
 *
 * RLS est activé sur toutes les tables pava_* sans policy : les clés
 * anon/authenticated ne voient rien. On passe donc par la SERVICE_ROLE_KEY,
 * qui contourne le RLS — elle ne doit JAMAIS être exposée au navigateur
 * (jamais de NEXT_PUBLIC_ devant, jamais dans un composant client).
 *
 * Si les variables d'environnement ne sont pas définies, getSupabase()
 * renvoie null : les routes API répondent 503 et l'application retombe
 * sur le mode démo localStorage (utile en dev sans configuration).
 */

let client: SupabaseClient | null | undefined;

/** Une URL valide commence par http(s) — un placeholder n'est pas une configuration. */
function urlValide(u: string | undefined): u is string {
  return /^https?:\/\//.test(u || '');
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!urlValide(url) || !key || key === 'CLE_SERVICE_ROLE') {
    client = null;
    return client;
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const SUPABASE_CONFIGURE = () =>
  urlValide(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
  process.env.SUPABASE_SERVICE_ROLE_KEY !== 'CLE_SERVICE_ROLE';

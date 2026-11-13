import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { dbToCommande, SELECT_COMMANDE } from '@/lib/pava/db-map';
import { DEFAULT_PARAMS, type PavaParams } from '@/lib/pava/types';

/**
 * GET /api/pava/state — état complet pour le store client :
 * toutes les commandes (avec lignes, fichiers, décisions, historique)
 * + paramètres globaux (Price Plan).
 */
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('pava_commandes')
    .select(SELECT_COMMANDE)
    .order('date_creation', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: paramsRows, error: paramsErr } = await supabase
    .from('pava_params')
    .select('params')
    .is('commande_id', null)
    .limit(1);
  if (paramsErr) return NextResponse.json({ error: paramsErr.message }, { status: 500 });

  const params = (paramsRows?.[0]?.params as PavaParams) || DEFAULT_PARAMS;

  return NextResponse.json({
    commandes: (data || []).map(dbToCommande),
    params,
  });
}

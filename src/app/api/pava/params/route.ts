import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { DEFAULT_PARAMS, type PavaParams } from '@/lib/pava/types';

/** GET /api/pava/params — Price Plan + paramètres de règles (ligne globale). */
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });

  const { data, error } = await supabase.from('pava_params').select('params').is('commande_id', null).limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ params: (data?.[0]?.params as PavaParams) || DEFAULT_PARAMS });
}

/** PUT /api/pava/params — mettre à jour le Price Plan / les règles (page Règles). */
export async function PUT(req: Request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });

  let body: { params?: PavaParams };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }
  if (!body.params) return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });

  // Mettre à jour la ligne globale ; la créer si elle n'existe pas encore.
  const { data: maj, error: errMaj } = await supabase
    .from('pava_params')
    .update({ params: body.params, date_maj: new Date().toISOString() })
    .is('commande_id', null)
    .select();
  if (errMaj) return NextResponse.json({ error: errMaj.message }, { status: 500 });

  if (!maj || maj.length === 0) {
    const { error: errIns } = await supabase.from('pava_params').insert({ commande_id: null, params: body.params });
    if (errIns) return NextResponse.json({ error: errIns.message }, { status: 500 });
  }

  return NextResponse.json({ params: body.params });
}

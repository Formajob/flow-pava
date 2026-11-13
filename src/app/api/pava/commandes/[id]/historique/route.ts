import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * POST /api/pava/commandes/[id]/historique — ajouter une entrée d'historique.
 * Body : { action: string, auteur?: string }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { action?: string; auteur?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const action = (body.action || '').trim();
  if (!action) return NextResponse.json({ error: 'Action manquante.' }, { status: 400 });

  const { data, error } = await supabase
    .from('pava_historique')
    .insert({ commande_id: id, action, auteur: body.auteur || null })
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Historique non enregistré.' }, { status: 500 });

  return NextResponse.json({ date: data.date_action, action: data.action }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { acteurDe, nonAuthentifie, msgDb } from '@/lib/pava/guard';

/**
 * POST /api/pava/commandes/[id]/historique — ajouter une entrée d'historique.
 * Body : { action: string } — l'AUTEUR vient toujours du jeton signé (audit M2),
 * jamais du corps de la requête (falsifiable).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const acteur = await acteurDe(req);
  if (!acteur) return nonAuthentifie();

  const action = (body.action || '').trim();
  if (!action) return NextResponse.json({ error: 'Action manquante.' }, { status: 400 });

  const { data, error } = await supabase
    .from('pava_historique')
    .insert({ commande_id: id, action, auteur: `${acteur.email} (${acteur.role})` })
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: msgDb(error) }, { status: 500 });

  return NextResponse.json({ date: data.date_action, action: data.action }, { status: 201 });
}

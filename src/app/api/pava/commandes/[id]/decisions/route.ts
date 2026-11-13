import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * PUT /api/pava/commandes/[id]/decisions — enregistrer (upsert) une décision
 * sur une incohérence. Body : { ref, regle?, statut, commentaire }
 * Unicité (commande, ref) ⇒ le même cas n'est pas re-flaggé le mois suivant.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { ref?: string; regle?: string; statut?: string; commentaire?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const ref = (body.ref || '').trim();
  const statut = body.statut || 'ouvert';
  if (!ref) return NextResponse.json({ error: 'Référence d’anomalie manquante.' }, { status: 400 });

  const { data, error } = await supabase
    .from('pava_decisions')
    .upsert(
      { commande_id: id, ref_anomalie: ref, regle: body.regle || null, statut, commentaire: body.commentaire || '' },
      { onConflict: 'commande_id,ref_anomalie' }
    )
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Décision non enregistrée.' }, { status: 500 });

  return NextResponse.json({ ok: true, ref, statut: data.statut, commentaire: data.commentaire });
}

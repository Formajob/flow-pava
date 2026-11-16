import { NextRequest, NextResponse } from 'next/server';
import { acteurDe, msgDb } from '@/lib/pava/guard';
import { getSupabase } from '@/lib/supabase';

/**
 * PUT /api/pava/commandes/[id]/decisions — enregistrer (upsert) une décision
 * sur une incohérence. Body : { ref, regle?, statut, commentaire }
 * Unicité (commande, ref) ⇒ le même cas n'est pas re-flaggé le mois suivant.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const decideur = await acteurDe(req);
  const { data, error } = await supabase
    .from('pava_decisions')
    .upsert(
      { commande_id: id, ref_anomalie: ref, regle: body.regle || null, statut, commentaire: body.commentaire || '', decide_par: decideur?.email ?? null },
      { onConflict: 'commande_id,ref_anomalie' }
    )
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: msgDb(error) }, { status: 500 });

  return NextResponse.json({ ok: true, ref, statut: data.statut, commentaire: data.commentaire });
}

/**
 * POST /api/pava/commandes/[id]/decisions — décisions EN MASSE.
 * Body : { refs: string[], statut } — applique le même statut à
 * toutes les anomalies référencées (ex. « valider tout le filtre »),
 * au lieu de les traiter une par une. Réponse : { ok, n }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { refs?: string[]; statut?: string; commentaire?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  // Déduplication : une même ligne peut être flaggée deux fois dans un groupe
  // (ex. R07 — ligne présente dans deux paires « même service ») ; un upsert
  // Postgres avec doublons échoue (« cannot affect row a second time »).
  const refs = [...new Set((body.refs || []).map((r) => r.trim()).filter(Boolean))];
  const statut = body.statut || 'ouvert';
  if (refs.length === 0) return NextResponse.json({ error: 'Aucune référence fournie.' }, { status: 400 });

  const commentaire = (body.commentaire || '').trim();
  const decideur = await acteurDe(req);
  const rangees = refs.map((ref) => ({ commande_id: id, ref_anomalie: ref, statut, commentaire, decide_par: decideur?.email ?? null }));
  const { error } = await supabase
    .from('pava_decisions')
    .upsert(rangees, { onConflict: 'commande_id,ref_anomalie' });
  if (error) return NextResponse.json({ error: msgDb(error) }, { status: 500 });

  return NextResponse.json({ ok: true, n: rangees.length });
}

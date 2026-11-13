import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { assemblerLignes, recalculerStatsCommande, sansBrut } from '@/lib/pava/blob-db';
import type { PavaLigne } from '@/lib/pava-store';

/** Patch déjà enregistré sur cette ligne (fusion), sinon null. */
async function patchExistant(commandeId: string, refLigne: string): Promise<Record<string, unknown> | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from('pava_corrections')
    .select('patch')
    .eq('commande_id', commandeId)
    .eq('ligne_ref', refLigne)
    .limit(1);
  const rows = (data || []) as Array<{ patch?: Record<string, unknown> }>;
  return rows && rows.length > 0 ? rows[0].patch || null : null;
}

/**
 * PATCH /api/pava/commandes/[id]/lignes/[ref] — corriger une ligne.
 * Body : { patch: Partial<PavaLigne> }
 * La correction est enregistrée dans pava_corrections (overlay léger :
 * une petite rangée par ligne réellement corrigée, jamais 3 500).
 * Réponse : { ligne, stats }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; ref: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id, ref } = await params;
  const refLigne = decodeURIComponent(ref);

  let body: { patch?: Partial<PavaLigne> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }
  const patch = body.patch || {};
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour.' }, { status: 400 });

  const precedent = await patchExistant(id, refLigne);
  const patchFusionne = { ...(precedent || {}), ...patch } as Record<string, unknown>;

  const { error } = await supabase
    .from('pava_corrections')
    .upsert(
      { commande_id: id, ligne_ref: refLigne, patch: patchFusionne, supprime: false },
      { onConflict: 'commande_id,ligne_ref' }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stats = await recalculerStatsCommande(id);
  const lignes = sansBrut(await assemblerLignes(id));
  const ligne = lignes.find((l) => l.id === refLigne) || null;
  return NextResponse.json({ ligne, stats });
}

/**
 * DELETE /api/pava/commandes/[id]/lignes/[ref] — supprimer une ligne
 * (marquée supprimée dans l'overlay, le fichier source reste intact).
 * Réponse : { ok: true, stats }
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; ref: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id, ref } = await params;
  const refLigne = decodeURIComponent(ref);

  const { error } = await supabase
    .from('pava_corrections')
    .upsert(
      { commande_id: id, ligne_ref: refLigne, patch: {}, supprime: true },
      { onConflict: 'commande_id,ligne_ref' }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stats = await recalculerStatsCommande(id);
  return NextResponse.json({ ok: true, stats });
}

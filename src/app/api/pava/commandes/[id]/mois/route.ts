import { NextResponse } from 'next/server';
import { msgDb } from '@/lib/pava/guard';
import { getSupabase } from '@/lib/supabase';

/**
 * PATCH /api/pava/commandes/[id]/mois — corriger la PÉRIODE d'une commande.
 *
 * Cas d'usage : une commande a été importée alors que son mois était celui de
 * l'importation (ex. fichier d'OCTOBRE importé en novembre) — les exports
 * montraient alors la période d'import au lieu de la période réelle des données.
 * Cette route met à jour pava_commandes.mois ET re-timbre le champ `mois` de
 * chaque ligne des blobs pava_fichiers.contenu (+ la colonne pava_fichiers.mois),
 * sans toucher aux identifiants de lignes (les décisions restent valides).
 *
 * Body : { mois: string } — format 'AAAA-MM', ou '' pour « sans période »
 * (fichier hors facture mensuelle : suivi de performance, vérification…).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { mois?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const mois = (body.mois || '').trim();
  if (mois && !/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) {
    return NextResponse.json({ error: 'Format de mois invalide (attendu AAAA-MM, ex. 2026-10).' }, { status: 400 });
  }

  // 1) La commande elle-même
  const { error: errCmd } = await supabase.from('pava_commandes').update({ mois: mois || null }).eq('id', id);
  if (errCmd) return NextResponse.json({ error: msgDb(errCmd) }, { status: 500 });

  // 2) Re-timbrer les lignes de chaque blob (et la colonne mois des fichiers)
  const { data: fics, error: errFics } = await supabase
    .from('pava_fichiers')
    .select('id, contenu')
    .eq('commande_id', id);
  if (errFics) return NextResponse.json({ error: msgDb(errFics) }, { status: 500 });

  let nbLignes = 0;
  for (const f of fics || []) {
    const lignes = (f.contenu as Array<Record<string, unknown>>) || [];
    if (lignes.length === 0) continue;
    const maj = lignes.map((l) => ({ ...l, mois }));
    const { error: errBlob } = await supabase
      .from('pava_fichiers')
      .update({ contenu: maj, mois: mois || null })
      .eq('id', f.id);
    if (errBlob) return NextResponse.json({ error: msgDb(errBlob) }, { status: 500 });
    nbLignes += lignes.length;
  }

  // 3) Trace
  await supabase.from('pava_historique').insert({
    commande_id: id,
    action: `Période corrigée → ${mois || 'sans période'}${nbLignes ? ` (${nbLignes} lignes re-timbrées)` : ''}`,
  });

  return NextResponse.json({ ok: true, mois: mois || null, nbLignes });
}

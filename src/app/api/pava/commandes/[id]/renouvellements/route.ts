import { NextResponse } from 'next/server';
import { msgDb } from '@/lib/pava/guard';
import { getSupabase } from '@/lib/supabase';

/**
 * GET /api/pava/commandes/[id]/renouvellements — index COMPACT des
 * renouvellements des AUTRES commandes (contrôle R03 « déjà renouvelé
 * dans les N mois », équivalent du contrôle humain O-2).
 *
 * Le serveur lit les blobs des autres commandes et ne renvoie que les
 * clés utiles : { periode, noCli, codeService, feuille, ligneExcel }.
 * Requête légère, faite à la demande quand une page fait tourner le moteur.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  const { data: cmds, error } = await supabase
    .from('pava_commandes')
    .select('id, mois')
    .neq('id', id);
  if (error) return NextResponse.json({ error: msgDb(error) }, { status: 500 });

  const refs: Array<{ periode: string; noCli: string; codeService: string; feuille: string; ligneExcel: number }> = [];
  for (const c of cmds || []) {
    const { data: fics } = await supabase
      .from('pava_fichiers')
      .select('contenu')
      .eq('commande_id', c.id);
    for (const f of fics || []) {
      for (const l of (f.contenu as Array<Record<string, unknown>> | null) || []) {
        if (String(l.categorie || '').toUpperCase() !== 'RENOUVELLEMENT') continue;
        refs.push({
          periode: String(l.mois || c.mois || ''),
          noCli: String(l.compte || ''),
          codeService: String(l.desc || ''),
          feuille: String(l.feuille || ''),
          ligneExcel: Number(l.ligneExcel || 0),
        });
      }
    }
  }
  return NextResponse.json({ renouvellements: refs });
}

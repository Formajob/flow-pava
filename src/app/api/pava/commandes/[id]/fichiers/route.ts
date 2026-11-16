import { NextRequest, NextResponse } from 'next/server';
import { acteurDe, msgDb } from '@/lib/pava/guard';
import { getSupabase } from '@/lib/supabase';
import { dbToFichier } from '@/lib/pava/db-map';
import { recalculerStatsCommande, sansBrut } from '@/lib/pava/blob-db';
import type { PavaLigne, ImportedFile } from '@/lib/pava-store';

/**
 * POST /api/pava/commandes/[id]/fichiers — enregistrer un import.
 * Body : { fichier: ImportedFile, lignes: PavaLigne[] }
 *
 * Stockage « blob » : toutes les lignes du fichier vont dans UN SEUL
 * champ JSON (pava_fichiers.contenu) — plus de table ligne-par-ligne
 * qui gonflait la base de ~3 500 rangées par commande. La ligne source
 * `brut` est conservée dedans pour traçabilité mais n'est jamais
 * renvoyée au navigateur.
 *
 * Retour : { fichier, nbLignes, lignes (sans brut), stats }
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: {
    fichier?: Partial<ImportedFile>;
    lignes?: PavaLigne[];
    // com/synthese (rapprochement R08/R12) : acceptés mais ignorés pour
    // l'instant — ces colonnes ne sont pas requises (voir migration 004, optionnelle).
    com?: Array<Record<string, unknown>>;
    synthese?: { quantite: number | null; montant: number | null } | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const fichier = body.fichier;
  const lignes = body.lignes || [];
  if (!fichier?.nom) return NextResponse.json({ error: 'Nom de fichier manquant.' }, { status: 400 });

  // 1. Le fichier (contenu vide pour l'instant — l'id sert aux références)
  const { data: fic, error: errFic } = await supabase
    .from('pava_fichiers')
    .insert({
      commande_id: id,
      nom: fichier.nom,
      feuilles: fichier.feuilles || [],
      nb_lignes: lignes.length,
      mois: fichier.mois || null,
      // Qui a importé : lu dans le jeton signé (audit M2).
      importe_par: (await acteurDe(req))?.email ?? null,
      contenu: [],
    })
    .select()
    .single();
  if (errFic || !fic) {
    return NextResponse.json({ error: msgDb(errFic) }, { status: 500 });
  }

  // 2. Les lignes → un seul blob, ids stables et uniques
  const vus = new Set<string>();
  const contenu = lignes.map((l, i) => {
    let ref = l.feuille && l.ligneExcel != null ? `${l.feuille}|${l.ligneExcel}` : String(l.id || '');
    if (!ref || vus.has(ref)) ref = `imp-${fic.id.slice(0, 8)}-${i}`;
    vus.add(ref);
    return { ...l, id: ref };
  });

  const { error: errMaj } = await supabase
    .from('pava_fichiers')
    .update({ contenu })
    .eq('id', fic.id);
  if (errMaj) {
    await supabase.from('pava_fichiers').delete().eq('id', fic.id);
    return NextResponse.json({ error: msgDb(errMaj) }, { status: 500 });
  }

  // 3. Totaux de la commande (tableau de bord sans charger les lignes)
  const stats = await recalculerStatsCommande(id);

  // 4. Historique
  await supabase.from('pava_historique').insert({
    commande_id: id,
    action: `Import ${fichier.nom} : ${lignes.length} lignes`,
  });

  return NextResponse.json({ fichier: dbToFichier(fic), nbLignes: lignes.length, lignes: sansBrut(contenu as PavaLigne[]), stats }, { status: 201 });
}

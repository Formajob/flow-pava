import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { dbToLigne, dbToFichier, ligneToDb } from '@/lib/pava/db-map';
import type { PavaLigne, ImportedFile } from '@/lib/pava-store';

/**
 * POST /api/pava/commandes/[id]/fichiers — enregistrer un import :
 * le fichier + ses lignes normalisées (avec la ligne source brute pour
 * traçabilité). Insertion par lots de 500 pour ~3 000 lignes sans bloquer.
 * Body : { fichier: ImportedFile, lignes: PavaLigne[] }
 * Retour : { fichier, lignes } avec les ids DB.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { fichier?: Partial<ImportedFile>; lignes?: PavaLigne[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const fichier = body.fichier;
  const lignes = body.lignes || [];
  if (!fichier?.nom) return NextResponse.json({ error: 'Nom de fichier manquant.' }, { status: 400 });

  // 1. Le fichier
  const { data: fic, error: errFic } = await supabase
    .from('pava_fichiers')
    .insert({
      commande_id: id,
      nom: fichier.nom,
      feuilles: fichier.feuilles || [],
      nb_lignes: lignes.length,
      mois: fichier.mois || null,
    })
    .select()
    .single();
  if (errFic || !fic) return NextResponse.json({ error: errFic?.message || 'Enregistrement du fichier impossible.' }, { status: 500 });

  // 2. Les lignes, par lots de 500
  const rows = lignes.map((l) => ligneToDb(l, id, fic.id));
  const inserees: unknown[] = [];
  const TAILLE_LOT = 500;
  for (let i = 0; i < rows.length; i += TAILLE_LOT) {
    const lot = rows.slice(i, i + TAILLE_LOT);
    const { data: lotInsere, error: errLot } = await supabase
      .from('pava_lignes')
      .insert(lot)
      .select('id, commande_id, mois, feuille, ligne_excel, compte, produit, famille, type, desc_service, categorie, source, puissance, quantite, montant_origine, montant_calcule, ajustement, statut, incoherence, incomplet');
    if (errLot) {
      // Nettoyage du fichier si l'insertion échoue à mi-chemin
      await supabase.from('pava_fichiers').delete().eq('id', fic.id);
      return NextResponse.json({ error: `Import interrompu (lot ${Math.floor(i / TAILLE_LOT) + 1}) : ${errLot.message}` }, { status: 500 });
    }
    inserees.push(...(lotInsere || []));
  }

  // 3. Historique de la commande
  await supabase.from('pava_historique').insert({
    commande_id: id,
    action: `Import ${fichier.nom} : ${lignes.length} lignes`,
  });

  return NextResponse.json(
    { fichier: dbToFichier(fic), lignes: inserees.map(dbToLigne) },
    { status: 201 }
  );
}

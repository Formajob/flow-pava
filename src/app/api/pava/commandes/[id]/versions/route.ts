import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

/**
 * POST /api/pava/commandes/[id]/versions — tracer une version du fichier
 * Excel de la commande (une par étape : importation, analyse, contrôle…).
 * Body : { etape, nomFichier, nbLignes?, totalCalcule? }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { etape?: string; nomFichier?: string; nbLignes?: number; totalCalcule?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  if (!body.etape || !body.nomFichier) {
    return NextResponse.json({ error: 'Étape et nom de fichier requis.' }, { status: 400 });
  }

  // Numéro suivant
  const { data: dernieres } = await supabase
    .from('pava_versions')
    .select('numero')
    .eq('commande_id', id)
    .order('numero', { ascending: false })
    .limit(1);
  const numero = ((dernieres?.[0]?.numero as number | undefined) || 0) + 1;

  const { data, error } = await supabase
    .from('pava_versions')
    .insert({
      commande_id: id,
      numero,
      etape: body.etape,
      nom_fichier: body.nomFichier,
      nb_lignes: body.nbLignes ?? null,
      total_calcule: body.totalCalcule ?? null,
    })
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Version non enregistrée.' }, { status: 500 });

  await supabase.from('pava_historique').insert({
    commande_id: id,
    action: `Version ${numero} générée (${body.etape}) : ${body.nomFichier}`,
  });

  return NextResponse.json({ numero: data.numero, etape: data.etape, nomFichier: data.nom_fichier }, { status: 201 });
}

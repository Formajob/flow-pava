import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { assemblerLignes, sansBrut } from '@/lib/pava/blob-db';
import type { PavaLigne } from '@/lib/pava-store';

/**
 * GET /api/pava/commandes/[id]/lignes — lignes d'UNE commande,
 * chargées à la demande (les autres commandes restent en métadonnées).
 * Les lignes supprimées sont exclues, les corrections appliquées,
 * et la colonne source `brut` n'est jamais envoyée (payload léger).
 * Inclut aussi les références de rapprochement : lignes COM (R08)
 * et totaux de synthèse (R12) des fichiers importés.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  const { data: existe } = await supabase.from('pava_commandes').select('id').eq('id', id).limit(1);
  if (!existe || existe.length === 0) {
    return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  }

  const lignes = await assemblerLignes(id);
  const { data: refs } = await supabase
    .from('pava_fichiers')
    .select('com, synthese')
    .eq('commande_id', id);
  const com: PavaLigne[] = [];
  let synthese: { quantite: number | null; montant: number | null } | null = null;
  for (const f of refs || []) {
    for (const c of (f.com as PavaLigne[] | null) || []) com.push(sansBrut([c])[0]);
    if (!synthese && f.synthese) synthese = f.synthese as { quantite: number | null; montant: number | null };
  }
  return NextResponse.json({ lignes: sansBrut(lignes), com, synthese });
}

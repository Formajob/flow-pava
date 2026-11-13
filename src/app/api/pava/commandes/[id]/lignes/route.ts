import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { assemblerLignes, sansBrut } from '@/lib/pava/blob-db';

/**
 * GET /api/pava/commandes/[id]/lignes — lignes d'UNE commande,
 * chargées à la demande (les autres commandes restent en métadonnées).
 * Les lignes supprimées sont exclues, les corrections appliquées,
 * et la colonne source `brut` n'est jamais envoyée (payload léger).
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
  return NextResponse.json({ lignes: sansBrut(lignes) });
}

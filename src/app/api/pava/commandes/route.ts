import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { dbToCommande } from '@/lib/pava/db-map';

/**
 * POST /api/pava/commandes — créer une commande de facture.
 * Body : { nom: string, mois?: string }
 * Le nom est obligatoire (règle métier). Historique « Commande créée » inséré.
 */
export async function POST(req: Request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });

  let body: { nom?: string; mois?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const nom = (body.nom || '').trim();
  if (!nom) return NextResponse.json({ error: 'Le nom de la commande est obligatoire.' }, { status: 400 });

  const { data: cmd, error } = await supabase
    .from('pava_commandes')
    .insert({ nom, mois: body.mois || null, statut: 'en_cours', etape: 'importation' })
    .select()
    .single();
  if (error || !cmd) return NextResponse.json({ error: error?.message || 'Création impossible.' }, { status: 500 });

  await supabase.from('pava_historique').insert({
    commande_id: cmd.id,
    action: `Commande créée : ${nom}`,
  });

  return NextResponse.json(dbToCommande({ ...cmd, pava_lignes: [], pava_fichiers: [], pava_decisions: [], pava_historique: [] }), { status: 201 });
}

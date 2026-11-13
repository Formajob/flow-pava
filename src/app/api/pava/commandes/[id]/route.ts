import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { dbToCommande, SELECT_COMMANDE } from '@/lib/pava/db-map';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/pava/commandes/[id] — commande complète. */
export async function GET(_req: Request, { params }: Ctx) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  const { data, error } = await supabase.from('pava_commandes').select(SELECT_COMMANDE).eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  return NextResponse.json(dbToCommande(data));
}

/**
 * PATCH /api/pava/commandes/[id] — mise à jour (statut, étape, nom, mois).
 * Un changement de statut est toujours tracé dans l'historique.
 * Retourne la commande complète rechargée.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { statut?: string; etape?: string; nom?: string; mois?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const maj: Record<string, unknown> = {};
  if (body.statut) maj.statut = body.statut;
  if (body.etape) maj.etape = body.etape;
  if (body.nom) maj.nom = body.nom.trim();
  if (body.mois !== undefined) maj.mois = body.mois || null;
  if (Object.keys(maj).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour.' }, { status: 400 });

  const { error } = await supabase.from('pava_commandes').update(maj).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.statut) {
    await supabase.from('pava_historique').insert({
      commande_id: id,
      action: `Statut → ${body.statut}${body.statut === 'validee' ? ' (validée par le Directeur)' : body.statut === 'valide_admin' ? ' (validée par l’Admin)' : ''}`,
    });
  }
  if (body.etape) {
    await supabase.from('pava_historique').insert({ commande_id: id, action: `Étape → ${body.etape}` });
  }

  const { data, error: err2 } = await supabase.from('pava_commandes').select(SELECT_COMMANDE).eq('id', id).single();
  if (err2 || !data) return NextResponse.json({ error: err2?.message || 'Rechargement impossible.' }, { status: 500 });
  return NextResponse.json(dbToCommande(data));
}

/**
 * DELETE /api/pava/commandes/[id] — supprimer une commande.
 * Bloqué par le trigger SQL si la commande est validée (Directeur).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  const { error } = await supabase.from('pava_commandes').delete().eq('id', id);
  if (error) {
    const bloquee = /validée par le Directeur/i.test(error.message);
    return NextResponse.json(
      { error: bloquee ? 'Commande validée par le Directeur : suppression interdite.' : error.message },
      { status: bloquee ? 403 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

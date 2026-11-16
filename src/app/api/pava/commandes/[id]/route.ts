import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { acteurDe, nonAuthentifie, msgDb } from '@/lib/pava/guard';
import { dbToCommande } from '@/lib/pava/db-map';
import { assemblerLignes } from '@/lib/pava/blob-db';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Charge une commande SANS requête embarquée (« pava_commandes.select('*, pava_lignes(*)') »).
 * Chaque table enfant est interrogée directement par commande_id : aucune
 * dépendance aux relations/FK du cache de schéma PostgREST — des environnements
 * où ces relations manquent rejetaient la requête avec
 * « Could not find a relationship between 'pava_commandes' and 'pava_lignes' in the schema cache ».
 * Les lignes facturables vivent dans le blob pava_fichiers.contenu (assemblerLignes).
 */
async function chargerCommande(id: string, avecLignes = true) {
  const supabase = getSupabase()!;
  const { data: c, error } = await supabase.from('pava_commandes').select('*').eq('id', id).single();
  if (error || !c) return null;
  const [fichiers, decisions, historique, lignes] = await Promise.all([
    supabase.from('pava_fichiers').select('id, commande_id, nom, date_import, feuilles, nb_lignes, mois').eq('commande_id', id).order('date_import'),
    supabase.from('pava_decisions').select('*').eq('commande_id', id),
    supabase.from('pava_historique').select('*').eq('commande_id', id).order('date_action'),
    avecLignes ? assemblerLignes(id) : Promise.resolve([]),
  ]);
  return dbToCommande({
    ...c,
    pava_lignes: [], // compat forme : les vraies lignes sont passées ci-dessous
    pava_fichiers: fichiers.data || [],
    pava_decisions: decisions.data || [],
    pava_historique: historique.data || [],
    lignes_blob: lignes,
  });
}

/** GET /api/pava/commandes/[id] — commande complète. */
export async function GET(_req: Request, { params }: Ctx) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  const commande = await chargerCommande(id);
  if (!commande) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });
  return NextResponse.json(commande);
}

/**
 * PATCH /api/pava/commandes/[id] — mise à jour (statut, étape, nom, mois).
 * Un changement de statut est toujours tracé dans l'historique.
 * Retourne la commande complète rechargée.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { statut?: string; etape?: string; nom?: string; mois?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  // Validation à deux niveaux côté SERVEUR (audit E1) : seul l'Admin passe
  // « valide_admin », seul le Directeur passe « validee » — le rôle affiché
  // côté navigateur (localStorage) ne suffit plus.
  const acteur = await acteurDe(req);
  if (!acteur) return nonAuthentifie();
  if (body.statut) {
    if (!['en_cours', 'valide_admin', 'validee'].includes(body.statut)) {
      return NextResponse.json({ error: 'Statut inconnu.' }, { status: 400 });
    }
    const requis: Record<string, string> = { valide_admin: 'admin', validee: 'directeur' };
    if (requis[body.statut] && acteur.role !== requis[body.statut]) {
      return NextResponse.json({ error: `Seul le rôle « ${requis[body.statut]} » peut passer ce statut.` }, { status: 403 });
    }
  }

  const maj: Record<string, unknown> = {};
  if (body.statut) maj.statut = body.statut;
  if (body.etape) maj.etape = body.etape;
  if (body.nom) maj.nom = body.nom.trim();
  if (body.mois !== undefined) maj.mois = body.mois || null;
  if (Object.keys(maj).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour.' }, { status: 400 });

  const { error } = await supabase.from('pava_commandes').update(maj).eq('id', id);
  if (error) return NextResponse.json({ error: msgDb(error) }, { status: 500 });

  if (body.statut) {
    await supabase.from('pava_historique').insert({
      commande_id: id,
      // Auteur pris dans le jeton signé, jamais dans le corps (audit M2/M7).
      action: `Statut → ${body.statut} (par ${acteur.email} · ${acteur.role})`,
    });
  }
  if (body.etape) {
    await supabase.from('pava_historique').insert({ commande_id: id, action: `Étape → ${body.etape}` });
  }

  // Sans les lignes (blob de ~3 500 lignes) : le client les conserve déjà,
  // seules les métadonnées (statut, historique, décisions) l'intéressent ici.
  const commande = await chargerCommande(id, false);
  if (!commande) return NextResponse.json({ error: 'Rechargement impossible.' }, { status: 500 });
  return NextResponse.json(commande);
}

/**
 * DELETE /api/pava/commandes/[id] — supprimer une commande.
 * Bloqué par le trigger SQL si la commande est validée (Directeur).
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  // Enfants supprimés EXPLICITEMENT : certaines bases n'ont pas les
  // FK ON DELETE CASCADE (créées avant leur ajout dans la migration 001),
  // et sans elles la suppression laissait des lignes orphelines.
  // NB : pava_lignes n'existe plus (mode blob, migration 003) ; pava_params
  // ne conserve que les lignes propre à la commande (commande_id non NULL).
  await Promise.all([
    supabase.from('pava_corrections').delete().eq('commande_id', id),
    supabase.from('pava_decisions').delete().eq('commande_id', id),
    supabase.from('pava_historique').delete().eq('commande_id', id),
    supabase.from('pava_versions').delete().eq('commande_id', id),
    supabase.from('pava_fichiers').delete().eq('commande_id', id),
    supabase.from('pava_params').delete().eq('commande_id', id),
  ]);

  const { error } = await supabase.from('pava_commandes').delete().eq('id', id);
  if (error) {
    const bloquee = /validée par le Directeur/i.test(error.message);
    return NextResponse.json(
      { error: bloquee ? 'Commande validée par le Directeur : suppression interdite.' : msgDb(error) },
      { status: bloquee ? 403 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

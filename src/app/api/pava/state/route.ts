import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { dbToCommande } from '@/lib/pava/db-map';
import { DEFAULT_PARAMS, type PavaParams } from '@/lib/pava/types';

/**
 * GET /api/pava/state — état LÉGER pour le store client :
 * toutes les commandes en métadonnées (statut, étape, totaux
 * pré-calculés « stats », fichiers, décisions, historique)
 * + paramètres globaux (Price Plan).
 *
 * Les ~3 500 lignes d'une commande ne sont PLUS chargées ici :
 * elles le sont à la demande via GET /commandes/[id]/lignes,
 * uniquement pour la commande consultée. Les tables enfants sont
 * lues par pages de 1 000 (limite PostgREST sur les select).
 */

const TAILLE_PAGE = 1000;

async function toutRecuperer(table: string, colonnes: string, ordre?: string): Promise<Record<string, unknown>[]> {
  const supabase = getSupabase()!;
  const rows: Record<string, unknown>[] = [];
  let depuis = 0;
  for (;;) {
    let q = supabase.from(table).select(colonnes).range(depuis, depuis + TAILLE_PAGE - 1);
    if (ordre) q = q.order(ordre);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...((data as unknown as Record<string, unknown>[]) || []));
    if (!data || data.length < TAILLE_PAGE) break;
    depuis += TAILLE_PAGE;
  }
  return rows;
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase non configuré (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' }, { status: 503 });
  }

  try {
    const { data: cmds, error } = await supabase
      .from('pava_commandes')
      .select('id, nom, mois, date_creation, statut, etape, stats')
      .order('date_creation', { ascending: true });
    if (error) throw new Error(error.message);

    const [fichiers, decisions, historique] = await Promise.all([
      toutRecuperer('pava_fichiers', 'id, commande_id, nom, date_import, feuilles, nb_lignes, mois'),
      toutRecuperer('pava_decisions', '*', 'ref_anomalie'),
      toutRecuperer('pava_historique', '*', 'date_action'),
    ]);

    const parCommande = (rows: Record<string, unknown>[]) => {
      const m = new Map<string, Record<string, unknown>[]>();
      for (const r of rows) {
        const cid = String(r.commande_id);
        if (!m.has(cid)) m.set(cid, []);
        m.get(cid)!.push(r);
      }
      return m;
    };
    const mF = parCommande(fichiers);
    const mD = parCommande(decisions);
    const mH = parCommande(historique);

    const commandes = (cmds || []).map((c: Record<string, unknown>) =>
      dbToCommande({
        ...c,
        pava_lignes: [], // lignes chargées à la demande
        pava_fichiers: mF.get(String(c.id)) || [],
        pava_decisions: mD.get(String(c.id)) || [],
        pava_historique: mH.get(String(c.id)) || [],
      })
    );

    const { data: paramsRows, error: paramsErr } = await supabase
      .from('pava_params')
      .select('params')
      .is('commande_id', null)
      .limit(1);
    if (paramsErr) throw new Error(paramsErr.message);
    const params = (paramsRows?.[0]?.params as PavaParams) || DEFAULT_PARAMS;

    return NextResponse.json({ commandes, params });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { recalculerStatsCommande } from '@/lib/pava/blob-db';
import type { PavaLigne } from '@/lib/pava-store';

/**
 * POST /api/pava/commandes/[id]/lignes/bulk — corrections / suppressions EN MASSE.
 * Body : { items: Array<{ ref: string; patch?: Partial<PavaLigne>; supprime?: boolean }> }
 * Un seul aller-retour pour des centaines de lignes (au lieu d'un appel par ligne).
 * Réponse : { ok, n, stats }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { items?: Array<{ ref?: string; patch?: Partial<PavaLigne>; supprime?: boolean }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }
  const items = (body.items || []).filter((i) => i.ref);
  if (items.length === 0) return NextResponse.json({ error: 'Aucune ligne à modifier.' }, { status: 400 });
  if (items.length > 5000) return NextResponse.json({ error: 'Trop de lignes (max 5 000).' }, { status: 400 });

  // Patches déjà enregistrés (fusion), par paquets pour rester sous la limite d'URL
  const refs = items.map((i) => String(i.ref));
  const precedents = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < refs.length; i += 200) {
    const { data } = await supabase
      .from('pava_corrections')
      .select('ligne_ref, patch')
      .eq('commande_id', id)
      .in('ligne_ref', refs.slice(i, i + 200));
    for (const c of data || []) precedents.set(c.ligne_ref, (c.patch as Record<string, unknown>) || {});
  }

  const rangees = items.map((i) => ({
    commande_id: id,
    ligne_ref: String(i.ref),
    patch: i.supprime ? {} : { ...(precedents.get(String(i.ref)) || {}), ...(i.patch || {}) },
    supprime: Boolean(i.supprime),
  }));

  for (let i = 0; i < rangees.length; i += 500) {
    const { error } = await supabase.from('pava_corrections').upsert(rangees.slice(i, i + 500), { onConflict: 'commande_id,ligne_ref' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = await recalculerStatsCommande(id);
  return NextResponse.json({ ok: true, n: rangees.length, stats });
}

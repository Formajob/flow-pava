import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { dbToLigne, patchToDb } from '@/lib/pava/db-map';
import type { PavaLigne } from '@/lib/pava-store';

/**
 * PATCH /api/pava/lignes/[id] — corriger une ligne (formulaire Contrôle).
 * Body : { patch: Partial<PavaLigne> } — seuls les champs fournis sont mis à jour.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  let body: { patch?: Partial<PavaLigne> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const colonnes = patchToDb(body.patch || {});
  if (Object.keys(colonnes).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour.' }, { status: 400 });

  const { data, error } = await supabase.from('pava_lignes').update(colonnes).eq('id', id).select().single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Ligne non mise à jour.' }, { status: 500 });

  return NextResponse.json(dbToLigne(data));
}

/** DELETE /api/pava/lignes/[id] — supprimer une ligne corrigée/erronée. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const { id } = await params;

  const { error } = await supabase.from('pava_lignes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

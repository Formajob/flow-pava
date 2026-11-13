import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSupabase } from '@/lib/supabase';
import { hasherMotDePasse } from '@/lib/pava/auth-db';

async function estAdmin(req: NextRequest): Promise<boolean> {
  const token = await getToken({ req });
  return token?.role === 'admin';
}

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/pava/utilisateurs/[id] — modifier un compte.
 * Body : { nom?, role?, multiRoles?, actif?, motDePasse? }
 * Réservé à l'Admin. Le mot de passe est re-hashé (jamais stocké en clair).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  if (!(await estAdmin(req))) return NextResponse.json({ error: 'Réservé à l’Admin.' }, { status: 403 });
  const { id } = await params;

  let body: { nom?: string; role?: string; multiRoles?: boolean; actif?: boolean; motDePasse?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const maj: Record<string, unknown> = {};
  if (body.nom !== undefined) {
    if (!body.nom.trim()) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 });
    maj.nom = body.nom.trim();
  }
  if (body.role !== undefined) {
    if (!['analyste', 'admin', 'directeur'].includes(body.role)) {
      return NextResponse.json({ error: 'Rôle inconnu.' }, { status: 400 });
    }
    maj.role = body.role;
  }
  if (body.multiRoles !== undefined) maj.multi_roles = Boolean(body.multiRoles);
  if (body.actif !== undefined) maj.actif = Boolean(body.actif);
  if (body.motDePasse !== undefined) {
    if (body.motDePasse.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit faire au moins 6 caractères.' }, { status: 400 });
    }
    maj.mot_de_passe = hasherMotDePasse(body.motDePasse);
  }
  if (Object.keys(maj).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour.' }, { status: 400 });

  const { data, error } = await supabase
    .from('pava_utilisateurs')
    .update(maj)
    .eq('id', id)
    .select('id, email, nom, role, multi_roles, actif')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Compte introuvable.' }, { status: 500 });

  return NextResponse.json({ utilisateur: data });
}

/**
 * DELETE /api/pava/utilisateurs/[id] — supprimer un compte.
 * Réservé à l'Admin. Interdit de supprimer son propre compte.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  const token = await getToken({ req });
  if (token?.role !== 'admin') return NextResponse.json({ error: 'Réservé à l’Admin.' }, { status: 403 });
  const { id } = await params;

  // Empêcher l'Admin de se verrouiller dehors
  const { data: cible } = await supabase.from('pava_utilisateurs').select('email').eq('id', id).single();
  if (cible && cible.email === token.email) {
    return NextResponse.json({ error: 'Impossible de supprimer votre propre compte.' }, { status: 400 });
  }

  const { error } = await supabase.from('pava_utilisateurs').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

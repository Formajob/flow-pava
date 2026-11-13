import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getSupabase } from '@/lib/supabase';
import { hasherMotDePasse } from '@/lib/pava/auth-db';

/** Vérifie que l'appel vient d'un Admin connecté. */
async function estAdmin(req: NextRequest): Promise<boolean> {
  const token = await getToken({ req });
  return token?.role === 'admin';
}

/**
 * GET /api/pava/utilisateurs — liste des comptes (sans les hash).
 * Réservé à l'Admin.
 */
export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  if (!(await estAdmin(req))) return NextResponse.json({ error: 'Réservé à l’Admin.' }, { status: 403 });

  const { data, error } = await supabase
    .from('pava_utilisateurs')
    .select('id, email, nom, role, multi_roles, actif, date_creation')
    .order('email');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ utilisateurs: data || [] });
}

/**
 * POST /api/pava/utilisateurs — créer un compte.
 * Body : { email, nom, role, multiRoles?, motDePasse? }
 * Réservé à l'Admin.
 */
export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 503 });
  if (!(await estAdmin(req))) return NextResponse.json({ error: 'Réservé à l’Admin.' }, { status: 403 });

  let body: { email?: string; nom?: string; role?: string; multiRoles?: boolean; motDePasse?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const nom = (body.nom || '').trim();
  const role = body.role || 'analyste';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
  }
  if (!nom) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 });
  if (!['analyste', 'admin', 'directeur'].includes(role)) {
    return NextResponse.json({ error: 'Rôle inconnu.' }, { status: 400 });
  }
  if (body.motDePasse && body.motDePasse.length < 6) {
    return NextResponse.json({ error: 'Le mot de passe doit faire au moins 6 caractères.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('pava_utilisateurs')
    .insert({
      email,
      nom,
      role,
      multi_roles: Boolean(body.multiRoles),
      mot_de_passe: body.motDePasse ? hasherMotDePasse(body.motDePasse) : null,
    })
    .select('id, email, nom, role, multi_roles, actif, date_creation')
    .single();
  if (error) {
    const dejaLa = /duplicate key|unique/i.test(error.message);
    return NextResponse.json(
      { error: dejaLa ? 'Cette adresse existe déjà.' : error.message },
      { status: dejaLa ? 409 : 500 }
    );
  }

  return NextResponse.json({ utilisateur: data }, { status: 201 });
}

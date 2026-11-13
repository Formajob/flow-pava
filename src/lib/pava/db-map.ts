/**
 * Mapping entre les lignes Supabase (colonnes snake_case des tables pava_*)
 * et les types de l'application (PavaLigne, Commande…).
 * Utilisé uniquement côté serveur (routes API).
 */

import type { PavaLigne, ImportedFile, Decision, Commande, Categorie } from '../pava-store';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function dbToLigne(r: any): PavaLigne {
  return {
    id: String(r.id),
    mois: r.mois || '',
    compte: r.compte || '',
    produit: r.produit || '',
    famille: r.famille || '',
    type: r.type || '',
    desc: r.desc_service || '',
    categorie: (r.categorie || 'AJOUT') as Categorie,
    source: r.source || '',
    puissance: r.puissance || '',
    quantite: r.quantite ?? 1,
    montantOrigine: r.montant_origine ?? null,
    montantCalcule: r.montant_calcule ?? undefined,
    ajustement: r.ajustement ?? 0,
    statut: r.statut || '',
    incoherence: r.incoherence || '',
    incomplet: r.incomplet ? 'Grille incomplète' : '',
    feuille: r.feuille || '',
    ligneExcel: r.ligne_excel ?? undefined,
  };
}

export function ligneToDb(l: PavaLigne, commandeId: string, fichierId: string | null) {
  return {
    commande_id: commandeId,
    fichier_id: fichierId,
    mois: l.mois || null,
    feuille: l.feuille || null,
    ligne_excel: l.ligneExcel ?? null,
    compte: l.compte || null,
    produit: l.produit || null,
    famille: l.famille || null,
    type: l.type || null,
    desc_service: l.desc || null,
    categorie: l.categorie,
    source: l.source || null,
    puissance: l.puissance || null,
    quantite: l.quantite ?? 1,
    montant_origine: l.montantOrigine ?? null,
    montant_calcule: l.montantCalcule ?? null,
    ajustement: l.ajustement ?? 0,
    statut: l.statut || null,
    incoherence: l.incoherence || null,
    incomplet: Boolean(l.incomplet),
    ligne_total: Boolean((l as any).ligne_total),
    brut: ((l as any).brut as Record<string, unknown> | undefined) ?? null,
  };
}

/** Champs de PavaLigne modifiables depuis le formulaire de correction → colonnes DB. */
export function patchToDb(patch: Partial<PavaLigne>) {
  const out: Record<string, unknown> = {};
  if ('compte' in patch) out.compte = patch.compte || null;
  if ('produit' in patch) out.produit = patch.produit || null;
  if ('famille' in patch) out.famille = patch.famille || null;
  if ('type' in patch) out.type = patch.type || null;
  if ('desc' in patch) out.desc_service = patch.desc || null;
  if ('categorie' in patch) out.categorie = patch.categorie;
  if ('source' in patch) out.source = patch.source || null;
  if ('puissance' in patch) out.puissance = patch.puissance || null;
  if ('quantite' in patch) out.quantite = patch.quantite ?? 1;
  if ('montantOrigine' in patch) out.montant_origine = patch.montantOrigine ?? null;
  if ('montantCalcule' in patch) out.montant_calcule = patch.montantCalcule ?? null;
  if ('ajustement' in patch) out.ajustement = patch.ajustement ?? 0;
  if ('statut' in patch) out.statut = patch.statut || null;
  if ('incoherence' in patch) out.incoherence = patch.incoherence || null;
  if ('incomplet' in patch) out.incomplet = Boolean(patch.incomplet);
  return out;
}

export function dbToFichier(f: any): ImportedFile {
  return {
    id: String(f.id),
    nom: f.nom,
    date: f.date_import,
    feuilles: f.feuilles || [],
    nbLignes: f.nb_lignes ?? 0,
    mois: f.mois || '',
  };
}

/** Commande complète depuis un select embarqué (pava_lignes(*), …). */
export function dbToCommande(c: any): Commande {
  const decisions: Record<string, Decision> = {};
  for (const d of c.pava_decisions || []) {
    decisions[d.ref_anomalie] = { statut: d.statut, commentaire: d.commentaire || '' };
  }
  return {
    id: String(c.id),
    nom: c.nom,
    mois: c.mois || undefined,
    dateCreation: c.date_creation,
    statut: c.statut,
    etape: c.etape,
    lignes: (c.pava_lignes || []).map(dbToLigne),
    fichiers: (c.pava_fichiers || []).map(dbToFichier),
    decisions,
    historique: (c.pava_historique || []).map((h: any) => ({ date: h.date_action, action: h.action })),
    stats: c.stats || undefined,
  };
}

/** Colonnes à sélectionner pour une commande complète. */
export const SELECT_COMMANDE = '*, pava_lignes(*), pava_fichiers(*), pava_decisions(*), pava_historique(*)';

import type { PavaLigne } from '@/lib/pava-store';

/**
 * Totaux pré-calculés d'une commande — stockés dans
 * pava_commandes.stats pour que le tableau de bord et la liste
 * des factures s'affichent SANS charger les ~3 500 lignes.
 * Même formule que l'ancien calcul côté client du tableau de bord.
 */

export interface StatsCategorie {
  n: number;
  m: number;
}

export interface StatsCommande {
  nbLignes: number;
  totalFacture: number;
  totalCalcule: number;
  nbIncoherences: number;
  parCategorie: Record<string, StatsCategorie>;
}

export const STATS_VIDES: StatsCommande = {
  nbLignes: 0,
  totalFacture: 0,
  totalCalcule: 0,
  nbIncoherences: 0,
  parCategorie: {},
};

/** Fusionne les stats de plusieurs commandes (vue globale du tableau de bord). */
export function fusionnerStats(liste: StatsCommande[]): StatsCommande {
  const out: StatsCommande = { nbLignes: 0, totalFacture: 0, totalCalcule: 0, nbIncoherences: 0, parCategorie: {} };
  for (const s of liste) {
    out.nbLignes += s.nbLignes || 0;
    out.totalFacture += s.totalFacture || 0;
    out.totalCalcule += s.totalCalcule || 0;
    out.nbIncoherences += s.nbIncoherences || 0;
    for (const [cat, v] of Object.entries(s.parCategorie || {})) {
      const cur = out.parCategorie[cat] || { n: 0, m: 0 };
      cur.n += v.n || 0;
      cur.m += v.m || 0;
      out.parCategorie[cat] = cur;
    }
  }
  return out;
}

/** Calcule les stats d'une commande à partir de ses lignes (serveur). */
export function calculerStats(lignes: PavaLigne[]): StatsCommande {
  const parCategorie: Record<string, StatsCategorie> = {};
  let totalFacture = 0;
  let totalCalcule = 0;
  let nbIncoherences = 0;
  for (const l of lignes) {
    const montant = (l.montantCalcule ?? 0) + (l.ajustement || 0);
    const cat = l.categorie || 'AJOUT';
    const cur = parCategorie[cat] || { n: 0, m: 0 };
    cur.n += l.quantite ?? 1;
    cur.m += montant;
    parCategorie[cat] = cur;
    totalFacture += l.montantOrigine ?? 0;
    totalCalcule += montant;
    if (l.incomplet || l.incoherence) nbIncoherences++;
  }
  return { nbLignes: lignes.length, totalFacture, totalCalcule, nbIncoherences, parCategorie };
}

/**
 * Moteur PAVA — orchestre normalisation + recalcul + règles.
 * Entrée : lignes normalisées. Sortie : lignes recalculées + anomalies + totaux.
 * Code déterministe testable, jamais de LLM.
 */

import type { Anomaly, PavaParams, PavaRow } from './types';
import { DEFAULT_PARAMS } from './types';
import { montantAttendu } from './price-plan';
import { runAllRules } from './rules';

export interface EngineResult {
  lignes: PavaRow[];
  anomalies: Anomaly[];
  totalFacture: number;
  totalRecalcule: number;
  impactNet: number;
  parRegle: Record<string, number>;
  parConfiance: Record<string, number>;
}

export function runEngine(rows: PavaRow[], params: PavaParams = DEFAULT_PARAMS, opts: { historique?: PavaRow[]; com?: PavaRow[]; synthese?: { quantite: number; montant: number } } = {}): EngineResult {
  // 1. Recalcul du montant attendu pour chaque ligne
  const lignes = rows.map((r) => {
    const attendu = montantAttendu(r, params);
    const ecart = r.paiement_pav !== null && attendu !== null ? attendu - r.paiement_pav : null;
    return { ...r, montant_attendu: attendu, ecart };
  });

  // 2. Règles de contrôle
  const anomalies = runAllRules(lignes, params, opts);

  // 3. Totaux (hors lignes de total)
  const payees = lignes.filter((r) => !r.ligne_total);
  const totalFacture = payees.reduce((s, r) => s + (r.paiement_pav ?? 0), 0);
  const totalRecalcule = payees.reduce((s, r) => s + (r.montant_attendu ?? 0), 0);
  const impactNet = anomalies.reduce((s, a) => s + a.impact, 0);

  const parRegle: Record<string, number> = {};
  const parConfiance: Record<string, number> = {};
  for (const a of anomalies) {
    parRegle[a.regle] = (parRegle[a.regle] || 0) + 1;
    parConfiance[a.confiance] = (parConfiance[a.confiance] || 0) + 1;
  }

  return { lignes, anomalies, totalFacture, totalRecalcule, impactNet, parRegle, parConfiance };
}

/** Convertit les lignes démo (pava-store) vers le schéma normalisé pour le moteur. */
export function depuisDemo(lignes: Array<Record<string, unknown>>, periode: string): PavaRow[] {
  return lignes.map((l, i) => ({
    periode: String(l.mois || periode),
    feuille: String(l.feuille || 'RENOUVELLEMENT'),
    format: 'VL' as const,
    ligne_excel: Number(l.ligneExcel || i + 2),
    cle_com: String(l.cle_com || ''),
    no_cli: String(l.compte || ''),
    nom_client: '',
    nature: (String(l.categorie || 'AJOUT').toUpperCase() === 'RENOUVELLEMENT' ? 'RENO' : String(l.categorie || 'AJOUT').toUpperCase()) as PavaRow['nature'],
    famille: String(l.famille || 'CAB'),
    code_service: String(l.desc || l.produit || ''),
    puissance: String(l.puissance || ''),
    nb_mois_eng: l.moisEng ? Number(l.moisEng) : null,
    qty: Number(l.quantite || 1),
    date_compl: null,
    mois_compl: String(l.mois || periode),
    src_code: String(l.source || '43'),
    vendeur_no: '',
    vendeur_nom: '',
    tp_com_ci: '',
    raison: '',
    paiement_pav: l.montantOrigine !== null && l.montantOrigine !== undefined ? Number(l.montantOrigine) : null,
    ligne_total: false,
  }));
}

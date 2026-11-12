/**
 * FLOW VL PAVA — types du moteur de détection.
 * Schéma commun (section 2 du prompt) + anomalie (section 5).
 * Calculs déterministes, jamais par LLM.
 */

export type Nature = 'RENO' | 'AJOUT' | 'SACA' | 'NON_FACTUREE';
export type FormatFeuille = 'VL' | 'ACJ' | 'COM';
export type Confiance = 'REGLE' | 'PROBABLE' | 'A_VALIDER' | 'INFO';
export type StatutAnomalie = 'ouvert' | 'valide' | 'rejete';

/** Une ligne normalisée = une ligne de la facture. */
export interface PavaRow {
  periode: string; // '2026-09' | '2026-10'
  feuille: string;
  format: FormatFeuille;
  ligne_excel: number;
  cle_com: string;
  no_cli: string;
  nom_client: string;
  nature: Nature;
  famille: string; // CAB, TPC, CELL, NUM, REDO, TIPN, WIFIPRO
  code_service: string; // DESC_ABR_SERV
  puissance: string;
  nb_mois_eng: number | null;
  qty: number;
  date_compl: string | null; // ISO yyyy-mm-dd
  mois_compl: string | null; // '2026-10'
  src_code: string; // 43, 45, 41, 07
  vendeur_no: string;
  vendeur_nom: string;
  tp_com_ci: string;
  raison: string;
  paiement_pav: number | null;
  ligne_total: boolean;
  // Recalculé par le moteur
  montant_attendu?: number | null;
  ecart?: number | null;
}

/** Une anomalie = une ligne du rapport (section 5). */
export interface Anomaly {
  id: string; // Réf unique : R01-0001, etc.
  regle: string; // R01, R02, ...
  feuille: string;
  ligne_excel: number;
  cle_com: string;
  no_cli: string;
  raison: string; // court
  explication: string; // avec chiffres
  solution: string; // action concrète
  impact: number; // négatif = surfacturé, positif = sous-facturé
  confiance: Confiance;
  statut: StatutAnomalie;
  commentaire: string;
  famille: string;
  periode: string;
}

/** Paramètres éditables (section 3 + 4). */
export interface PavaParams {
  renouvellement: number; // 65
  internet: Record<string, number>; // 15:150, 100:200, 200:250, 400:300, 500:300, Giga:300
  tpc: Record<string, number>; // 60:150, 36:100, 12:100, 24:100, sans:100
  sim: number; // 150
  tv: number; // 100
  tipn: number; // 100
  wifipro: number; // 50
  redo: number; // 40
  forfait5050: number; // 200 (à confirmer)
  n_mois: number; // 3 (R03)
  demenagement_payable: boolean; // R09
  sources: string[]; // 43, 45, 41, etc.
}

export const DEFAULT_PARAMS: PavaParams = {
  renouvellement: 65,
  internet: { '15': 150, '100': 200, '200': 250, '400': 300, '500': 300, 'Giga': 300 },
  tpc: { '60': 150, '36': 100, '12': 100, '24': 100, 'sans': 100 },
  sim: 150,
  tv: 100,
  tipn: 100,
  wifipro: 50,
  redo: 40,
  forfait5050: 200,
  n_mois: 3,
  demenagement_payable: false,
  sources: ['43', '45', '41', '07'],
};

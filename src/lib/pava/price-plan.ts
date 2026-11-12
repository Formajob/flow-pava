/**
 * Price Plan — montant attendu (section 3 du prompt).
 * Fonction pure, testable. Paramètres éditables, jamais codés en dur dans les règles.
 */

import type { PavaParams, PavaRow } from './types';

export function prixUnitaire(row: PavaRow, params: PavaParams): number | null {
  const code = (row.code_service || '').toUpperCase();
  const puissance = (row.puissance || '').trim();
  const eng = row.nb_mois_eng;

  // Renouvellement : 65 $ par ligne
  if (row.nature === 'RENO') {
    return params.renouvellement;
  }

  // SACA : price plan pour branchement (65 pour renouvellement géré via nature RENO)
  // Les lignes SACA ici sont des branchements : on applique le price plan ajout ci-dessous.

  // Internet (CAB)
  if (row.famille === 'CAB') {
    if (puissance === '50' || code.includes('50/50')) return params.forfait5050;
    if (puissance === '500') return params.internet['500'] ?? 300; // exception : prix du 400
    if (puissance === 'Giga' || puissance === '940') return params.internet['Giga'] ?? 300;
    if (puissance === '400') return params.internet['400'] ?? 300;
    if (puissance === '200') return params.internet['200'] ?? 250;
    if (puissance === '100') return params.internet['100'] ?? 200;
    if (puissance === '15') return params.internet['15'] ?? 150;
    // Fallback par code
    if (code.includes('GIGA')) return params.internet['Giga'] ?? 300;
    if (code.includes('500')) return params.internet['500'] ?? 300;
    if (code.includes('400')) return params.internet['400'] ?? 300;
    if (code.includes('200')) return params.internet['200'] ?? 250;
    if (code.includes('100')) return params.internet['100'] ?? 200;
    if (code.includes('15')) return params.internet['15'] ?? 150;
    return null; // R10 : grille incomplète
  }

  // TPC (ligne téléphonique)
  if (row.famille === 'TPC') {
    if (eng === 60) return params.tpc['60'] ?? 150;
    if (eng === 36) return params.tpc['36'] ?? 100;
    // Exception : sans engagement, 12 ou 24 mois → prix du 36 mois
    if (eng === null || eng === 0 || eng === 12 || eng === 24) return params.tpc['sans'] ?? 100;
    return null;
  }

  // SIM / TMO (CELL)
  if (row.famille === 'CELL') return params.sim;

  // TV (NUM)
  if (row.famille === 'NUM') return params.tv;

  // TIPN
  if (row.famille === 'TIPN') return params.tipn;

  // WIFIPRO
  if (row.famille === 'WIFIPRO') return params.wifipro;

  // Redondance
  if (row.famille === 'REDO') return params.redo;

  return null;
}

/** Montant attendu = prix unitaire × qty (SIM déjà à l'unité). */
export function montantAttendu(row: PavaRow, params: PavaParams): number | null {
  const pu = prixUnitaire(row, params);
  if (pu === null) return null;
  return pu * (row.qty || 1);
}

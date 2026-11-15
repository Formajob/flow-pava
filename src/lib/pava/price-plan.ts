/**
 * Price Plan — montant attendu (section 3 du prompt).
 * Fonction pure, testable. Paramètres éditables, jamais codés en dur dans les règles.
 */

import type { PavaParams, PavaRow } from './types';

/** Prix unitaire attendu, ou null si la ligne n'est pas contrôlable / hors grille. */
export function prixUnitaire(row: PavaRow, params: PavaParams): number | null {
  // Format ACJ : pas de forfait ni d'engagement → on ne peut pas recalculer un ajout Internet / TPC
  if (!row.verifiable) return null;

  const code = (row.code_service || '').toUpperCase();
  const puissance = (row.puissance || '').trim();
  const eng = row.nb_mois_eng;

  // Renouvellement : 65 $ par ligne (y compris un renouvellement saisi en SACA ou « non facturée »)
  const renouv = (row.type_cmd || '').toUpperCase().includes('RENOUVEL');
  if (row.nature === 'RENO' || ((row.nature === 'SACA' || row.nature === 'NON_FACTUREE') && renouv)) {
    return params.renouvellement;
  }

  // Internet (CAB)
  if (row.famille === 'CAB') {
    if (puissance === '50' || code.includes('50/50')) return params.forfait5050;
    if (puissance === '500') return params.internet['500'] ?? params.internet['400'] ?? 300; // exception : prix du 400
    if (puissance === 'Giga' || puissance === '940') return params.internet['Giga'] ?? 300;
    if (puissance === '400') return params.internet['400'] ?? 300;
    if (puissance === '200') return params.internet['200'] ?? 250;
    if (puissance === '100') return params.internet['100'] ?? 200;
    if (puissance === '15') return params.internet['15'] ?? 150;
    if (code.includes('GIGA') || code.includes('1GB')) return params.internet['Giga'] ?? 300;
    if (code.includes('500')) return params.internet['500'] ?? params.internet['400'] ?? 300;
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

  if (row.famille === 'CELL') return params.sim;
  if (row.famille === 'NUM') return params.tv;
  if (row.famille === 'TIPN') return params.tipn;
  if (row.famille === 'WIFIPRO') return params.wifipro;
  if (row.famille === 'REDO') return params.redo;

  return null;
}

/** Montant attendu = prix unitaire × qty (SIM déjà à l'unité). */
export function montantAttendu(row: PavaRow, params: PavaParams): number | null {
  const pu = prixUnitaire(row, params);
  if (pu === null) return null;
  return pu * (row.qty || 1);
}

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

export function runEngine(rows: PavaRow[], params: PavaParams = DEFAULT_PARAMS, opts: { historique?: PavaRow[]; com?: PavaRow[]; synthese?: { quantite: number | null; montant: number | null } } = {}): EngineResult {
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
  const totalRecalcule = payees.reduce((s, r) => s + (r.montant_attendu ?? r.paiement_pav ?? 0), 0);
  const impactNet = anomalies.reduce((s, a) => s + a.impact, 0);

  const parRegle: Record<string, number> = {};
  const parConfiance: Record<string, number> = {};
  for (const a of anomalies) {
    parRegle[a.regle] = (parRegle[a.regle] || 0) + 1;
    parConfiance[a.confiance] = (parConfiance[a.confiance] || 0) + 1;
  }

  return { lignes, anomalies, totalFacture, totalRecalcule, impactNet, parRegle, parConfiance };
}

/** Historique compact des renouvellements (endpoint /renouvellements)
 * → lignes minimales pour la règle R03 (déjà renouvelé − N mois). */
export function historiqueVersRows(
  refs: Array<{ periode: string; noCli: string; codeService: string; feuille: string; ligneExcel: number }>
): PavaRow[] {
  return refs.map((r) => ({
    periode: r.periode,
    feuille: r.feuille,
    format: 'VL' as const,
    ligne_excel: r.ligneExcel,
    cle_com: '',
    no_cli: r.noCli,
    nom_client: '',
    nature: 'RENO' as const,
    famille: '',
    code_service: r.codeService,
    puissance: '',
    nb_mois_eng: null,
    qty: 1,
    date_compl: null,
    mois_compl: r.periode,
    src_code: '',
    vendeur_no: '',
    vendeur_nom: '',
    tp_com_ci: '',
    raison: '',
    paiement_pav: null,
    ligne_total: false,
    ligne_id: '',
    no_serv: '',
    type_cmd: '',
    verifiable: true,
    ancienne: true,
  }));
}

/**
 * Convertit les lignes de l'application (PavaLigne) vers le schéma normalisé du moteur.
 * Utilise `meta` (clé commande, n° service, engagement, dates, type…) conservé à l'import ;
 * sans `meta` (ancien import) la ligne est marquée `ancienne` et certaines règles sont dégradées.
 */
export function depuisDemo(lignes: Array<Record<string, unknown>>, periode: string): PavaRow[] {
  return lignes.map((l, i) => {
    const m = (l.meta || null) as import('./types').LigneMeta | null;
    const cat = String(l.categorie || 'AJOUT').toUpperCase();
    const famille = String(l.famille || l.produit || 'AUTRE');
    return {
      periode: String(l.mois || periode),
      feuille: String(l.feuille || 'RENOUVELLEMENT'),
      format: (m?.format || 'VL') as PavaRow['format'],
      ligne_excel: Number(l.ligneExcel || i + 2),
      cle_com: m?.cle_com || '',
      no_cli: String(l.compte || ''),
      nom_client: m?.nom_client || '',
      nature: (cat === 'RENOUVELLEMENT' ? 'RENO' : cat) as PavaRow['nature'],
      famille,
      code_service: String(l.desc || ''),
      puissance: String(l.puissance || ''),
      nb_mois_eng: m?.nb_mois_eng ?? null,
      qty: Number(l.quantite || 1),
      date_compl: m?.date_compl ?? null,
      mois_compl: m?.mois_compl ?? String(l.mois || periode),
      src_code: String(l.source || '43'),
      vendeur_no: m?.vendeur_no || '',
      vendeur_nom: m?.vendeur_nom || '',
      tp_com_ci: m?.tp_com_ci || '',
      raison: m?.raison || '',
      paiement_pav: l.montantOrigine !== null && l.montantOrigine !== undefined ? Number(l.montantOrigine) : null,
      ligne_total: false,
      ligne_id: String(l.id || ''),
      no_serv: m?.no_serv || '',
      type_cmd: m?.type_cmd || '',
      // ACJ : Internet / TPC en ajout non contrôlables (pas de forfait ni d'engagement)
      verifiable: !(m?.format === 'ACJ' && cat === 'AJOUT' && (famille === 'CAB' || famille === 'TPC')),
      ancienne: !m,
    };
  });
}

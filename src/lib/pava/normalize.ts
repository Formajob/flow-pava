/**
 * Import et normalisation (sections 1–2 du prompt).
 * Détection des feuilles par nom + colonnes, matching tolérant.
 * Ne modifie jamais le fichier source. Conserve la ligne Excel.
 */

import type { FormatFeuille, Nature, PavaRow } from './types';

export interface FeuilleDetectee {
  nom: string;
  format: FormatFeuille;
  nature: Nature;
  colonnes: string[];
  avertissement?: string;
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Détecte le type de feuille par son nom (insensible casse/espaces). */
export function detecterFeuille(nom: string, colonnes: string[]): FeuilleDetectee {
  const n = norm(nom);
  const cols = colonnes.map(norm).join(' | ');

  if (n.includes('price plan') || n.includes('priceplan')) {
    return { nom, format: 'VL', nature: 'AJOUT', colonnes, avertissement: 'Feuille Price Plan : sert au recalcul, jamais source de lignes.' };
  }
  if (n.startsWith('fac pava') || n.includes('sommaire')) {
    return { nom, format: 'VL', nature: 'AJOUT', colonnes, avertissement: 'Synthèse : rapprochement des totaux uniquement.' };
  }
  if (n.includes('commande non facturee')) {
    return { nom, format: 'VL', nature: 'NON_FACTUREE', colonnes };
  }
  if (n.includes('source saca') || n.includes('saca')) {
    return { nom, format: 'VL', nature: 'SACA', colonnes };
  }
  if (n.includes('renouvellement 2') || n.includes('ajout 2')) {
    // Format ACJ : pas de CLE_COM, ni forfait, ni engagement
    const nature: Nature = n.includes('ajout') ? 'AJOUT' : 'RENO';
    return { nom, format: 'ACJ', nature, colonnes };
  }
  if (n.includes('renouvellement') || n.includes('renw')) {
    return { nom, format: 'VL', nature: 'RENO', colonnes };
  }
  if (n.includes('ajout')) {
    return { nom, format: 'VL', nature: 'AJOUT', colonnes };
  }
  if (n.includes('com') && cols.includes('no_cli')) {
    return { nom, format: 'COM', nature: 'RENO', colonnes };
  }
  return { nom, format: 'VL', nature: 'AJOUT', colonnes, avertissement: 'Feuille non reconnue : mapping à confirmer.' };
}

/** Famille depuis le code service (VL) ou le type ACJ. */
export function familleDepuisCode(code: string, typeAcj = ''): string {
  const c = (code || '').toUpperCase();
  const t = (typeAcj || '').toUpperCase();
  if (t.includes('INT_CAB') || c.includes('CAB')) return 'CAB';
  if (t.includes('TPC_ACCES') || c.includes('TPC')) return 'TPC';
  if (t.includes('TSF_ACCES') || c.includes('CELL') || c.includes('TMO') || c.includes('SIM')) return 'CELL';
  if (t.includes('TIPN') || c.includes('TIPN')) return 'TIPN';
  if (t.includes('ACCES_WIFI') || c.includes('WIFIPRO') || c.includes('WIFI')) return 'WIFIPRO';
  if (t.includes('TSF_INT_REDOND') || c.includes('REDO') || c.includes('GRED')) return 'REDO';
  if (c.includes('NUM') || c.includes('TV') || c.includes('BANA')) return 'NUM';
  return c || 'CAB';
}

/** Source : CD_SRC_COM (VL) ou No Source Ci (ACJ). 43=TMA, 45=GE, 41=RETA, 7=SACA. */
export function sourceDepuisCode(code: string): string {
  const c = (code || '').trim();
  if (c === '43' || c === '45' || c === '41' || c === '7' || c === '07') return c === '7' ? '07' : c;
  return c || '43';
}

/** Marque les lignes de total (sans client ni date, seulement un montant). */
export function estLigneTotal(noCli: string, dateCompl: string | null, montant: number | null): boolean {
  return (!noCli || !noCli.trim()) && !dateCompl && montant !== null && montant !== 0;
}

/** Normalise une ligne brute (objet colonne→valeur) vers le schéma commun. */
export function normaliserLigne(brute: Record<string, unknown>, feuille: FeuilleDetectee, ligneExcel: number, periode: string): PavaRow {
  const get = (...noms: string[]) => {
    for (const n of noms) {
      const cle = Object.keys(brute).find((k) => norm(k) === norm(n));
      if (cle) return brute[cle];
    }
    return '';
  };
  const str = (v: unknown) => String(v ?? '').trim();
  const num = (v: unknown) => {
    const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const noCli = str(get('NO_CLI', 'No Client', 'no_cli'));
  const dateComplBrute = str(get('DT_COMPL_COM', 'Date Completée', 'DT_COMPL_AN_VL'));
  const paiement = num(get('PAIEMENT_PAV', 'Paiement PAV', 'paiement pav'));
  const ligneTotal = estLigneTotal(noCli, dateComplBrute || null, paiement);

  const codeService = str(get('DESC_ABR_SERV', 'Type Commande', 'code_service'));
  const typeAcj = str(get('Type Commande'));
  const famille = familleDepuisCode(codeService, feuille.format === 'ACJ' ? typeAcj : '');

  const nbEng = num(get('NB_MOIS_ENG', 'nb_mois_eng'));
  const qty = num(get('QT_SERV_COM_COMPL', 'Quantite Services', 'qty')) ?? 1;
  const src = sourceDepuisCode(str(get('CD_SRC_COM', 'No Source Ci', 'src_code')));

  return {
    periode,
    feuille: feuille.nom,
    format: feuille.format,
    ligne_excel: ligneExcel,
    cle_com: str(get('CLE_COM', 'cle_com')),
    no_cli: noCli,
    nom_client: str(get('NOM_CLIENT', 'nom_client')),
    nature: feuille.nature,
    famille,
    code_service: codeService,
    puissance: str(get('PUISSANCE', 'puissance')),
    nb_mois_eng: nbEng,
    qty: qty || 1,
    date_compl: dateComplBrute || null,
    mois_compl: dateComplBrute ? dateComplBrute.slice(0, 7) : null,
    src_code: src,
    vendeur_no: str(get('NOM_VENDEUR', 'vendeur_no')),
    vendeur_nom: str(get('NOM_VENDEUR', 'vendeur_nom')),
    tp_com_ci: str(get('TP_COM_CI', 'tp_com_ci')),
    raison: str(get('DESC_RSN_COM', 'Raison Du Débranchement', 'raison')),
    paiement_pav: paiement,
    ligne_total: ligneTotal,
  };
}

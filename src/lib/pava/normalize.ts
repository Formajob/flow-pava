/**
 * Import et normalisation (sections 1–2 du prompt).
 * Détection des feuilles par nom + colonnes, matching tolérant.
 * Ne modifie jamais le fichier source. Conserve la ligne Excel.
 */

import type { FormatFeuille, LigneMeta, Nature, PavaRow } from './types';
import type { PavaLigne } from '../pava-store';

export interface FeuilleDetectee {
  nom: string;
  format: FormatFeuille;
  nature: Nature;
  colonnes: string[];
  avertissement?: string;
  /** Vrai = feuille de référence (Price Plan, synthèse, COM) : jamais importée comme lignes facturables. */
  ignorer?: boolean;
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Détecte le type de feuille : 1) par son nom (insensible casse/espaces),
 * 2) à défaut par son CONTENU — colonnes présentes + valeurs d'un échantillon
 * (un fichier renommé ou resserré doit quand même être importé et analysé,
 * pas silencieusement ignoré).
 */
export function detecterFeuille(
  nom: string,
  colonnes: string[],
  echantillon: Record<string, unknown>[] = [],
): FeuilleDetectee {
  const n = norm(nom);
  const cols = colonnes.map(norm).join(' | ');
  const ensemble = new Set(colonnes.map(norm));
  const a = (...noms: string[]) => noms.some((x) => ensemble.has(norm(x)));

  /** Nature devinée depuis les données : colonne type de commande + code source. */
  const natureDepuisContenu = (): { nature: Nature; detail: string } => {
    const scores: Record<'reno' | 'ajout' | 'saca', number> = { reno: 0, ajout: 0, saca: 0 };
    const colType = ['TYPE_COMMANDE_COR', 'TYPE_COMMANDE', 'COMMANDES', 'COMMANDE', 'TYPE_CMD'].find((c) => ensemble.has(norm(c)));
    const colSrc = ['CD_SRC_COM', 'SRC_COM_TXT', 'SRC_COM', 'SOURCE', 'No Source Ci'].find((c) => ensemble.has(norm(c)));
    for (const row of echantillon) {
      const val = (c?: string) => (c ? String(row[c] ?? '') : '');
      const t = val(colType).toUpperCase();
      if (/RENOUVEL|NOUVELLE|RENO\b/.test(t)) scores.reno += 2;
      if (/AJOUT|BRANCHE/.test(t)) scores.ajout += 2;
      const src = val(colSrc).toUpperCase().trim();
      if (src === 'SACA' || src === '7' || src === '07') scores.saca += 2;
    }
    // Indices venant des colonnes elles-mêmes (feuille sans type ni source lisible).
    if (/renouvel|reno\b/.test(cols)) scores.reno += 1;
    if (/ajout|branchement/.test(cols)) scores.ajout += 1;
    if (/saca/.test(cols)) scores.saca += 1;
    if (/non.?factur/.test(cols)) return { nature: 'NON_FACTUREE', detail: 'colonnes évoquant des commandes non facturées' };
    const best = (Object.entries(scores) as ['reno' | 'ajout' | 'saca', number][]).sort((x, y) => y[1] - x[1])[0];
    if (best[1] > 0) {
      const nature: Nature = best[0] === 'reno' ? 'RENO' : best[0] === 'saca' ? 'SACA' : 'AJOUT';
      return { nature, detail: best[0] === 'reno' ? 'commandes « NOUVELLEMENT »' : best[0] === 'saca' ? 'source SACA' : 'commandes « AJOUT »' };
    }
    return { nature: 'AJOUT', detail: 'aucun indice — hypothèse AJOUT' };
  };

  if (n.includes('price plan') || n.includes('priceplan')) {
    return { nom, format: 'VL', nature: 'AJOUT', colonnes, ignorer: true, avertissement: 'Price Plan : sert au recalcul, jamais source de lignes.' };
  }
  if (n.startsWith('fac pava') || n.includes('sommaire')) {
    return { nom, format: 'VL', nature: 'AJOUT', colonnes, ignorer: true, avertissement: 'Synthèse : rapprochement des totaux uniquement.' };
  }
  if (n.includes('renw')) {
    // Fichier COM (renouvellements source 45) : référence de contrôle R08, pas des lignes facturables
    return { nom, format: 'COM', nature: 'RENO', colonnes, ignorer: true, avertissement: 'Fichier COM : référence de contrôle, non importé comme lignes (éviter le double comptage).' };
  }
  if (n.includes('commande non facturee')) {
    return { nom, format: 'VL', nature: 'NON_FACTUREE', colonnes };
  }
  if (n.includes('saca')) {
    return { nom, format: 'VL', nature: 'SACA', colonnes };
  }
  if (n.includes('renouvellement 2') || n.includes('ajout 2')) {
    // Format ACJ : pas de CLE_COM, ni forfait, ni engagement
    const nature: Nature = n.includes('ajout') ? 'AJOUT' : 'RENO';
    return { nom, format: 'ACJ', nature, colonnes };
  }
  if (n.includes('renouvellement')) return { nom, format: 'VL', nature: 'RENO', colonnes };
  if (n.includes('ajout')) return { nom, format: 'VL', nature: 'AJOUT', colonnes };
  // ── Nom inconnu : décider par le CONTENU (colonnes + données) ──
  const aLaFois = (...noms: string[]) => noms.every((x) => cols.includes(norm(x)));
  const estFeuilleData = a('NO_CLI', 'No Client', 'NO_CLIENT', 'NUM_CLI') || aLaFois('CLE_COM', 'NO_SERV');
  if (estFeuilleData) {
    const { nature, detail } = natureDepuisContenu();
    return {
      nom, format: 'VL', nature, colonnes,
      avertissement: `Nom de feuille inconnu — importée comme ${nature === 'RENO' ? 'RENOUVELLEMENT' : nature === 'SACA' ? 'SOURCE SACA' : nature} (${detail}). Vérifiez la catégorie.`,
    };
  }
  return { nom, format: 'VL', nature: 'AJOUT', colonnes, ignorer: true, avertissement: 'Feuille sans colonnes PAVA reconnues (ni N° client, ni commande/service) : ignorée.' };
}

const FAMILLES = ['CAB', 'CELL', 'NUM', 'REDO', 'TIPN', 'TPC', 'WIFIPRO'];
const GROUPES_ACJ: Record<string, string> = {
  INT_CAB: 'CAB', TPC_ACCES: 'TPC', TSF_ACCES: 'CELL', TIPN_ACCES: 'TIPN', ACCES_WIFI: 'WIFIPRO', TSF_INT_REDOND: 'REDO',
};

/**
 * Famille normalisée. On se fie d'abord à la colonne officielle de l'export
 * (SOUS_FAMILLE_AFF en VL, Groupe Service en ACJ) ; les codes bruts ne servent
 * qu'en dernier recours. Inconnu → 'AUTRE' (jamais 'CAB' par défaut).
 */
export function familleDepuisCode(code: string, officielle = ''): string {
  const o = (officielle || '').toUpperCase().trim();
  if (FAMILLES.includes(o)) return o;
  if (GROUPES_ACJ[o]) return GROUPES_ACJ[o];
  const c = (code || '').toUpperCase().trim();
  if (GROUPES_ACJ[c]) return GROUPES_ACJ[c];
  if (c.includes('LIAFF') || c.includes('TPC')) return 'TPC';
  if (c.startsWith('*PRO') || c.startsWith('*FIXE') || c.startsWith('*EXEC') || c.includes('TIPN')) return 'TIPN';
  if (c.startsWith('@A') || c.includes('CAB') || c.includes('FIBRE') || c.includes('INTERNET')) return 'CAB';
  if (c.includes('SIM') || c.includes('TMO') || c.includes('CELL')) return 'CELL';
  if (c.includes('WIFI') || c.includes('PAWML') || c.includes('PAWPL')) return 'WIFIPRO';
  if (c.includes('GRED') || c.includes('REDO')) return 'REDO';
  if (c.includes('BANA') || c.includes('NUM')) return 'NUM';
  return FAMILLES.includes(c) ? c : 'AUTRE';
}

/** Source : CD_SRC_COM (VL) ou No Source Ci (ACJ). 43=TMA, 45=GE, 41=RETA, 07=SACA.
 * Certains fichiers donnent le code (45), d'autres le texte (« GE ») : on mappe. */
export function sourceDepuisCode(code: string): string {
  const c = (code || '').trim();
  if (c === '7') return '07';
  const texte: Record<string, string> = { GE: '45', TMA: '43', RETA: '41', SACA: '07' };
  return texte[c.toUpperCase()] || c || '43';
}

/** Marque les lignes de total (sans client ni date, seulement un montant). */
export function estLigneTotal(noCli: string, dateCompl: string | null, montant: number | null): boolean {
  return (!noCli || !noCli.trim()) && !dateCompl && montant !== null && montant !== 0;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Date → 'yyyy-mm-dd'. Accepte : numéro de série Excel, Date, 'yyyy-mm-dd…', 'm/j/aaaa'.
 * Les exports de septembre mélangent texte m/j/aaaa et vraies dates (jour/mois parfois
 * inversés) : pour le MOIS on préfère les colonnes *_MOIS_VL / *_AN_VL (voir moisDepuis).
 */
export function dateIso(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${pad(Number(us[1]))}-${pad(Number(us[2]))}`;
  return null;
}

/** Normalise une ligne brute (objet colonne→valeur) vers le schéma commun. */
export function normaliserLigne(brute: Record<string, unknown>, feuille: FeuilleDetectee, ligneExcel: number, periode: string): PavaRow {
  const index = new Map<string, string>();
  for (const k of Object.keys(brute)) index.set(norm(k), k);
  const get = (...noms: string[]) => {
    for (const n of noms) {
      const cle = index.get(norm(n));
      if (cle !== undefined) return brute[cle];
    }
    return '';
  };
  const str = (v: unknown) => String(v ?? '').trim();
  const num = (v: unknown) => {
    if (v === null || v === undefined || String(v).trim() === '') return null;
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const acj = feuille.format === 'ACJ';
  const noCli = str(get('NO_CLI', 'No Client', 'NO_CLIENT', 'NUM_CLI'));
  const dateCompl = dateIso(get('DT_COMPL_COM', 'Date Completée', 'DT_COMPL', 'DATE_COMPL', 'COMPL_D'));
  const paiement = num(get('PAIEMENT_PAV', 'Paiement PAV', 'PAIEMENT', 'MT_PAV', 'MONTANT'));

  // Mois de complétion : colonnes officielles d'abord (fiables), sinon la date
  const an = num(get('DT_COMPL_AN_VL', 'DT_COMPL_AN', 'COMPL_AN', 'AN_VL'));
  const mois = num(get('DT_COMPL_MOIS_VL', 'DT_COMPL_MOIS', 'COMPL_MOIS', 'MOIS_VL'));
  const moisCompl = an && mois ? `${an}-${pad(mois)}` : dateCompl ? dateCompl.slice(0, 7) : null;

  const codeService = acj ? str(get('Groupe Service')) : str(get('DESC_ABR_SERV', 'ABR_SERV', 'CODE_SERVICE'));
  const famille = familleDepuisCode(codeService, acj ? str(get('Groupe Service')) : str(get('SOUS_FAMILLE_AFF', 'FAMILLE_AFF', 'FAMILLE', 'SOUS_FAMILLE')));
  const qty = num(get('QT_SERV_COM_COMPL', 'Quantite Services', 'QT_SERV_COM', 'QT_SERV', 'QUANTITE', 'QTE')) ?? 1;

  return {
    periode,
    feuille: feuille.nom,
    format: feuille.format,
    ligne_excel: ligneExcel,
    cle_com: str(get('CLE_COM', 'REF_COM')),
    no_cli: noCli,
    nom_client: str(get('NOM_CLIENT', 'NOM_CLI')),
    nature: feuille.nature,
    famille,
    code_service: codeService,
    puissance: str(get('PUISSANCE', 'PUISS')),
    nb_mois_eng: num(get('NB_MOIS_ENG', 'MOIS_ENG', 'NB_MOIS', 'DUREE_ENG')),
    qty: qty || 1,
    date_compl: dateCompl,
    mois_compl: moisCompl,
    src_code: sourceDepuisCode(str(get('CD_SRC_COM', 'No Source Ci', 'SRC_COM', 'CD_SRC'))),
    vendeur_no: str(get('NO_VENDEUR', 'No Employé', 'NUM_VENDEUR')),
    vendeur_nom: str(get('NOM_VENDEUR', 'VENDEUR_NOM')),
    tp_com_ci: str(get('TP_COM_CI', 'TP_COM')),
    raison: str(get('DESC_RSN_COM', 'Raison Du Débranchement', 'RSN_COM', 'DESC_RSN')),
    paiement_pav: paiement,
    ligne_total: estLigneTotal(noCli, dateCompl, paiement),
    ligne_id: '',
    no_serv: str(get('NO_SERV', 'NUM_SERV')),
    type_cmd: str(get('TYPE_COMMANDE_COR', 'Type Commande', 'TYPE_COMMANDE', 'COMMANDES', 'TYPE_CMD')),
    // ACJ : pas de forfait ni d'engagement → Internet et TPC en ajout ne sont pas contrôlables
    verifiable: !(acj && feuille.nature === 'AJOUT' && (famille === 'CAB' || famille === 'TPC')),
    ancienne: false,
  };
}

/** Métadonnées à conserver dans la ligne de l'application (la source `brut` ne quitte jamais le serveur). */
export function metaDepuisRow(r: PavaRow): LigneMeta {
  return {
    format: r.format, cle_com: r.cle_com, no_serv: r.no_serv, nb_mois_eng: r.nb_mois_eng,
    date_compl: r.date_compl, mois_compl: r.mois_compl, tp_com_ci: r.tp_com_ci, raison: r.raison,
    nom_client: r.nom_client, vendeur_no: r.vendeur_no, vendeur_nom: r.vendeur_nom, type_cmd: r.type_cmd,
  };
}

/** Ligne de l'application à partir d'une ligne normalisée (utilisé par la page Importation).
 * `brut` est OPTIONNEL : ne pas l'envoyer pour rester sous la limite de taille
 * des requêtes (4,5 Mo sur Vercel) — il n'est jamais renvoyé au navigateur.
 * La traçabilité reste assurée par feuille + ligne Excel + meta. */
export function ligneDepuisRow(r: PavaRow, id: string, montantCalcule: number | undefined, brut?: Record<string, unknown>): PavaLigne {
  const categorie = r.nature === 'RENO' ? 'RENOUVELLEMENT' : r.nature;
  return {
    id,
    mois: r.periode,
    compte: r.no_cli,
    produit: r.famille,
    famille: r.famille,
    type: '',
    desc: r.code_service,
    categorie,
    source: r.src_code,
    puissance: r.puissance,
    quantite: r.qty,
    montantOrigine: r.paiement_pav,
    montantCalcule,
    feuille: r.feuille,
    ligneExcel: r.ligne_excel,
    meta: metaDepuisRow(r),
    ...(brut ? { brut } : {}),
  };
}

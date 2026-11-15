/**
 * Moteur de règles R01–R13 (section 4 du prompt).
 * Chaque règle = une fonction pure (lignes, params, historique) → anomalies.
 * Niveaux : REGLE, PROBABLE, A_VALIDER, INFO.
 *
 * Identifiants STABLES : `R04|<feuille>|<ligne Excel>`. Ils ne dépendent plus d'un
 * compteur, donc une décision (ignorer, valider, corriger) reste attachée à la
 * bonne ligne après un nouvel import, une correction ou une suppression.
 */

import type { Anomaly, FixAction, PavaParams, PavaRow } from './types';
import { montantAttendu } from './price-plan';

function base(
  row: PavaRow, regle: string, raison: string, explication: string, solution: string,
  impact: number, confiance: Anomaly['confiance'], fix?: FixAction
): Anomaly {
  return {
    id: `${regle}|${row.feuille}|${row.ligne_excel}`,
    regle,
    feuille: row.feuille,
    ligne_excel: row.ligne_excel,
    cle_com: row.cle_com,
    no_cli: row.no_cli,
    nom_client: row.nom_client,
    raison,
    explication,
    solution,
    impact,
    confiance,
    statut: 'ouvert',
    commentaire: '',
    famille: row.famille,
    periode: row.periode,
    ligne_id: row.ligne_id,
    scope: 'ligne',
    groupe: `${regle}|${raison}`,
    fix,
  };
}

/** Alerte globale (R11, R12) : n'est rattachée à aucune ligne, donc jamais « corrigeable ». */
function globale(regle: string, periode: string, suffixe: string, raison: string, explication: string, solution: string, impact: number, confiance: Anomaly['confiance']): Anomaly {
  return {
    id: `${regle}|global|${periode}|${suffixe}`,
    regle, feuille: '—', ligne_excel: 0, cle_com: '', no_cli: '',
    raison, explication, solution, impact, confiance,
    statut: 'ouvert', commentaire: '', famille: '—', periode,
    ligne_id: '', scope: 'global', groupe: `${regle}|${raison}`,
  };
}

const SUPPRIMER: FixAction = { type: 'supprimer' };

/** R01 — TPC renouvellement unique : max 1 ligne TPC par no_cli et par période. */
export function r01(rows: PavaRow[], _params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  const parCompte = new Map<string, PavaRow[]>();
  for (const r of rows) {
    if (r.nature !== 'RENO' || r.famille !== 'TPC' || !r.no_cli || r.ligne_total) continue;
    const cle = `${r.periode}|${r.no_cli}`;
    const arr = parCompte.get(cle) || [];
    arr.push(r);
    parCompte.set(cle, arr);
  }
  for (const [, arr] of parCompte) {
    if (arr.length < 2) continue;
    for (const r of arr.slice(1)) {
      out.push(base(r, 'R01', 'TPC en double',
        `Compte ${r.no_cli} : ${arr.length} lignes TPC en renouvellement sur ${r.periode} (1re : ${arr[0].feuille} ligne ${arr[0].ligne_excel}). Max 1 ligne par compte.`,
        'Retirer la ligne en trop (avoir 65 $).', -65, 'REGLE', SUPPRIMER));
    }
  }
  return out;
}

/** R02 — TMO : toutes les lignes SIM sont valables. Ne jamais signaler de doublons SIM. */
export function r02(_rows: PavaRow[], _params: PavaParams): Anomaly[] {
  return []; // Volontairement vide : protège les SIM des autres règles de doublons.
}

/** R03 — Contrôle des renouvellements sur N mois (nécessite l'historique des mois précédents). */
export function r03(rows: PavaRow[], params: PavaParams, historique: PavaRow[] = []): Anomaly[] {
  const out: Anomaly[] = [];
  if (historique.length === 0) return out;
  // Distance en mois entre deux périodes « YYYY-MM » (absolue).
  const distanceMois = (a: string, b: string): number => {
    const ma = /(\d{4})-(\d{2})/.exec(a);
    const mb = /(\d{4})-(\d{2})/.exec(b);
    if (!ma || !mb) return Infinity; // période illisible : ne pas flagger
    return Math.abs((Number(ma[1]) - Number(mb[1])) * 12 + (Number(ma[2]) - Number(mb[2])));
  };
  const courantes = new Set(rows);
  const vus = new Map<string, PavaRow>();
  const cle = (r: PavaRow) => (r.famille === 'TPC' ? r.no_cli : `${r.no_cli}|${r.code_service}`);
  for (const r of [...historique, ...rows]) {
    if (r.nature !== 'RENO' || r.ligne_total || !r.no_cli) continue;
    const k = cle(r);
    const prev = vus.get(k);
    if (prev && prev.periode !== r.periode && courantes.has(r)) {
      const d = distanceMois(prev.periode, r.periode);
      // Seulement si le précédent renouvellement date de N mois ou moins ;
      // plus ancien = renouvellement légitime (pas de faux positif).
      if (d >= 1 && d <= params.n_mois) {
        out.push(base(r, 'R03', 'Déjà renouvelé',
          `Compte ${r.no_cli} déjà renouvelé en ${prev.periode} (${prev.feuille}, ligne ${prev.ligne_excel}, il y a ${d} mois ≤ ${params.n_mois}).`,
          'Vérifier si le renouvellement est légitime, sinon avoir 65 $.', -65, 'REGLE', SUPPRIMER));
      }
    } else if (!prev) {
      vus.set(k, r);
    }
  }
  return out;
}

/** R04 — Doublons exacts Internet dans le même mois (même commande ET même service). */
export function r04(rows: PavaRow[], _params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  const vus = new Map<string, PavaRow>();
  for (const r of rows) {
    if (r.famille !== 'CAB' || r.ligne_total || r.ancienne) continue;
    // Les lignes d'ajout sont unitaires par nature ; le format ACJ n'a pas de clé de commande
    if (r.nature === 'AJOUT' || !r.cle_com || !r.no_serv) continue;
    const cle = `${r.periode}|${r.cle_com}|${r.no_serv}|${r.code_service}|${r.src_code}`;
    const prev = vus.get(cle);
    if (prev) {
      out.push(base(r, 'R04', 'Doublon Internet',
        `Même commande ${r.cle_com}, même service ${r.no_serv} que ${prev.feuille} ligne ${prev.ligne_excel}.`,
        'Retirer la ligne en trop (avoir 65 $).', -(r.paiement_pav ?? 0), 'PROBABLE', SUPPRIMER));
    } else {
      vus.set(cle, r);
    }
  }
  return out;
}

/** La ligne a-t-elle une quantité > 1 payée moins que prix × quantité ? */
function quantiteSousPayee(r: PavaRow, params: PavaParams): number | null {
  if (r.ligne_total || (r.qty || 1) <= 1 || r.paiement_pav === null) return null;
  const attendu = montantAttendu(r, params);
  if (attendu === null || r.paiement_pav >= attendu) return null;
  return attendu;
}

/** R05 — Quantité × prix. */
export function r05(rows: PavaRow[], params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rows) {
    const attendu = quantiteSousPayee(r, params);
    if (attendu === null) continue;
    const ecart = attendu - (r.paiement_pav ?? 0);
    const conf = r.nature === 'AJOUT' ? 'PROBABLE' : 'A_VALIDER';
    out.push(base(r, 'R05', 'Quantité sous-facturée',
      `Quantité ${r.qty} payée ${r.paiement_pav} $ au lieu de ${attendu} $ (prix × quantité). Écart ${ecart} $.`,
      'Facturer à l’unité (complément).', ecart, conf, { type: 'montant', valeur: attendu }));
  }
  return out;
}

/** R06 — Écart de prix vs price plan (les lignes déjà signalées par R05 ne sont pas répétées). */
export function r06(rows: PavaRow[], params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rows) {
    if (r.ligne_total || r.paiement_pav === null || r.ancienne) continue;
    if (quantiteSousPayee(r, params) !== null) continue;
    const attendu = montantAttendu(r, params);
    if (attendu === null || r.paiement_pav === attendu) continue;
    const ecart = attendu - r.paiement_pav;
    out.push(base(r, 'R06', 'Écart de prix',
      `Payé ${r.paiement_pav} $ vs attendu ${attendu} $ selon le price plan. Écart ${ecart} $.`,
      'Corriger le montant ou mettre à jour la grille si le prix est légitime.', ecart, 'REGLE', { type: 'montant', valeur: attendu }));
  }
  return out;
}

/** R07 — Même service dans deux feuilles. */
export function r07(rows: PavaRow[], params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  const vus = new Map<string, PavaRow>();
  for (const r of rows) {
    if (r.ligne_total || !r.cle_com || !r.no_serv) continue;
    const cle = `${r.cle_com}|${r.no_serv}`;
    const prev = vus.get(cle);
    if (prev) {
      if (prev.feuille !== r.feuille) {
        out.push(base(r, 'R07', 'Même service deux fois',
          `Même commande ${r.cle_com} et même service ${r.no_serv} dans ${prev.feuille} (ligne ${prev.ligne_excel}) et ${r.feuille} (ligne ${r.ligne_excel}).`,
          'Vérifier s’il s’agit d’une double facturation (renouvellement + ajout), sinon avoir de 65 $.', -params.renouvellement, 'A_VALIDER'));
      }
    } else {
      vus.set(cle, r);
    }
  }
  return out;
}

/** R08 — Cohérence COM source 45. */
export function r08(rows: PavaRow[], _params: PavaParams, com: PavaRow[] = []): Anomaly[] {
  const out: Anomaly[] = [];
  if (com.length === 0) return out;
  const comSet = new Set(com.map((c) => `${c.no_cli}|${c.code_service}|${c.date_compl || ''}`));
  for (const r of rows) {
    if (r.src_code !== '45' || r.ligne_total) continue;
    const cle = `${r.no_cli}|${r.code_service}|${r.date_compl || ''}`;
    if (!comSet.has(cle)) {
      out.push(base(r, 'R08', 'Absent du COM', `Ligne source 45 facturée mais absente du fichier COM (${cle}).`,
        'Vérifier l’extraction COM ou retirer la ligne.', -(r.paiement_pav ?? 0), 'A_VALIDER', SUPPRIMER));
    }
  }
  return out;
}

/** R09 — Déménagements. */
export function r09(rows: PavaRow[], params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rows) {
    const tp = (r.tp_com_ci || '').toUpperCase();
    const raison = (r.raison || '').toUpperCase();
    if (tp === 'DMGSBR' || tp === 'DMGSAJ' || raison.includes('DEMENAGEMENT')) {
      const montant = r.paiement_pav ?? 0;
      const payable = params.demenagement_payable;
      out.push(base(r, 'R09', 'Déménagement',
        `Déménagement détecté (type ${r.tp_com_ci || '—'}, raison ${r.raison || '—'}). Payé ${montant} $. Déménagement payable : ${payable ? 'oui' : 'non'}.`,
        payable ? 'Vérifier le montant.' : 'Retirer si le déménagement n’est pas payable (à valider).',
        payable ? 0 : -montant, 'A_VALIDER', payable ? undefined : SUPPRIMER));
    }
  }
  return out;
}

/** R10 — Grille incomplète (uniquement les lignes contrôlables). */
export function r10(rows: PavaRow[], params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rows) {
    if (r.ligne_total || !r.verifiable) continue;
    if (montantAttendu(r, params) === null) {
      out.push(base(r, 'R10', 'Hors grille',
        `Forfait/engagement/puissance absent du price plan (famille ${r.famille}, code ${r.code_service || '—'}, puissance ${r.puissance || '—'}, engagement ${r.nb_mois_eng ?? '—'}).`,
        'Confirmer le prix et mettre à jour la grille.', 0, 'INFO'));
    }
  }
  return out;
}

/** R11 — Sources absentes (alerte globale, une seule par source). */
export function r11(rows: PavaRow[], _params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  if (rows.length === 0) return out;
  const sources = new Set(rows.map((r) => r.src_code));
  const periode = rows[0].periode;
  for (const s of ['45', '41']) {
    if (!sources.has(s)) {
      out.push(globale('R11', periode, s, `Source ${s} absente`,
        `Aucune ligne en source ${s} sur ${periode}. Risque d’omission si le mois suivant ou le COM en contient.`,
        `Demander l’extraction source ${s}.`, 0, 'A_VALIDER'));
    }
  }
  return out;
}

/** R12 — Rapprochement synthèse (alerte globale). */
export function r12(rows: PavaRow[], _params: PavaParams, synthese?: { quantite: number | null; montant: number | null }): Anomaly[] {
  if (!synthese || synthese.quantite == null || synthese.montant == null || rows.length === 0) return [];
  const qte = rows.reduce((s, r) => s + (r.qty || 1), 0);
  const montant = rows.reduce((s, r) => s + (r.paiement_pav ?? 0), 0);
  if (qte === synthese.quantite && montant === synthese.montant) return [];
  return [globale('R12', rows[0].periode, 'synthese', 'Écart synthèse',
    `Recalculé : ${qte} unités / ${montant} $ vs synthèse ${synthese.quantite} / ${synthese.montant} $. Écart ${montant - synthese.montant} $.`,
    'Vérifier les tableaux croisés FAC PAVA / SOMMAIRE.', montant - synthese.montant, 'REGLE')];
}

/** R13 — Qualité des données (information, jamais comptée comme « à traiter »). */
export function r13(rows: PavaRow[], _params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rows) {
    if (r.ligne_total || r.ancienne) continue;
    const problemes: string[] = [];
    if (!r.no_cli || !/^\d+$/.test(r.no_cli)) problemes.push('numéro client vide ou non numérique');
    if (!r.date_compl && !r.mois_compl) problemes.push('date de complétion absente');
    if (problemes.length) {
      out.push(base(r, 'R13', 'Qualité des données', problemes.join(' ; ') + '.', 'Corriger l’export source.', 0, 'INFO'));
    }
  }
  return out;
}

/** Lance toutes les règles. */
export function runAllRules(rows: PavaRow[], params: PavaParams, opts: { historique?: PavaRow[]; com?: PavaRow[]; synthese?: { quantite: number | null; montant: number | null } } = {}): Anomaly[] {
  const lignes = rows.filter((r) => !r.ligne_total);
  return [
    ...r01(lignes, params),
    ...r02(lignes, params),
    ...r03(lignes, params, opts.historique),
    ...r04(lignes, params),
    ...r05(lignes, params),
    ...r06(lignes, params),
    ...r07(lignes, params),
    ...r08(lignes, params, opts.com),
    ...r09(lignes, params),
    ...r10(lignes, params),
    ...r11(lignes, params),
    ...r12(lignes, params, opts.synthese),
    ...r13(lignes, params),
  ];
}

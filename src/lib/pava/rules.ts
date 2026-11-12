/**
 * Moteur de règles R01–R13 (section 4 du prompt).
 * Chaque règle = une fonction pure (lignes, params, historique) → anomalies.
 * Niveaux : REGLE, PROBABLE, A_VALIDER, INFO.
 */

import type { Anomaly, PavaParams, PavaRow } from './types';
import { montantAttendu } from './price-plan';

let compteur = 0;
function ref(regle: string) {
  compteur += 1;
  return `${regle}-${String(compteur).padStart(4, '0')}`;
}

function base(row: PavaRow, regle: string, raison: string, explication: string, solution: string, impact: number, confiance: Anomaly['confiance']): Anomaly {
  return {
    id: ref(regle),
    regle,
    feuille: row.feuille,
    ligne_excel: row.ligne_excel,
    cle_com: row.cle_com,
    no_cli: row.no_cli,
    raison,
    explication,
    solution,
    impact,
    confiance,
    statut: 'ouvert',
    commentaire: '',
    famille: row.famille,
    periode: row.periode,
  };
}

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
    if (arr.length > 1) {
      for (const r of arr.slice(1)) {
        out.push(base(r, 'R01', 'TPC en double', `Compte ${r.no_cli} : ${arr.length} lignes TPC en renouvellement sur ${r.periode}. Max 1 ligne par compte.`, 'Retirer la ligne en trop (avoir 65 $).', -65, 'REGLE'));
      }
    }
  }
  return out;
}

/** R02 — TMO : toutes les lignes SIM sont valables. Ne jamais signaler de doublons SIM. */
export function r02(_rows: PavaRow[], _params: PavaParams): Anomaly[] {
  return []; // Volontairement vide : protège les SIM des autres règles de doublons.
}

/** R03 — Contrôle des renouvellements sur N mois. */
export function r03(rows: PavaRow[], params: PavaParams, historique: PavaRow[] = []): Anomaly[] {
  const out: Anomaly[] = [];
  const tous = [...historique, ...rows];
  const vus = new Map<string, PavaRow>();
  for (const r of tous) {
    if (r.nature !== 'RENO' || r.ligne_total) continue;
    const cle = r.famille === 'TPC' ? `${r.no_cli}` : `${r.no_cli}|${r.code_service}`;
    if (!r.no_cli) continue;
    if (vus.has(cle)) {
      const prev = vus.get(cle)!;
      // Seulement si périodes différentes (déjà renouvelé dans les N mois)
      if (prev.periode !== r.periode) {
        out.push(base(r, 'R03', 'Déjà renouvelé', `Compte ${r.no_cli} déjà renouvelé en ${prev.periode} (feuille ${prev.feuille}, ligne ${prev.ligne_excel}). Contrôle sur ${params.n_mois} mois.`, 'Vérifier si renouvellement légitime, sinon avoir 65 $.', -65, 'REGLE'));
      }
    } else {
      vus.set(cle, r);
    }
  }
  return out;
}

/** R04 — Doublons exacts Internet dans le même mois. */
export function r04(rows: PavaRow[], _params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  const vus = new Map<string, PavaRow>();
  for (const r of rows) {
    if (r.famille !== 'CAB' || r.ligne_total || !r.no_cli) continue;
    // Ne pas appliquer aux lignes unitaires d'ajout répétées par nature (SIM, Wifi, etc.)
    if (r.nature === 'AJOUT') continue;
    const cle = `${r.periode}|${r.cle_com || r.no_cli}|${r.code_service}|${r.src_code}`;
    if (vus.has(cle)) {
      out.push(base(r, 'R04', 'Doublon Internet', `Doublon exact : ${cle} déjà vu en feuille ${vus.get(cle)!.feuille}, ligne ${vus.get(cle)!.ligne_excel}.`, 'Retirer la ligne en trop.', -65, 'PROBABLE'));
    } else {
      vus.set(cle, r);
    }
  }
  return out;
}

/** R05 — Quantité × prix. */
export function r05(rows: PavaRow[], params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rows) {
    if (r.ligne_total || (r.qty || 1) <= 1 || r.paiement_pav === null) continue;
    const attendu = montantAttendu(r, params);
    if (attendu === null) continue;
    if (r.paiement_pav < attendu) {
      const ecart = attendu - r.paiement_pav;
      const conf = r.nature === 'AJOUT' ? 'PROBABLE' : 'A_VALIDER';
      out.push(base(r, 'R05', 'Quantité sous-facturée', `Quantité ${r.qty} payée ${r.paiement_pav} $ au lieu de ${attendu} $ (prix × qty). Écart ${ecart} $.`, 'Facturer à l’unité (complément).', ecart, conf));
    }
  }
  return out;
}

/** R06 — Écart de prix vs price plan. */
export function r06(rows: PavaRow[], params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rows) {
    if (r.ligne_total || r.paiement_pav === null) continue;
    const attendu = montantAttendu(r, params);
    if (attendu === null) continue;
    if (r.paiement_pav !== attendu) {
      const ecart = attendu - r.paiement_pav;
      out.push(base(r, 'R06', 'Écart de prix', `Payé ${r.paiement_pav} $ vs attendu ${attendu} $ selon price plan. Écart ${ecart} $.`, 'Corriger le montant ou mettre à jour la grille si prix légitime.', ecart, 'REGLE'));
    }
  }
  return out;
}

/** R07 — Même service dans deux feuilles. */
export function r07(rows: PavaRow[], _params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  const vus = new Map<string, PavaRow>();
  for (const r of rows) {
    if (r.ligne_total || !r.cle_com) continue;
    const cle = `${r.cle_com}|${r.code_service}`;
    if (vus.has(cle)) {
      const prev = vus.get(cle)!;
      if (prev.feuille !== r.feuille) {
        out.push(base(r, 'R07', 'Même service deux fois', `Même service ${cle} dans ${prev.feuille} (ligne ${prev.ligne_excel}) et ${r.feuille} (ligne ${r.ligne_excel}).`, 'Vérifier si double facturation, sinon avoir 65 $.', -65, 'A_VALIDER'));
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
      out.push(base(r, 'R08', 'Absent du COM', `Ligne source 45 facturée mais absente du fichier COM (${cle}).`, 'Vérifier l’extraction COM ou retirer la ligne.', -65, 'A_VALIDER'));
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
      out.push(base(r, 'R09', 'Déménagement', `Déménagement détecté (TP ${r.tp_com_ci}, raison ${r.raison}). Montant payé ${montant} $. Déménagement payable : ${params.demenagement_payable ? 'oui' : 'non'}.`, params.demenagement_payable ? 'Vérifier le montant.' : 'Retirer si déménagement non payable.', params.demenagement_payable ? 0 : -montant, 'A_VALIDER'));
    }
  }
  return out;
}

/** R10 — Grille incomplète. */
export function r10(rows: PavaRow[], params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rows) {
    if (r.ligne_total) continue;
    const attendu = montantAttendu(r, params);
    if (attendu === null) {
      out.push(base(r, 'R10', 'Hors grille', `Forfait/engagement/puissance absent du price plan (famille ${r.famille}, code ${r.code_service}, puissance ${r.puissance}, engagement ${r.nb_mois_eng}).`, 'Confirmer le prix et mettre à jour la grille.', 0, 'INFO'));
    }
  }
  return out;
}

/** R11 — Sources absentes. */
export function r11(rows: PavaRow[], _params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  const sources = new Set(rows.map((r) => r.src_code));
  for (const s of ['45', '41']) {
    if (!sources.has(s)) {
      // Anomalie globale : on l'attache à la première ligne pour la traçabilité
      const premiere = rows.find((r) => !r.ligne_total);
      if (premiere) {
        out.push(base(premiere, 'R11', `Source ${s} absente`, `Aucune ligne en source ${s} sur ${premiere.periode}. Risque d’omission si le mois suivant ou le COM en contient.`, 'Demander l’extraction source ' + s + '.', 0, 'A_VALIDER'));
      }
    }
  }
  return out;
}

/** R12 — Rapprochement synthèse. */
export function r12(rows: PavaRow[], _params: PavaParams, synthese?: { quantite: number; montant: number }): Anomaly[] {
  const out: Anomaly[] = [];
  if (!synthese) return out;
  const lignesPayees = rows.filter((r) => !r.ligne_total);
  const qte = lignesPayees.reduce((s, r) => s + (r.qty || 1), 0);
  const montant = lignesPayees.reduce((s, r) => s + (r.paiement_pav ?? 0), 0);
  if (qte !== synthese.quantite || montant !== synthese.montant) {
    const premiere = lignesPayees[0];
    if (premiere) {
      out.push(base(premiere, 'R12', 'Écart synthèse', `Recalculé : ${qte} lignes / ${montant} $ vs synthèse ${synthese.quantite} / ${synthese.montant} $. Écart ${montant - synthese.montant} $.`, 'Vérifier les tableaux croisés FAC PAVA / SOMMAIRE.', montant - synthese.montant, 'REGLE'));
    }
  }
  return out;
}

/** R13 — Qualité des données. */
export function r13(rows: PavaRow[], _params: PavaParams): Anomaly[] {
  const out: Anomaly[] = [];
  for (const r of rows) {
    if (r.ligne_total) continue;
    const problemes: string[] = [];
    if (!r.no_cli || !/^\d+$/.test(r.no_cli.trim())) problemes.push('no_cli vide ou non numérique');
    if (!r.date_compl) problemes.push('date incomplète');
    if (r.nom_client !== r.nom_client.trim()) problemes.push('espaces parasites dans le nom');
    if (problemes.length) {
      out.push(base(r, 'R13', 'Qualité données', problemes.join(' ; ') + '.', 'Corriger l’export source.', 0, 'INFO'));
    }
  }
  return out;
}

/** Lance toutes les règles. */
export function runAllRules(rows: PavaRow[], params: PavaParams, opts: { historique?: PavaRow[]; com?: PavaRow[]; synthese?: { quantite: number; montant: number } } = {}): Anomaly[] {
  compteur = 0;
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

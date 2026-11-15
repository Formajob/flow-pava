import type { Anomaly } from './types';

/**
 * Regroupement des anomalies PAR LIGNE Excel.
 * L'utilisateur pense en lignes de facture, pas en règles : une ligne du
 * tableau = une ligne Excel avec tous ses problèmes, son impact cumulé
 * et une seule rangée d'actions.
 */

export interface GroupeLigne {
  cle: string;                // feuille|ligne_excel
  feuille: string;
  ligneExcel: number | undefined;
  compte: string;
  anomalies: Anomaly[];       // toutes les anomalies de cette ligne
  impact: number;             // impact cumulé
  confianceMax: Anomaly['confiance']; // la plus sévère
  aTraiter: boolean;          // ≥ 1 anomalie ouverte hors INFO
  toutesTraitees: boolean;    // aucune anomalie ouverte
  seulementInfo: boolean;     // que des anomalies INFO (qualité/grille)
}

const ORDRE_CONFIANCE: Record<string, number> = { REGLE: 0, PROBABLE: 1, A_VALIDER: 2, INFO: 3 };

export function grouperParLigne(anomalies: Anomaly[]): GroupeLigne[] {
  const m = new Map<string, GroupeLigne>();
  for (const a of anomalies) {
    const cle = `${a.feuille}|${a.ligne_excel}`;
    let g = m.get(cle);
    if (!g) {
      g = {
        cle, feuille: a.feuille, ligneExcel: a.ligne_excel, compte: a.no_cli || '',
        anomalies: [], impact: 0, confianceMax: 'INFO',
        aTraiter: false, toutesTraitees: true, seulementInfo: true,
      };
      m.set(cle, g);
    }
    g.anomalies.push(a);
    g.impact += a.impact || 0;
    if ((ORDRE_CONFIANCE[a.confiance] ?? 9) < (ORDRE_CONFIANCE[g.confianceMax] ?? 9)) g.confianceMax = a.confiance;
    if (a.statut === 'ouvert' && a.confiance !== 'INFO') g.aTraiter = true;
    if (a.statut === 'ouvert') g.toutesTraitees = false;
    if (a.confiance !== 'INFO') g.seulementInfo = false;
  }
  return [...m.values()].sort((a, b) => (ORDRE_CONFIANCE[a.confianceMax] ?? 9) - (ORDRE_CONFIANCE[b.confianceMax] ?? 9) || b.impact - a.impact);
}

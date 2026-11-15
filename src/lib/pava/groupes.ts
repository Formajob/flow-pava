/**
 * Regroupement des anomalies pour le triage (Contrôle).
 * Au lieu d'une liste de milliers de lignes, on traite quelques GROUPES
 * (règle + raison) : une décision ou une correction vaut pour tout le groupe
 * ou pour une sélection de lignes.
 */

import type { Anomaly, Confiance, FixAction } from './types';

export interface DecisionLite {
  statut: string;
  commentaire: string;
}

export interface Groupe {
  cle: string;
  regle: string;
  raison: string;
  confiance: Confiance;
  info: boolean;
  items: Anomaly[];
  nbOuvertes: number;
  impactOuvert: number;
  fixables: number;
}

const ORDRE: Record<Confiance, number> = { REGLE: 0, PROBABLE: 1, A_VALIDER: 2, INFO: 3 };

export function estTraitee(a: Anomaly, decisions: Record<string, DecisionLite>): boolean {
  const d = decisions[a.id];
  return !!d && d.statut !== 'ouvert';
}

/** Anomalies sur lesquelles l'utilisateur doit agir (ni info, ni alerte globale, ni déjà traitée). */
export function aTraiter(anomalies: Anomaly[], decisions: Record<string, DecisionLite>): Anomaly[] {
  return anomalies.filter((a) => a.scope === 'ligne' && a.confiance !== 'INFO' && !estTraitee(a, decisions));
}

/** Nombre de LIGNES distinctes concernées (une ligne signalée par 2 règles ne compte qu'une fois). */
export function lignesDistinctes(anomalies: Anomaly[]): number {
  return new Set(anomalies.map((a) => a.ligne_id || a.id)).size;
}

export function grouper(anomalies: Anomaly[], decisions: Record<string, DecisionLite>): Groupe[] {
  const map = new Map<string, Groupe>();
  for (const a of anomalies) {
    let g = map.get(a.groupe);
    if (!g) {
      g = { cle: a.groupe, regle: a.regle, raison: a.raison, confiance: a.confiance, info: a.confiance === 'INFO' || a.scope === 'global', items: [], nbOuvertes: 0, impactOuvert: 0, fixables: 0 };
      map.set(a.groupe, g);
    }
    g.items.push(a);
    if (!estTraitee(a, decisions)) {
      g.nbOuvertes += 1;
      g.impactOuvert += a.impact;
      if (a.fix) g.fixables += 1;
    }
  }
  return [...map.values()].sort(
    (x, y) => Number(x.info) - Number(y.info) || ORDRE[x.confiance] - ORDRE[y.confiance] || Math.abs(y.impactOuvert) - Math.abs(x.impactOuvert) || y.items.length - x.items.length
  );
}

export function libelleFix(fix?: FixAction): string {
  if (!fix) return '';
  return fix.type === 'supprimer' ? 'Retirer la ligne' : `Mettre le montant à ${fix.valeur} $`;
}

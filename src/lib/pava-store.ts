'use client';

/**
 * Store PAVA — même logique que la démo (flow-pava-demo/js/pava-store.js).
 * Lignes septembre + octobre, Price Plan, détection automatique des incohérences.
 * Clé localStorage : flow-pava-v1 (même que la démo).
 */

export type Role = 'analyste' | 'admin' | 'directeur';
export type Categorie = 'AJOUT' | 'RENOUVELLEMENT' | 'SACA' | 'NON_FACTUREE';

export interface PavaLigne {
  id: string;
  mois: string; // '2026-09' | '2026-10'
  compte: string;
  produit: string;
  famille: string;
  type: string;
  desc: string;
  categorie: Categorie;
  source: string;
  puissance?: string;
  quantite: number;
  montantOrigine: number | null;
  montantCalcule?: number;
  ajustement?: number;
  statut?: string;
  incoherence?: string;
  incomplet?: string;
  ref?: string;
  feuille?: string;
  ligneExcel?: number;
}

export interface PavaState {
  role: Role;
  mois: string;
  lignes: PavaLigne[];
  rules: Record<string, unknown>;
}

const KEY = 'flow-pava-v1';

export const DEFAULT_RULES = {
  internet: { '15': 150, '100': 200, '200': 250, '400': 300, '500': 300, 'Giga': 300 },
  tpc: { '36': 100, '60': 150, '12': 100, '24': 100, 'sans': 100 },
  tmo: 150, tv: 100, tipn: 100, renouvellement: 65, wifipro: 50, redo: 40,
  sources: { '43': true, '45': true, '41': true, '07': true },
  exceptions: { internet500: true, tpcSansEngagement: true, doublonsMoins3: true },
};

export const REF: Record<string, { ajout: { n: number; m: number }; renouvellement: { n: number; m: number }; saca: { n: number; m: number }; nonFacturee: { n: number; m: number }; total: { n: number; m: number } }> = {
  '2026-09': { ajout: { n: 634, m: 64800 }, renouvellement: { n: 2947, m: 191555 }, saca: { n: 3, m: 400 }, nonFacturee: { n: 3, m: 650 }, total: { n: 3587, m: 257405 } },
  '2026-10': { ajout: { n: 442, m: 46420 }, renouvellement: { n: 2866, m: 185705 }, saca: { n: 3, m: 170 }, nonFacturee: { n: 3, m: 440 }, total: { n: 3314, m: 232735 } },
};

function seedLines(): PavaLigne[] {
  const L: PavaLigne[] = [];
  const add = (o: Partial<PavaLigne> & { id: string; mois: string }) => {
    L.push({
      statut: 'COMPLETEE', categorie: 'AJOUT', source: '43', quantite: 1,
      ajustement: 0, montantOrigine: null, incoherence: '', compte: '', produit: '', famille: '', type: '', desc: '',
      ...o,
    } as PavaLigne);
  };
  // Septembre 2026 — AJOUT (échantillon réel, NO_CLI sans noms)
  add({ mois: '2026-09', id: '2026-09-0001', ligneExcel: 8, compte: '75133569', produit: 'REDO', famille: 'INT', type: 'FORFAIT', desc: 'Gestion redondance sans fil', categorie: 'AJOUT', montantOrigine: 40 });
  add({ mois: '2026-09', id: '2026-09-0002', compte: '75133569', produit: 'WIFIPRO', famille: 'INT', type: 'EQUIPEMENT', desc: 'Point accès Wi-Fi mural loué', categorie: 'AJOUT', montantOrigine: 50 });
  add({ mois: '2026-09', id: '2026-09-0003', compte: '76329075', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '15', desc: 'Internet Fibre hybride 15/15', categorie: 'AJOUT', montantOrigine: 150 });
  add({ mois: '2026-09', id: '2026-09-0011', compte: '78349966', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '500', desc: 'Internet Fibre hybride 500/50', categorie: 'AJOUT', montantOrigine: 300 });
  add({ mois: '2026-09', id: '2026-09-0013', compte: '78352048', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: 'Giga', desc: 'Internet Fibre Hybride Giga', categorie: 'AJOUT', montantOrigine: 300 });
  add({ mois: '2026-09', id: '2026-09-0015', compte: '78348988', produit: 'CELL', famille: 'TSF', type: 'EQUIPEMENT', desc: 'Carte SIM', categorie: 'AJOUT', montantOrigine: 150 });
  add({ mois: '2026-09', id: '2026-09-0101', compte: '61557064', produit: 'TPC', famille: 'TEL', type: 'FORFAIT', desc: 'Renouvellement TPC', categorie: 'RENOUVELLEMENT', source: '45', montantOrigine: 65 });
  add({ mois: '2026-09', id: '2026-09-0201', compte: '70000001', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '200', desc: 'Vente SAC Affaire (SACA 07)', categorie: 'SACA', source: '07', montantOrigine: 133 });
  // Octobre 2026 — AJOUT
  add({ mois: '2026-10', id: '2026-10-0001', ligneExcel: 12, compte: '72410442', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '500', desc: 'Internet Fibre hybride 500/50', categorie: 'AJOUT', montantOrigine: 300 });
  add({ mois: '2026-10', id: '2026-10-0002', compte: '75172804', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: 'Giga', desc: 'Internet Fibre Hybride Giga', categorie: 'AJOUT', montantOrigine: 300 });
  add({ mois: '2026-10', id: '2026-10-0006', compte: '77178527', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '200', desc: 'Internet Fibre hybride 200/50', categorie: 'AJOUT', montantOrigine: 250 });
  add({ mois: '2026-10', id: '2026-10-0101', ligneExcel: 150, compte: '72410442', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '500', desc: 'Renouvellement Internet 500/50', categorie: 'RENOUVELLEMENT', source: '45', montantOrigine: 65 });
  add({ mois: '2026-10', id: '2026-10-0201', compte: '70000011', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '200', desc: 'Vente SAC Affaire (SACA 07)', categorie: 'SACA', source: '07', montantOrigine: 85 });
  // Incohérences (même analyse que Claude, avec Réf + feuille/ligne Excel)
  add({ mois: '2026-10', id: '2026-10-0401', ref: 'O-1', feuille: 'Renouvellement 2', compte: '77698615', produit: 'TPC', famille: 'TEL', type: 'FORFAIT', desc: 'TPC en double', categorie: 'RENOUVELLEMENT', source: '43', montantOrigine: 65, incoherence: 'O-1 · TPC en double — 1 ligne par compte (impact 130 $)' });
  add({ mois: '2026-10', id: '2026-10-0403', ref: 'O-2', feuille: 'Renouvellement 1+2', compte: '73287776', produit: 'TPC', famille: 'TEL', type: 'FORFAIT', desc: 'Déjà renouvelé en septembre', categorie: 'RENOUVELLEMENT', source: '43', montantOrigine: 65, incoherence: 'O-2 · Déjà renouvelé en sept. — contrôle -3 mois' });
  add({ mois: '2026-10', id: '2026-10-0407', ref: 'O-4', feuille: 'AJOUT 2', compte: '70000022', produit: 'WIFIPRO', famille: 'INT', type: 'EQUIPEMENT', desc: 'Wifi-Pro quantité 6 payée 1 fois', categorie: 'AJOUT', source: '43', quantite: 6, montantOrigine: 50, incoherence: 'O-4 · Quantité >1 payée 1 fois — facturer à l’unité (+640 $)' });
  add({ mois: '2026-10', id: '2026-10-0412', ref: 'O-10', feuille: 'AJOUT 1', compte: '70000025', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '50', desc: 'Forfait 50/50 absent du Price Plan', categorie: 'AJOUT', source: '43', montantOrigine: 200, incoherence: 'O-10 · 50/50 absent du Price Plan — confirmer le prix' });
  add({ mois: '2026-09', id: '2026-09-0401', ref: 'S-1', feuille: 'RENOUVELLEMENT', compte: '57566348', produit: 'TPC', famille: 'TEL', type: 'FORFAIT', desc: 'TPC en double', categorie: 'RENOUVELLEMENT', source: '43', montantOrigine: 65, incoherence: 'S-1 · TPC en double (avoir 390 $)' });
  return L;
}

function defaultState(): PavaState {
  return { role: 'admin', mois: '2026-10', lignes: seedLines(), rules: DEFAULT_RULES };
}

let memory: PavaState | null = null;
const listeners = new Set<() => void>();

function load(): PavaState {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PavaState;
      memory = parsed;
      return memory;
    }
  } catch { /* ignore */ }
  memory = defaultState();
  return memory;
}

function save(s: PavaState) {
  memory = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}

export function getPavaState(): PavaState {
  if (typeof window === 'undefined') return defaultState();
  return load();
}

export function subscribePava(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function setPavaRole(role: Role) {
  const s = { ...load(), role };
  save(s);
}

export function setPavaMois(mois: string) {
  const s = { ...load(), mois };
  save(s);
}

/** Détection automatique des incohérences (même logique que la démo). */
export function incoherences(lignes: PavaLigne[], mois: string) {
  const out: PavaLigne[] = [];
  const duMois = lignes.filter((l) => l.mois === mois);
  // TPC en double : 1 ligne par compte
  const tpcParCompte = new Map<string, PavaLigne[]>();
  for (const l of duMois) {
    if (l.produit === 'TPC' && l.categorie === 'RENOUVELLEMENT' && l.compte) {
      const arr = tpcParCompte.get(l.compte) || [];
      arr.push(l);
      tpcParCompte.set(l.compte, arr);
    }
  }
  for (const [, arr] of tpcParCompte) {
    if (arr.length > 1) {
      for (const l of arr.slice(1)) {
        out.push({ ...l, ref: l.ref || 'O-1', incoherence: l.incoherence || 'O-1 · TPC en double — 1 ligne par compte' });
      }
    }
  }
  // Doublons identiques (compte + produit + desc + source)
  const vus = new Map<string, PavaLigne>();
  for (const l of duMois) {
    const cle = [l.compte, l.produit, l.desc, l.source].join('|');
    if (vus.has(cle) && l.compte) {
      out.push({ ...l, ref: l.ref || 'O-3', incoherence: l.incoherence || 'O-3 · Doublon identique' });
    } else {
      vus.set(cle, l);
    }
  }
  // Quantité > 1 payée 1 fois
  for (const l of duMois) {
    if (l.quantite > 1) {
      out.push({ ...l, ref: l.ref || 'O-4', incoherence: l.incoherence || 'O-4 · Quantité >1 payée 1 fois' });
    }
  }
  // Incomplets déjà marqués
  for (const l of duMois) {
    if (l.incomplet && !out.some((o) => o.id === l.id)) out.push(l);
  }
  return out;
}

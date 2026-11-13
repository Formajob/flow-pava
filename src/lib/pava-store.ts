'use client';

/**
 * Store PAVA — deux modes :
 *
 * 1. MODE BASE DE DONNÉES (par défaut quand NEXT_PUBLIC_SUPABASE_URL est défini) :
 *    toutes les données vivent dans Supabase (base « flow », tables pava_*).
 *    Le store appelle les routes API /api/pava/* et garde un cache en mémoire
 *    pour l'affichage. Les préférences (rôle, mois, commande active) restent
 *    locales au navigateur.
 *
 * 2. MODE DÉMO (sans variable d'environnement) : localStorage, comme avant.
 *
 * L'API publique (fonctions exportées) est identique dans les deux modes :
 * les pages n'ont pas à savoir lequel est actif.
 */

import type { PavaParams } from './pava/types';
import { DEFAULT_PARAMS } from './pava/types';

export type Role = 'analyste' | 'admin' | 'directeur';
export type Categorie = 'AJOUT' | 'RENOUVELLEMENT' | 'SACA' | 'NON_FACTUREE';

export interface PavaLigne {
  id: string;
  mois: string;
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
  /** Ligne source brute du fichier Excel — conservée en DB pour traçabilité. */
  brut?: Record<string, unknown>;
}

export interface ImportedFile {
  id: string;
  nom: string;
  date: string;
  feuilles: string[];
  nbLignes: number;
  mois: string;
}

export interface Decision {
  statut: 'ouvert' | 'valide' | 'rejete' | 'ignore' | 'corrige';
  commentaire: string;
}

export interface HistoriqueEntree {
  date: string;
  action: string;
}

export interface Commande {
  id: string;
  nom: string;
  mois?: string;
  dateCreation: string;
  statut: 'en_cours' | 'valide_admin' | 'validee';
  lignes: PavaLigne[];
  fichiers: ImportedFile[];
  decisions: Record<string, Decision>;
  historique: HistoriqueEntree[];
  etape: string;
}

export interface PavaState {
  role: Role;
  mois: string;
  lignes: PavaLigne[];
  rules: Record<string, unknown>;
  fichiers: ImportedFile[];
  params: PavaParams;
  decisions: Record<string, Decision>;
  statutFacture: Record<string, string>;
  commandes: Commande[];
  activeCommandeId: string;
  nomCommande: string;
  /** Vrai pendant le premier chargement depuis la base. */
  enChargement?: boolean;
  /** Dernière erreur de synchronisation avec la base (mode DB). */
  erreur?: string;
}

const KEY = 'flow-pava-v1';
const PREFS_KEY = 'flow-pava-prefs-v1';

/** Mode base de données actif uniquement si une vraie URL Supabase est fournie
 *  (un placeholder comme « URL_DU_PROJET » garde le mode démo + bandeau). */
const DB_MODE = /^https?:\/\//.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
/** Vrai = données enregistrées dans Supabase ; faux = mode démo localStorage. */
export const EST_MODE_DB = DB_MODE;

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

/* ================================================================
 * ÉTAT PARTAGÉ + SOUSCRIPTION
 * ================================================================ */

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribePava(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/* ================================================================
 * MODE DÉMO (localStorage) — inchangé par rapport à la version validée
 * ================================================================ */

function seedLines(): PavaLigne[] {
  const L: PavaLigne[] = [];
  const add = (o: Partial<PavaLigne> & { id: string; mois: string }) => {
    L.push({
      statut: 'COMPLETEE', categorie: 'AJOUT', source: '43', quantite: 1,
      ajustement: 0, montantOrigine: null, incoherence: '', compte: '', produit: '', famille: '', type: '', desc: '',
      ...o,
    } as PavaLigne);
  };
  add({ mois: '2026-09', id: '2026-09-0001', ligneExcel: 8, compte: '75133569', produit: 'REDO', famille: 'INT', type: 'FORFAIT', desc: 'Gestion redondance sans fil', categorie: 'AJOUT', montantOrigine: 40 });
  add({ mois: '2026-09', id: '2026-09-0002', compte: '75133569', produit: 'WIFIPRO', famille: 'INT', type: 'EQUIPEMENT', desc: 'Point accès Wi-Fi mural loué', categorie: 'AJOUT', montantOrigine: 50 });
  add({ mois: '2026-09', id: '2026-09-0003', compte: '76329075', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '15', desc: 'Internet Fibre hybride 15/15', categorie: 'AJOUT', montantOrigine: 150 });
  add({ mois: '2026-09', id: '2026-09-0011', compte: '78349966', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '500', desc: 'Internet Fibre hybride 500/50', categorie: 'AJOUT', montantOrigine: 300 });
  add({ mois: '2026-09', id: '2026-09-0013', compte: '78352048', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: 'Giga', desc: 'Internet Fibre Hybride Giga', categorie: 'AJOUT', montantOrigine: 300 });
  add({ mois: '2026-09', id: '2026-09-0015', compte: '78348988', produit: 'CELL', famille: 'TSF', type: 'EQUIPEMENT', desc: 'Carte SIM', categorie: 'AJOUT', montantOrigine: 150 });
  add({ mois: '2026-09', id: '2026-09-0101', compte: '61557064', produit: 'TPC', famille: 'TEL', type: 'FORFAIT', desc: 'Renouvellement TPC', categorie: 'RENOUVELLEMENT', source: '45', montantOrigine: 65 });
  add({ mois: '2026-09', id: '2026-09-0201', compte: '70000001', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '200', desc: 'Vente SAC Affaire (SACA 07)', categorie: 'SACA', source: '07', montantOrigine: 133 });
  add({ mois: '2026-10', id: '2026-10-0001', ligneExcel: 12, compte: '72410442', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '500', desc: 'Internet Fibre hybride 500/50', categorie: 'AJOUT', montantOrigine: 300 });
  add({ mois: '2026-10', id: '2026-10-0002', compte: '75172804', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: 'Giga', desc: 'Internet Fibre Hybride Giga', categorie: 'AJOUT', montantOrigine: 300 });
  add({ mois: '2026-10', id: '2026-10-0006', compte: '77178527', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '200', desc: 'Internet Fibre hybride 200/50', categorie: 'AJOUT', montantOrigine: 250 });
  add({ mois: '2026-10', id: '2026-10-0101', ligneExcel: 150, compte: '72410442', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '500', desc: 'Renouvellement Internet 500/50', categorie: 'RENOUVELLEMENT', source: '45', montantOrigine: 65 });
  add({ mois: '2026-10', id: '2026-10-0201', compte: '70000011', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '200', desc: 'Vente SAC Affaire (SACA 07)', categorie: 'SACA', source: '07', montantOrigine: 85 });
  add({ mois: '2026-10', id: '2026-10-0401', ref: 'O-1', feuille: 'Renouvellement 2', compte: '77698615', produit: 'TPC', famille: 'TEL', type: 'FORFAIT', desc: 'TPC en double', categorie: 'RENOUVELLEMENT', source: '43', montantOrigine: 65, incoherence: 'O-1 · TPC en double — 1 ligne par compte (impact 130 $)' });
  add({ mois: '2026-10', id: '2026-10-0403', ref: 'O-2', feuille: 'Renouvellement 1+2', compte: '73287776', produit: 'TPC', famille: 'TEL', type: 'FORFAIT', desc: 'Déjà renouvelé en septembre', categorie: 'RENOUVELLEMENT', source: '43', montantOrigine: 65, incoherence: 'O-2 · Déjà renouvelé en sept. — contrôle -3 mois' });
  add({ mois: '2026-10', id: '2026-10-0407', ref: 'O-4', feuille: 'AJOUT 2', compte: '70000022', produit: 'WIFIPRO', famille: 'INT', type: 'EQUIPEMENT', desc: 'Wifi-Pro quantité 6 payée 1 fois', categorie: 'AJOUT', source: '43', quantite: 6, montantOrigine: 50, incoherence: 'O-4 · Quantité >1 payée 1 fois — facturer à l’unité (+640 $)' });
  add({ mois: '2026-10', id: '2026-10-0412', ref: 'O-10', feuille: 'AJOUT 1', compte: '70000025', produit: 'CAB', famille: 'INT', type: 'FORFAIT', puissance: '50', desc: 'Forfait 50/50 absent du Price Plan', categorie: 'AJOUT', source: '43', montantOrigine: 200, incoherence: 'O-10 · 50/50 absent du Price Plan — confirmer le prix' });
  add({ mois: '2026-09', id: '2026-09-0401', ref: 'S-1', feuille: 'RENOUVELLEMENT', compte: '57566348', produit: 'TPC', famille: 'TEL', type: 'FORFAIT', desc: 'TPC en double', categorie: 'RENOUVELLEMENT', source: '43', montantOrigine: 65, incoherence: 'S-1 · TPC en double (avoir 390 $)' });
  return L;
}

function defaultState(): PavaState {
  const lignes = seedLines();
  const sept = lignes.filter((l) => l.mois === '2026-09');
  const oct = lignes.filter((l) => l.mois === '2026-10');
  const commandes: Commande[] = [
    {
      id: 'cmd-sept-2026', nom: 'Facture Septembre 2026', mois: '2026-09',
      dateCreation: new Date().toISOString(), statut: 'validee',
      lignes: sept, fichiers: [], decisions: {},
      historique: [{ date: new Date().toISOString(), action: 'Commande créée (démo)' }],
      etape: 'factures',
    },
    {
      id: 'cmd-oct-2026', nom: 'Facture Octobre 2026', mois: '2026-10',
      dateCreation: new Date().toISOString(), statut: 'en_cours',
      lignes: oct, fichiers: [], decisions: {},
      historique: [{ date: new Date().toISOString(), action: 'Commande créée (démo)' }],
      etape: 'analyse',
    },
  ];
  return {
    role: 'admin', mois: '2026-10', lignes: oct, rules: DEFAULT_RULES,
    fichiers: [], params: DEFAULT_PARAMS, decisions: {},
    statutFacture: { '2026-09': 'validee', '2026-10': 'en_cours' },
    commandes, activeCommandeId: 'cmd-oct-2026', nomCommande: 'Facture Octobre 2026',
  };
}

let memory: PavaState | null = null;

function load(): PavaState {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PavaState>;
      const def = defaultState();
      memory = {
        ...def,
        ...parsed,
        fichiers: parsed.fichiers || [],
        params: parsed.params || DEFAULT_PARAMS,
        decisions: parsed.decisions || {},
        statutFacture: parsed.statutFacture || { '2026-09': 'validee', '2026-10': 'en_cours' },
        commandes: parsed.commandes || def.commandes,
        activeCommandeId: parsed.activeCommandeId || def.activeCommandeId,
        nomCommande: parsed.nomCommande || def.nomCommande,
      };
      return memory;
    }
  } catch { /* ignore */ }
  memory = defaultState();
  return memory;
}

function save(s: PavaState) {
  memory = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  emit();
}

function syncActive(s: PavaState): PavaState {
  const commandes = s.commandes.map((c) =>
    c.id === s.activeCommandeId
      ? { ...c, lignes: s.lignes, fichiers: s.fichiers, decisions: s.decisions, nom: s.nomCommande }
      : c
  );
  return { ...s, commandes };
}

/* ================================================================
 * MODE BASE DE DONNÉES (Supabase via routes API)
 * ================================================================ */

interface Prefs { role: Role; mois: string; activeCommandeId?: string }

function lirePrefs(): Prefs {
  if (typeof window === 'undefined') return { role: 'admin', mois: '' };
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') as Prefs | null;
    return { role: p?.role || 'admin', mois: p?.mois || '', activeCommandeId: p?.activeCommandeId };
  } catch {
    return { role: 'admin', mois: '' };
  }
}

function ecrirePrefs(p: Prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

let dbState: PavaState | null = null;
let dbErreur = '';

function etatVide(enChargement = false): PavaState {
  return {
    role: 'admin', mois: '', lignes: [], rules: DEFAULT_RULES,
    fichiers: [], params: DEFAULT_PARAMS, decisions: {}, statutFacture: {},
    commandes: [], activeCommandeId: '', nomCommande: '',
    enChargement, erreur: dbErreur || undefined,
  };
}

function etatDb(): PavaState {
  return dbState || etatVide(true);
}

function assembler(commandes: Commande[], params: PavaParams): PavaState {
  const p = lirePrefs();
  const active = commandes.find((c) => c.id === p.activeCommandeId) || commandes[commandes.length - 1] || null;
  const statutFacture: Record<string, string> = {};
  for (const c of commandes) if (c.mois) statutFacture[c.mois] = c.statut;
  return {
    role: p.role,
    mois: active?.mois || p.mois || '',
    lignes: active?.lignes || [],
    rules: DEFAULT_RULES,
    fichiers: active?.fichiers || [],
    params,
    decisions: active?.decisions || {},
    statutFacture,
    commandes,
    activeCommandeId: active?.id || '',
    nomCommande: active?.nom || '',
    erreur: dbErreur || undefined,
  };
}

async function api<T>(chemin: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/pava${chemin}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const texte = await res.text();
  const data = texte ? (JSON.parse(texte) as Record<string, unknown>) : {};
  if (!res.ok) throw new Error((data.error as string) || `Erreur ${res.status}`);
  return data as T;
}

function noterErreur(e: unknown) {
  dbErreur = e instanceof Error ? e.message : String(e);
  if (dbState) dbState = { ...dbState, erreur: dbErreur };
  emit();
}

function effacerErreur() {
  if (dbErreur) {
    dbErreur = '';
    if (dbState) dbState = { ...dbState, erreur: undefined };
  }
}

async function chargerEtat(): Promise<void> {
  try {
    const r = await api<{ commandes: Commande[]; params: PavaParams }>('/state');
    effacerErreur();
    dbState = assembler(r.commandes, r.params);
  } catch (e) {
    dbState = etatVide();
    noterErreur(e);
    return;
  }
  emit();
}

/** Activer le chargement initial dès l'import du module (navigateur uniquement). */
if (DB_MODE && typeof window !== 'undefined') {
  void chargerEtat();
}

async function dbCreateCommande(nom: string, mois?: string): Promise<boolean> {
  const p = lirePrefs();
  const m = mois || p.mois || new Date().toISOString().slice(0, 7);
  try {
    const c = await api<Commande>('/commandes', { method: 'POST', body: JSON.stringify({ nom, mois: m }) });
    ecrirePrefs({ ...p, mois: m, activeCommandeId: c.id });
    effacerErreur();
    dbState = assembler([...etatDb().commandes, c], etatDb().params);
    emit();
    return true;
  } catch (e) {
    noterErreur(e);
    return false;
  }
}

function dbSetActiveCommande(id: string) {
  const s = etatDb();
  const cible = s.commandes.find((c) => c.id === id);
  if (!cible) return;
  ecrirePrefs({ ...lirePrefs(), activeCommandeId: id, mois: cible.mois || lirePrefs().mois });
  dbState = assembler(s.commandes, s.params);
  emit();
}

async function dbDeleteCommande(id: string): Promise<boolean> {
  const s = etatDb();
  const cible = s.commandes.find((c) => c.id === id);
  if (!cible) return false;
  if (cible.statut === 'validee') return false; // validée par directeur : interdit
  try {
    await api(`/commandes/${id}`, { method: 'DELETE' });
  } catch (e) {
    noterErreur(e);
    return false;
  }
  const restantes = s.commandes.filter((c) => c.id !== id);
  const nextActive = s.activeCommandeId === id ? restantes[restantes.length - 1] : restantes.find((c) => c.id === s.activeCommandeId);
  ecrirePrefs({ ...lirePrefs(), activeCommandeId: nextActive?.id });
  effacerErreur();
  dbState = assembler(restantes, s.params);
  emit();
  return true;
}

async function dbAddImportedFile(fichier: ImportedFile, nouvelles: PavaLigne[]): Promise<boolean> {
  const s = etatDb();
  const idCmd = s.activeCommandeId;
  if (!idCmd) {
    noterErreur(new Error('Aucune commande active — créez une commande avant d’importer.'));
    return false;
  }
  try {
    const r = await api<{ fichier: ImportedFile; lignes: PavaLigne[] }>(`/commandes/${idCmd}/fichiers`, {
      method: 'POST',
      body: JSON.stringify({ fichier, lignes: nouvelles }),
    });
    const commandes = s.commandes.map((c) =>
      c.id === idCmd
        ? { ...c, fichiers: [r.fichier, ...c.fichiers], lignes: [...c.lignes, ...r.lignes] }
        : c
    );
    effacerErreur();
    dbState = assembler(commandes, s.params);
    emit();
    return true;
  } catch (e) {
    noterErreur(e);
    return false;
  }
}

async function dbUpdateLigne(id: string, patch: Partial<PavaLigne>): Promise<boolean> {
  const s = etatDb();
  try {
    const maj = await api<PavaLigne>(`/lignes/${id}`, { method: 'PATCH', body: JSON.stringify({ patch }) });
    const commandes = s.commandes.map((c) => ({
      ...c,
      lignes: c.lignes.map((l) => (l.id === id ? { ...l, ...maj } : l)),
    }));
    effacerErreur();
    dbState = assembler(commandes, s.params);
    emit();
    return true;
  } catch (e) {
    noterErreur(e);
    return false;
  }
}

async function dbDeleteLigne(id: string): Promise<boolean> {
  const s = etatDb();
  try {
    await api(`/lignes/${id}`, { method: 'DELETE' });
    const commandes = s.commandes.map((c) => ({ ...c, lignes: c.lignes.filter((l) => l.id !== id) }));
    effacerErreur();
    dbState = assembler(commandes, s.params);
    emit();
    return true;
  } catch (e) {
    noterErreur(e);
    return false;
  }
}

async function dbSetParams(params: PavaParams): Promise<boolean> {
  const s = etatDb();
  try {
    await api('/params', { method: 'PUT', body: JSON.stringify({ params }) });
    effacerErreur();
    dbState = assembler(s.commandes, params);
    emit();
    return true;
  } catch (e) {
    noterErreur(e);
    return false;
  }
}

async function dbSetDecision(anomalyId: string, decision: Decision): Promise<boolean> {
  const s = etatDb();
  const idCmd = s.activeCommandeId;
  if (!idCmd) return false;
  try {
    await api(`/commandes/${idCmd}/decisions`, {
      method: 'PUT',
      body: JSON.stringify({ ref: anomalyId, statut: decision.statut, commentaire: decision.commentaire }),
    });
    const commandes = s.commandes.map((c) =>
      c.id === idCmd ? { ...c, decisions: { ...c.decisions, [anomalyId]: decision } } : c
    );
    effacerErreur();
    dbState = assembler(commandes, s.params);
    emit();
    return true;
  } catch (e) {
    noterErreur(e);
    return false;
  }
}

async function dbSetStatutFacture(mois: string, statut: string): Promise<boolean> {
  const s = etatDb();
  const idCmd = s.activeCommandeId;
  if (!idCmd) return false;
  try {
    const c = await api<Commande>(`/commandes/${idCmd}`, {
      method: 'PATCH',
      body: JSON.stringify({ statut, mois }),
    });
    const commandes = s.commandes.map((x) => (x.id === idCmd ? c : x));
    effacerErreur();
    dbState = assembler(commandes, s.params);
    emit();
    return true;
  } catch (e) {
    noterErreur(e);
    return false;
  }
}

async function dbAddHistorique(action: string): Promise<boolean> {
  const s = etatDb();
  const idCmd = s.activeCommandeId;
  if (!idCmd) return false;
  try {
    const h = await api<HistoriqueEntree>(`/commandes/${idCmd}/historique`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    const commandes = s.commandes.map((c) => (c.id === idCmd ? { ...c, historique: [...c.historique, h] } : c));
    effacerErreur();
    dbState = assembler(commandes, s.params);
    emit();
    return true;
  } catch (e) {
    noterErreur(e);
    return false;
  }
}

async function dbSetEtape(etape: string): Promise<boolean> {
  const s = etatDb();
  const idCmd = s.activeCommandeId;
  if (!idCmd) return false;
  try {
    await api(`/commandes/${idCmd}`, { method: 'PATCH', body: JSON.stringify({ etape }) });
    const commandes = s.commandes.map((c) => (c.id === idCmd ? { ...c, etape } : c));
    effacerErreur();
    dbState = assembler(commandes, s.params);
    emit();
    return true;
  } catch (e) {
    noterErreur(e);
    return false;
  }
}

async function dbAddVersion(etape: string, nomFichier: string, nbLignes?: number, totalCalcule?: number): Promise<void> {
  const s = etatDb();
  const idCmd = s.activeCommandeId;
  if (!idCmd) return;
  try {
    const v = await api<{ numero: number }>(`/commandes/${idCmd}/versions`, {
      method: 'POST',
      body: JSON.stringify({ etape, nomFichier, nbLignes, totalCalcule }),
    });
    const commandes = s.commandes.map((c) =>
      c.id === idCmd
        ? { ...c, historique: [...c.historique, { date: new Date().toISOString(), action: `Version ${v.numero} générée (${etape}) : ${nomFichier}` }] }
        : c
    );
    effacerErreur();
    dbState = assembler(commandes, s.params);
    emit();
  } catch (e) {
    noterErreur(e);
  }
}

/* ================================================================
 * API PUBLIQUE — identique dans les deux modes
 * ================================================================ */

export function getPavaState(): PavaState {
  if (DB_MODE) return etatDb();
  if (typeof window === 'undefined') return defaultState();
  return load();
}

export function setPavaRole(role: Role) {
  if (DB_MODE) {
    ecrirePrefs({ ...lirePrefs(), role });
    dbState = assembler(etatDb().commandes, etatDb().params);
    emit();
    return;
  }
  save({ ...load(), role });
}

export function setPavaMois(mois: string) {
  if (DB_MODE) {
    ecrirePrefs({ ...lirePrefs(), mois });
    dbState = assembler(etatDb().commandes, etatDb().params);
    emit();
    return;
  }
  save({ ...load(), mois });
}

export function addImportedFile(fichier: ImportedFile, nouvelles: PavaLigne[]): Promise<boolean> | boolean {
  if (DB_MODE) return dbAddImportedFile(fichier, nouvelles);
  const s = load();
  save({
    ...s,
    fichiers: [fichier, ...s.fichiers],
    lignes: [...s.lignes, ...nouvelles],
  });
  return true;
}

export function updateLigne(id: string, patch: Partial<PavaLigne>): Promise<boolean> | boolean {
  if (DB_MODE) return dbUpdateLigne(id, patch);
  const s = load();
  save({ ...s, lignes: s.lignes.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  return true;
}

export function deleteLigne(id: string): Promise<boolean> | boolean {
  if (DB_MODE) return dbDeleteLigne(id);
  const s = load();
  save({ ...s, lignes: s.lignes.filter((l) => l.id !== id) });
  return true;
}

export function setParams(params: PavaParams): Promise<boolean> | boolean {
  if (DB_MODE) return dbSetParams(params);
  save({ ...load(), params });
  return true;
}

export function setDecision(anomalyId: string, decision: Decision): Promise<boolean> | boolean {
  if (DB_MODE) return dbSetDecision(anomalyId, decision);
  const s = load();
  save({ ...s, decisions: { ...s.decisions, [anomalyId]: decision } });
  return true;
}

export function setStatutFacture(mois: string, statut: string): Promise<boolean> | boolean {
  if (DB_MODE) return dbSetStatutFacture(mois, statut);
  const s = load();
  const commandes = s.commandes.map((c) =>
    c.id === s.activeCommandeId ? { ...c, statut: statut as Commande['statut'], historique: [...c.historique, { date: new Date().toISOString(), action: `Statut → ${statut}` }] } : c
  );
  save({ ...s, statutFacture: { ...s.statutFacture, [mois]: statut }, commandes });
  return true;
}

export function createCommande(nom: string, mois?: string): Promise<boolean> | boolean {
  if (!nom.trim()) return false;
  if (DB_MODE) return dbCreateCommande(nom, mois);
  const s = syncActive(load());
  const id = `cmd-${Date.now()}`;
  const nouvelle: Commande = {
    id, nom: nom.trim(), mois: mois || s.mois,
    dateCreation: new Date().toISOString(), statut: 'en_cours',
    lignes: [], fichiers: [], decisions: {},
    historique: [{ date: new Date().toISOString(), action: `Commande créée : ${nom.trim()}` }],
    etape: 'importation',
  };
  save({
    ...s,
    commandes: [...s.commandes, nouvelle],
    activeCommandeId: id,
    nomCommande: nom.trim(),
    lignes: [], fichiers: [], decisions: {},
    mois: mois || s.mois,
  });
  return true;
}

export function setActiveCommande(id: string) {
  if (DB_MODE) {
    dbSetActiveCommande(id);
    return;
  }
  const s = syncActive(load());
  const cible = s.commandes.find((c) => c.id === id);
  if (!cible) return;
  save({
    ...s,
    activeCommandeId: id,
    nomCommande: cible.nom,
    lignes: cible.lignes,
    fichiers: cible.fichiers,
    decisions: cible.decisions,
    mois: cible.mois || s.mois,
  });
}

export function deleteCommande(id: string): Promise<boolean> | boolean {
  if (DB_MODE) return dbDeleteCommande(id);
  const s = load();
  const cible = s.commandes.find((c) => c.id === id);
  if (!cible) return false;
  if (cible.statut === 'validee') return false; // validée par directeur : suppression interdite sans accès
  const restantes = s.commandes.filter((c) => c.id !== id);
  const nextActive = s.activeCommandeId === id ? restantes[restantes.length - 1] : restantes.find((c) => c.id === s.activeCommandeId);
  save({
    ...s,
    commandes: restantes,
    activeCommandeId: nextActive?.id || '',
    nomCommande: nextActive?.nom || '',
    lignes: nextActive?.lignes || [],
    fichiers: nextActive?.fichiers || [],
    decisions: nextActive?.decisions || {},
  });
  return true;
}

export function addHistorique(action: string): Promise<boolean> | boolean {
  if (DB_MODE) return dbAddHistorique(action);
  const s = load();
  const commandes = s.commandes.map((c) =>
    c.id === s.activeCommandeId ? { ...c, historique: [...c.historique, { date: new Date().toISOString(), action }] } : c
  );
  save({ ...s, commandes });
  return true;
}

/** Faire avancer l'étape de la commande active (importation → analyse → …). */
export function setEtapeCommande(etape: string): Promise<boolean> | boolean {
  if (DB_MODE) return dbSetEtape(etape);
  const s = load();
  const commandes = s.commandes.map((c) => (c.id === s.activeCommandeId ? { ...c, etape } : c));
  save({ ...s, commandes });
  return true;
}

/** Tracer une version du fichier Excel générée (une par étape). */
export function addVersion(etape: string, nomFichier: string, nbLignes?: number, totalCalcule?: number): Promise<void> | void {
  if (DB_MODE) return dbAddVersion(etape, nomFichier, nbLignes, totalCalcule);
  const s = load();
  const commandes = s.commandes.map((c) =>
    c.id === s.activeCommandeId
      ? { ...c, historique: [...c.historique, { date: new Date().toISOString(), action: `Version générée (${etape}) : ${nomFichier}` }] }
      : c
  );
  save({ ...s, commandes });
}

/** Effacer les données démo du navigateur (mode démo uniquement). */
export function reinitialiserDemo() {
  if (DB_MODE) return;
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(PREFS_KEY);
  } catch { /* ignore */ }
  memory = null;
  save(defaultState());
}

/** Recharger l'état depuis la base (bouton « Rafraîchir »). */
export function refreshPava(): Promise<void> | void {
  if (DB_MODE) return chargerEtat();
}

/** Détection automatique des incohérences (même logique que la démo). */
export function incoherences(lignes: PavaLigne[], mois: string) {
  const out: PavaLigne[] = [];
  const duMois = lignes.filter((l) => l.mois === mois);
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
  const vus = new Map<string, PavaLigne>();
  for (const l of duMois) {
    const cle = [l.compte, l.produit, l.desc, l.source].join('|');
    if (vus.has(cle) && l.compte) {
      out.push({ ...l, ref: l.ref || 'O-3', incoherence: l.incoherence || 'O-3 · Doublon identique' });
    } else {
      vus.set(cle, l);
    }
  }
  for (const l of duMois) {
    if (l.quantite > 1) {
      out.push({ ...l, ref: l.ref || 'O-4', incoherence: l.incoherence || 'O-4 · Quantité >1 payée 1 fois' });
    }
  }
  for (const l of duMois) {
    if (l.incomplet && !out.some((o) => o.id === l.id)) out.push(l);
  }
  return out;
}

'use client';

/**
 * Analyse PAVA — moteur de détection R01–R13.
 * Principe : les fichiers importés en Réception sont recalculés (montant attendu),
 * puis les incohérences sont extraites et affichées pour action manuelle.
 * Chaque anomalie : Réf, Raison, Explication, Solution, Impact $, Confiance, Statut.
 * Calculs déterministes (moteur), jamais par LLM.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import CarteChargement from '@/components/pava/CarteChargement';
import { getPavaState, subscribePava, setDecision, setDecisionsBulk, updateLigne, deleteLigne, setActiveCommande, addHistorique, addVersion, setEtapeCommande } from '@/lib/pava-store';
import { runEngine, depuisDemo } from '@/lib/pava/engine';
import type { Anomaly, StatutAnomalie } from '@/lib/pava/types';

const KEY_DECISIONS = 'flow-pava-decisions-v1';

function loadDecisions(): Record<string, StatutAnomalie> {
  try {
    return JSON.parse(localStorage.getItem(KEY_DECISIONS) || '{}');
  } catch {
    return {};
  }
}

export default function AnalysePage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [decisions, setDecisions] = useState<Record<string, StatutAnomalie>>(() => {
    if (typeof window === 'undefined') return {};
    return loadDecisions();
  });
  const [filtreRegle, setFiltreRegle] = useState('');
  const [filtreConfiance, setFiltreConfiance] = useState('');
  const [filtreFamille, setFiltreFamille] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [correction, setCorrection] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [bulkEnCours, setBulkEnCours] = useState(false);

  const lignesNorm = useMemo(
    () => depuisDemo(snap.lignes as unknown as Array<Record<string, unknown>>, snap.mois),
    [snap.lignes, snap.mois]
  );
  const resultat = useMemo(() => runEngine(lignesNorm, snap.params), [lignesNorm, snap.params]);

  const anomalies: Anomaly[] = useMemo(
    () =>
      resultat.anomalies.map((a) => ({
        ...a,
        statut: decisions[a.id] || a.statut,
      })),
    [resultat.anomalies, decisions]
  );

  const filtrees = useMemo(() => {
    const regles = [...new Set(anomalies.map((a) => a.regle))].sort();
    const confiances = [...new Set(anomalies.map((a) => a.confiance))].sort();
    const familles = [...new Set(anomalies.map((a) => a.famille))].sort();
    return { regles, confiances, familles };
  }, [anomalies]);

  const affichees = anomalies.filter(
    (a) =>
      (!filtreRegle || a.regle === filtreRegle) &&
      (!filtreConfiance || a.confiance === filtreConfiance) &&
      (!filtreFamille || a.famille === filtreFamille) &&
      (!filtreStatut || a.statut === filtreStatut)
  );

  // Pagination : le tableau n'affiche que 50 lignes à la fois — jamais
  // des milliers de rangées d'un coup (page figée sinon).
  const PAR_PAGE = 50;
  useEffect(() => setPage(1), [filtreRegle, filtreConfiance, filtreFamille, filtreStatut]);
  const nbPages = Math.max(1, Math.ceil(affichees.length / PAR_PAGE));
  const pageActive = Math.min(page, nbPages);
  const pageAffichee = affichees.slice((pageActive - 1) * PAR_PAGE, pageActive * PAR_PAGE);

  /** Valider / rejeter en masse toutes les anomalies du filtre courant. */
  const traiterEnMasse = async (statut: Exclude<StatutAnomalie, 'ouvert'>) => {
    const refs = affichees.map((a) => a.id);
    if (refs.length === 0) return;
    const verbe = statut === 'valide' ? 'valider' : 'rejeter';
    if (!confirm(`${verbe.charAt(0).toUpperCase() + verbe.slice(1)} les ${refs.length} anomalie(s) affichée(s) par le filtre ?`)) return;
    setBulkEnCours(true);
    await setDecisionsBulk(refs, statut);
    setBulkEnCours(false);
  };

  const setStatut = (id: string, statut: StatutAnomalie) => {
    const next = { ...decisions, [id]: statut };
    setDecisions(next);
    setDecision(id, { statut, commentaire: '' });
  };

  const ouvrirCorrection = (a: Anomaly) => {
    const ligne = snap.lignes.find((l) => l.feuille === a.feuille && l.ligneExcel === a.ligne_excel);
    if (!ligne) {
      alert('Ligne source introuvable.');
      return;
    }
    setCorrection(ligne.id);
    setForm({
      compte: ligne.compte, produit: ligne.produit, desc: ligne.desc,
      categorie: ligne.categorie, source: ligne.source,
      quantite: String(ligne.quantite), montantOrigine: String(ligne.montantOrigine ?? ''),
      puissance: ligne.puissance || '',
    });
  };

  const enregistrerCorrection = () => {
    if (!correction) return;
    updateLigne(correction, {
      compte: form.compte, produit: form.produit, desc: form.desc,
      categorie: form.categorie as never, source: form.source,
      quantite: Number(form.quantite) || 1,
      montantOrigine: form.montantOrigine === '' ? null : Number(form.montantOrigine),
      puissance: form.puissance,
    });
    setCorrection(null);
  };

  const supprimerLigne = () => {
    if (!correction) return;
    if (!confirm('Supprimer cette ligne de la facture ?')) return;
    deleteLigne(correction);
    setCorrection(null);
  };

  const exporter = async () => {
    setExportEnCours(true);
    try {
      await exporterCorps();
    } finally {
      setExportEnCours(false);
    }
  };

  const exporterCorps = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    // Onglet Synthèse
    const synthese = [
      ['Période', snap.mois],
      ['Total facturé', resultat.totalFacture],
      ['Total recalculé', resultat.totalRecalcule],
      ['Impact net', resultat.impactNet],
      ['Anomalies', anomalies.length],
      ...Object.entries(resultat.parRegle).map(([r, n]) => [`${r}`, n]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(synthese), 'Synthèse');
    // Onglet Anomalies
    const rows = anomalies.map((a) => ({
      Réf: a.id, Règle: a.regle, Feuille: a.feuille, 'Ligne Excel': a.ligne_excel,
      CLE_COM: a.cle_com, NO_CLI: a.no_cli, Raison: a.raison, Explication: a.explication,
      Solution: a.solution, 'Impact $': a.impact, Confiance: a.confiance, Statut: a.statut, Commentaire: a.commentaire,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Anomalies');
    // Onglet Lignes recalculées
    const lignes = resultat.lignes.map((l) => ({
      Période: l.periode, Feuille: l.feuille, 'Ligne Excel': l.ligne_excel, NO_CLI: l.no_cli,
      Nature: l.nature, Famille: l.famille, Code: l.code_service, Qty: l.qty,
      Payé: l.paiement_pav, Attendu: l.montant_attendu, Écart: l.ecart,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lignes), 'Lignes recalculées');
    const nomFichier = (snap.nomCommande || `rapport-pava-${snap.mois}`).replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `${nomFichier}.xlsx`);
    // Version tracée dans la base — nommée d'après la commande
    void addVersion('analyse', `${nomFichier}.xlsx`, resultat.lignes.length, resultat.totalRecalcule);
  };

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Analyse</h1>
          <p className="g-lead">
            Commande « {snap.nomCommande} » · Première version recalculée, puis incohérences extraites.
            {resultat.lignes.length} lignes recalculées.
          </p>
        </div>
        <div className="g-tools">
          <select className="g-chip" aria-label="Commande" value={snap.activeCommandeId} onChange={(e) => setActiveCommande(e.target.value)}>
            {snap.commandes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
          <button type="button" className="g-btn" disabled={exportEnCours} onClick={() => { void addHistorique('Analyse lancée'); void setEtapeCommande('analyse'); void exporter(); }}>
            {exportEnCours ? 'Génération du fichier…' : "Lancer l'analyse + Exporter xlsx"}
          </button>
          <Link className="g-btn g-btn--ghost" href="/admin/importation">Importer</Link>
        </div>
      </header>

      {snap.enChargement ? (
        <CarteChargement
          titre="Analyse en cours — chargement des lignes…"
          texte="Les lignes de la commande sont récupérées depuis la base, puis recalculées par le moteur (montants attendus, règles R01–R13)."
        />
      ) : (
      <>
      <section className="g-kpis" aria-label="Synthèse">
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num">{resultat.totalFacture.toLocaleString('fr-FR')} $</b>
          <span className="g-label">Total facturé</span>
        </article>
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num">{resultat.totalRecalcule.toLocaleString('fr-FR')} $</b>
          <span className="g-label">Total recalculé</span>
        </article>
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num" style={{ color: resultat.impactNet < 0 ? 'var(--g-bad)' : 'var(--g-ok)' }}>
            {resultat.impactNet.toLocaleString('fr-FR')} $
          </b>
          <span className="g-label">Impact net (négatif = surfacturé)</span>
        </article>
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num">{anomalies.length}</b>
          <span className="g-label">Anomalies</span>
        </article>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Types de produits · Conforme / Incohérence</h3>
            <p className="g-card-sub">Nombre de lignes par type de produit, séparé en conformes et incohérentes.</p>
          </div>
        </div>
        <div className="g-table-wrap">
          <table className="g-table">
            <thead><tr><th>Type de produit</th><th>Conforme / Valide</th><th>Incohérence</th><th>Total</th></tr></thead>
            <tbody>
              {(() => {
                const parType = new Map<string, { ok: number; ko: number }>();
                const incoIds = new Set(anomalies.map((a) => `${a.feuille}|${a.ligne_excel}`));
                for (const l of resultat.lignes) {
                  const cle = l.famille || '—';
                  const e = parType.get(cle) || { ok: 0, ko: 0 };
                  if (incoIds.has(`${l.feuille}|${l.ligne_excel}`)) e.ko += 1;
                  else e.ok += 1;
                  parType.set(cle, e);
                }
                return [...parType.entries()].map(([t, v]) => (
                  <tr key={t}><td><b>{t}</b></td><td>{v.ok}</td><td>{v.ko}</td><td>{v.ok + v.ko}</td></tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Anomalies par règle</h3>
            <p className="g-card-sub">R01 TPC unique · R03 N mois · R04 doublons · R05 quantité · R06 prix · R07 deux feuilles · R08 COM · R09 déménagements · R10 hors grille · R11 sources · R12 synthèse · R13 qualité.</p>
          </div>
        </div>
        <div className="g-bars">
          {Object.entries(resultat.parRegle).map(([r, n]) => (
            <div key={r} className="g-bar">
              <span className="g-bar-label">{r}</span>
              <span className="g-track"><span className="g-fill" style={{ width: `${Math.min(100, n * 10)}%` }} /></span>
              <span className="g-bar-val"><b className="g-num">{n}</b></span>
            </div>
          ))}
        </div>
        <div className="g-card-foot">
          {Object.entries(resultat.parConfiance).map(([c, n]) => (
            <span key={c}>{c} : <b className="g-num">{n}</b></span>
          ))}
        </div>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Liste des anomalies · {affichees.length}</h3>
            <p className="g-card-sub">Validez ou rejetez chaque anomalie. Les décisions sont conservées pour le mois suivant.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <select className="g-chip" value={filtreRegle} onChange={(e) => setFiltreRegle(e.target.value)} aria-label="Règle">
            <option value="">Toutes règles</option>
            {filtrees.regles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="g-chip" value={filtreConfiance} onChange={(e) => setFiltreConfiance(e.target.value)} aria-label="Confiance">
            <option value="">Toutes confiances</option>
            {filtrees.confiances.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="g-chip" value={filtreFamille} onChange={(e) => setFiltreFamille(e.target.value)} aria-label="Famille">
            <option value="">Toutes familles</option>
            {filtrees.familles.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className="g-chip" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} aria-label="Statut">
            <option value="">Tous statuts</option>
            <option value="ouvert">ouvert</option>
            <option value="valide">validé</option>
            <option value="rejete">rejeté</option>
          </select>
        </div>
        {affichees.length === 0 ? (
          <p className="g-empty">Aucune anomalie avec ces filtres.</p>
        ) : (
          <>
          <div className="g-pager">
            <b>
              {affichees.length.toLocaleString('fr-FR')} anomalie(s) · page {pageActive} / {nbPages} · 50 par page
            </b>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="g-btn g-btn--sm" disabled={bulkEnCours} onClick={() => void traiterEnMasse('valide')}>
                {bulkEnCours ? 'Traitement…' : `Valider les ${affichees.length.toLocaleString('fr-FR')} filtrées`}
              </button>
              <button type="button" className="g-btn g-btn--ghost g-btn--sm" disabled={bulkEnCours} onClick={() => void traiterEnMasse('rejete')}>
                Rejeter les filtrées
              </button>
              <button type="button" className="g-btn g-btn--ghost g-btn--sm" disabled={pageActive <= 1} onClick={() => setPage(pageActive - 1)}>
                ‹ Précédent
              </button>
              <button type="button" className="g-btn g-btn--ghost g-btn--sm" disabled={pageActive >= nbPages} onClick={() => setPage(pageActive + 1)}>
                Suivant ›
              </button>
            </div>
          </div>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>Réf</th>
                  <th>Raison</th>
                  <th>Explication</th>
                  <th>Solution</th>
                  <th style={{ textAlign: 'right' }}>Impact $</th>
                  <th>Confiance</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageAffichee.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="g-ref">{a.id}</span>
                      <div style={{ fontSize: 11, color: 'var(--g-muted)' }}>{a.feuille} · ligne {a.ligne_excel}{a.no_cli ? ` · ${a.no_cli}` : ''}</div>
                    </td>
                    <td><b>{a.raison}</b></td>
                    <td>{a.explication}</td>
                    <td>{a.solution}</td>
                    <td style={{ textAlign: 'right' }}><b className="g-num" style={{ color: a.impact < 0 ? 'var(--g-bad)' : a.impact > 0 ? 'var(--g-ok)' : undefined }}>{a.impact} $</b></td>
                    <td><span className={`g-badge ${a.confiance === 'REGLE' ? 'is-ok' : a.confiance === 'PROBABLE' ? 'is-info' : a.confiance === 'A_VALIDER' ? 'is-warn' : 'is-muted'}`}><i className="g-dot" />{a.confiance}</span></td>
                    <td><span className={`g-badge ${a.statut === 'valide' ? 'is-ok' : a.statut === 'rejete' ? 'is-bad' : 'is-warn'}`}><i className="g-dot" />{a.statut}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
                        <button type="button" className="g-btn g-btn--sm" style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Valider" aria-label="Valider" onClick={() => setStatut(a.id, 'valide')}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        </button>
                        <button type="button" className="g-btn g-btn--ghost g-btn--sm" style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Rejeter" aria-label="Rejeter" onClick={() => setStatut(a.id, 'rejete')}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                        <button type="button" className="g-btn g-btn--ghost g-btn--sm" style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Corriger" aria-label="Corriger" onClick={() => ouvrirCorrection(a)}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
        <div className="g-card-foot">
          <span>{affichees.length} affichées sur {anomalies.length}</span>
          <span>Export xlsx : Synthèse, Anomalies, Lignes recalculées</span>
        </div>
        {correction && (
          <div className="g-card" style={{ padding: 16, marginTop: 12, background: 'rgba(255,255,255,.6)' }}>
            <h4 style={{ margin: '0 0 12px' }}>Corriger la ligne</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
              <label>Compte<input className="g-input" value={form.compte || ''} onChange={(e) => setForm({ ...form, compte: e.target.value })} /></label>
              <label>Produit<input className="g-input" value={form.produit || ''} onChange={(e) => setForm({ ...form, produit: e.target.value })} /></label>
              <label>Description<input className="g-input" value={form.desc || ''} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></label>
              <label>Catégorie
                <select className="g-input" value={form.categorie || ''} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
                  <option>AJOUT</option><option>RENOUVELLEMENT</option><option>SACA</option><option>NON_FACTUREE</option>
                </select>
              </label>
              <label>Source<input className="g-input" value={form.source || ''} onChange={(e) => setForm({ ...form, source: e.target.value })} /></label>
              <label>Quantité<input className="g-input" type="number" value={form.quantite || ''} onChange={(e) => setForm({ ...form, quantite: e.target.value })} /></label>
              <label>Montant<input className="g-input" type="number" value={form.montantOrigine || ''} onChange={(e) => setForm({ ...form, montantOrigine: e.target.value })} /></label>
              <label>Puissance<input className="g-input" value={form.puissance || ''} onChange={(e) => setForm({ ...form, puissance: e.target.value })} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="g-btn g-btn--sm" onClick={enregistrerCorrection}>Enregistrer</button>
              <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={supprimerLigne}>Supprimer</button>
              <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => setCorrection(null)}>Annuler</button>
            </div>
          </div>
        )}
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">1ère version de la facture · données conformes</h3>
            <p className="g-card-sub">Montants recalculés selon le price plan. Les incohérences ci-dessus restent à traiter en Contrôle.</p>
          </div>
        </div>
        <div className="g-table-wrap">
          <table className="g-table">
            <thead>
              <tr>
                <th>Réf Excel</th>
                <th>Compte</th>
                <th>Produit</th>
                <th>Catégorie</th>
                <th style={{ textAlign: 'right' }}>Payé</th>
                <th style={{ textAlign: 'right' }}>Attendu</th>
                <th style={{ textAlign: 'right' }}>Écart</th>
              </tr>
            </thead>
            <tbody>
              {resultat.lignes.slice(0, 30).map((l, i) => (
                <tr key={i}>
                  <td>{l.feuille} · ligne {l.ligne_excel}</td>
                  <td>{l.no_cli || '—'}</td>
                  <td><b>{l.famille}</b> · {l.code_service}</td>
                  <td>{l.nature}</td>
                  <td style={{ textAlign: 'right' }}>{l.paiement_pav ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{l.montant_attendu ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{l.ecart ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="g-card-foot">
          <span>{resultat.lignes.length} lignes recalculées</span>
          <span>Total recalculé : {resultat.totalRecalcule.toLocaleString('fr-FR')} $</span>
        </div>
      </section>
      </>
      )}
    </>
  );
}

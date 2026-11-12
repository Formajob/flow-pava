'use client';

/**
 * Analyse PAVA — moteur de détection R01–R13.
 * Principe : les fichiers importés en Réception sont recalculés (montant attendu),
 * puis les incohérences sont extraites et affichées pour action manuelle.
 * Chaque anomalie : Réf, Raison, Explication, Solution, Impact $, Confiance, Statut.
 * Calculs déterministes (moteur), jamais par LLM.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getPavaState, subscribePava, setDecision } from '@/lib/pava-store';
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

  const setStatut = (id: string, statut: StatutAnomalie) => {
    const next = { ...decisions, [id]: statut };
    setDecisions(next);
    setDecision(id, { statut, commentaire: '' });
  };

  const exporter = async () => {
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
    XLSX.writeFile(wb, `rapport-pava-${snap.mois}.xlsx`);
  };

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Analyse</h1>
          <p className="g-lead">
            Première version de la facture recalculée, puis incohérences extraites pour action manuelle.
            Mois {snap.mois} · {resultat.lignes.length} lignes recalculées.
          </p>
        </div>
        <div className="g-tools">
          <button type="button" className="g-btn" onClick={exporter}>
            Exporter xlsx
          </button>
          <Link className="g-btn g-btn--ghost" href="/admin/reception">Importer en Réception</Link>
        </div>
      </header>

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
                {affichees.map((a) => (
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
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="g-btn g-btn--sm" onClick={() => setStatut(a.id, 'valide')}>Valider</button>
                        <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => setStatut(a.id, 'rejete')}>Rejeter</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="g-card-foot">
          <span>{affichees.length} affichées sur {anomalies.length}</span>
          <span>Export xlsx : Synthèse, Anomalies, Lignes recalculées</span>
        </div>
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
  );
}

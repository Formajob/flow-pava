'use client';

/**
 * Analyse PAVA — vue d'ensemble du recalcul et des incohérences (moteur R01–R13).
 * Le traitement détaillé (corriger / ignorer) se fait en Contrôle, par groupes.
 * Ici : totaux, répartition par règle et par famille, export Excel complet.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import CarteChargement from '@/components/pava/CarteChargement';
import { getPavaState, subscribePava, setActiveCommande, addHistorique, addVersion, setEtapeCommande } from '@/lib/pava-store';
import { runEngine, depuisDemo, historiqueVersRows } from '@/lib/pava/engine';
import { aTraiter, estTraitee, grouper, lignesDistinctes } from '@/lib/pava/groupes';

export default function AnalysePage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [exportEnCours, setExportEnCours] = useState(false);

  const lignesNorm = useMemo(
    () => depuisDemo(snap.lignes as unknown as Array<Record<string, unknown>>, snap.mois),
    [snap.lignes, snap.mois]
  );
  // Historique des autres commandes (endpoint /renouvellements) → règle R03.
  const refsMoteur = useMemo(
    () => ({ historique: historiqueVersRows(snap.renouvellements) }),
    [snap.renouvellements]
  );
  const resultat = useMemo(() => runEngine(lignesNorm, snap.params, refsMoteur), [lignesNorm, snap.params, refsMoteur]);
  const ouvertes = useMemo(() => aTraiter(resultat.anomalies, snap.decisions), [resultat.anomalies, snap.decisions]);
  const groupes = useMemo(() => grouper(resultat.anomalies, snap.decisions), [resultat.anomalies, snap.decisions]);
  const impactOuvert = ouvertes.reduce((s, a) => s + a.impact, 0);

  const parFamille = useMemo(() => {
    const ko = new Map<string, Set<string>>();
    for (const a of ouvertes) {
      const s = ko.get(a.famille) || new Set<string>();
      s.add(a.ligne_id);
      ko.set(a.famille, s);
    }
    const total = new Map<string, number>();
    for (const l of resultat.lignes) total.set(l.famille, (total.get(l.famille) || 0) + 1);
    return [...total.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => ({ f, n, ko: ko.get(f)?.size || 0 }));
  }, [resultat.lignes, ouvertes]);

  const exporter = async () => {
    setExportEnCours(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Période', snap.mois],
        ['Total facturé', resultat.totalFacture],
        ['Total recalculé', resultat.totalRecalcule],
        ['Impact net (anomalies)', resultat.impactNet],
        ['Lignes à traiter', lignesDistinctes(ouvertes)],
        ['Anomalies', resultat.anomalies.length],
        ...Object.entries(resultat.parRegle).map(([r, n]) => [r, n]),
      ]), 'Synthèse');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resultat.anomalies.map((a) => ({
        Réf: a.id, Règle: a.regle, Feuille: a.feuille, 'Ligne Excel': a.ligne_excel, CLE_COM: a.cle_com, NO_CLI: a.no_cli,
        Client: a.nom_client || '', Raison: a.raison, Explication: a.explication, Solution: a.solution, 'Impact $': a.impact,
        Confiance: a.confiance, Statut: snap.decisions[a.id]?.statut || 'ouvert', Commentaire: snap.decisions[a.id]?.commentaire || '',
      }))), 'Anomalies');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resultat.lignes.map((l) => ({
        Période: l.periode, Feuille: l.feuille, 'Ligne Excel': l.ligne_excel, NO_CLI: l.no_cli, Nature: l.nature,
        Famille: l.famille, Code: l.code_service, Qty: l.qty, Payé: l.paiement_pav, Attendu: l.montant_attendu, Écart: l.ecart,
      }))), 'Lignes recalculées');
      const nomFichier = (snap.nomCommande || `rapport-pava-${snap.mois}`).replace(/[\\/:*?"<>|]/g, '_');
      XLSX.writeFile(wb, `${nomFichier}.xlsx`);
      void addVersion('analyse', `${nomFichier}.xlsx`, resultat.lignes.length, resultat.totalRecalcule);
    } finally {
      setExportEnCours(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString('fr-FR');

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Analyse</h1>
          <p className="g-lead">Commande « {snap.nomCommande} » · {fmt(resultat.lignes.length)} lignes recalculées par le moteur (R01–R13).</p>
        </div>
        <div className="g-tools">
          <select className="g-chip" aria-label="Commande" value={snap.activeCommandeId} onChange={(e) => setActiveCommande(e.target.value)}>
            {snap.commandes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <button type="button" className="g-btn g-btn--ghost" disabled={exportEnCours} onClick={() => { void addHistorique('Analyse exportée'); void setEtapeCommande('analyse'); void exporter(); }}>
            {exportEnCours ? 'Génération…' : 'Exporter xlsx'}
          </button>
          <Link className="g-btn" href="/admin/controle">Traiter les incohérences</Link>
        </div>
      </header>

      {snap.enChargement ? (
        <CarteChargement titre="Analyse en cours — chargement des lignes…" texte="Les lignes de la commande sont récupérées, puis recalculées par le moteur." />
      ) : (
        <>
          <section className="g-kpis">
            <article className="g-kpi g-glass g-rise"><div className="g-kpi-top"><span className="g-kpi-ico" /></div><b className="g-value g-num">{fmt(resultat.totalFacture)} $</b><span className="g-label">Total facturé</span></article>
            <article className="g-kpi g-glass g-rise"><div className="g-kpi-top"><span className="g-kpi-ico" /></div><b className="g-value g-num">{fmt(resultat.totalRecalcule)} $</b><span className="g-label">Total recalculé (price plan)</span></article>
            <article className="g-kpi g-glass g-rise"><div className="g-kpi-top"><span className="g-kpi-ico" /></div><b className="g-value g-num" style={{ color: ouvertes.length ? 'var(--g-bad)' : undefined }}>{fmt(lignesDistinctes(ouvertes))}</b><span className="g-label">Lignes à traiter</span></article>
            <article className="g-kpi g-glass g-rise"><div className="g-kpi-top"><span className="g-kpi-ico" /></div><b className="g-value g-num" style={{ color: impactOuvert < 0 ? 'var(--g-bad)' : 'var(--g-ok)' }}>{fmt(impactOuvert)} $</b><span className="g-label">Impact restant (négatif = surfacturé)</span></article>
          </section>

          <section className="g-card g-glass g-rise">
            <div className="g-card-head">
              <div>
                <h3 className="g-card-title">Incohérences par groupe</h3>
                <p className="g-card-sub">Une même ligne peut être signalée par plusieurs règles : les compteurs « lignes » ne la comptent qu’une fois.</p>
              </div>
            </div>
            {groupes.length === 0 ? (
              <p className="g-empty">Aucune incohérence détectée.</p>
            ) : (
              <div className="g-table-wrap">
                <table className="g-table">
                  <thead><tr><th>Règle</th><th>Raison</th><th>Confiance</th><th style={{ textAlign: 'right' }}>Lignes</th><th style={{ textAlign: 'right' }}>Traitées</th><th style={{ textAlign: 'right' }}>Impact restant</th></tr></thead>
                  <tbody>
                    {groupes.map((g) => (
                      <tr key={g.cle}>
                        <td><span className="g-ref">{g.regle}</span></td>
                        <td><b>{g.raison}</b></td>
                        <td><span className={`g-badge ${g.confiance === 'REGLE' ? 'is-ok' : g.confiance === 'PROBABLE' ? 'is-info' : g.confiance === 'A_VALIDER' ? 'is-warn' : 'is-muted'}`}><i className="g-dot" />{g.confiance}</span></td>
                        <td style={{ textAlign: 'right' }}>{fmt(g.items.length)}</td>
                        <td style={{ textAlign: 'right' }}>{fmt(g.items.filter((a) => estTraitee(a, snap.decisions)).length)}</td>
                        <td style={{ textAlign: 'right' }}>{g.info ? '—' : `${fmt(g.impactOuvert)} $`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="g-card g-glass g-rise">
            <div className="g-card-head">
              <div>
                <h3 className="g-card-title">Familles · conformes / à traiter</h3>
                <p className="g-card-sub">Nombre de lignes par famille de produit.</p>
              </div>
            </div>
            <div className="g-table-wrap">
              <table className="g-table">
                <thead><tr><th>Famille</th><th style={{ textAlign: 'right' }}>Conformes</th><th style={{ textAlign: 'right' }}>À traiter</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  {parFamille.map((x) => (
                    <tr key={x.f}><td><b>{x.f}</b></td><td style={{ textAlign: 'right' }}>{fmt(x.n - x.ko)}</td><td style={{ textAlign: 'right' }}>{fmt(x.ko)}</td><td style={{ textAlign: 'right' }}>{fmt(x.n)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="g-card-foot"><span>{fmt(resultat.lignes.length)} lignes</span><span>Détail et corrections : page Contrôle</span></div>
          </section>
        </>
      )}
    </>
  );
}

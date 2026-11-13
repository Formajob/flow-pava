'use client';

/**
 * Validation PAVA — version finale après corrections.
 * Deux niveaux : Admin puis Directeur. Une fois validé, le statut change.
 */

import { useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getPavaState, subscribePava, setStatutFacture } from '@/lib/pava-store';
import { runEngine, depuisDemo } from '@/lib/pava/engine';

export default function ValidationPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const statut = snap.statutFacture[snap.mois] || 'en_cours';

  const lignesNorm = useMemo(
    () => depuisDemo(snap.lignes as unknown as Array<Record<string, unknown>>, snap.mois),
    [snap.lignes, snap.mois]
  );
  const resultat = useMemo(() => runEngine(lignesNorm, snap.params), [lignesNorm, snap.params]);

  const restantes = resultat.anomalies.filter((a) => {
    const d = snap.decisions[a.id];
    return !d || d.statut === 'ouvert';
  });

  const validerAdmin = () => setStatutFacture(snap.mois, 'valide_admin');
  const validerDirecteur = () => setStatutFacture(snap.mois, 'validee');

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Validation</h1>
          <p className="g-lead">Version finale de la facture après corrections et traitement des incohérences.</p>
        </div>
        <div className="g-tools">
          <span className={`g-badge ${statut === 'validee' ? 'is-ok' : statut === 'valide_admin' ? 'is-info' : 'is-warn'}`}>
            <i className="g-dot" />{statut === 'validee' ? 'Validée' : statut === 'valide_admin' ? 'Validée Admin' : 'En cours'}
          </span>
        </div>
      </header>

      <section className="g-hero g-glass g-rise">
        <div>
          <div className="g-kicker"><i /> Facture {snap.mois}</div>
          <h2><em>{resultat.totalRecalcule.toLocaleString('fr-FR')} $</em></h2>
          <p>
            {resultat.lignes.length} lignes · {resultat.anomalies.length} incohérences détectées · {restantes.length} restantes.
            {restantes.length > 0 ? ' Traitez les restantes en Contrôle avant de valider.' : ' Toutes les incohérences sont traitées.'}
          </p>
          <div className="g-hero-actions">
            <button
              type="button"
              className="g-btn"
              onClick={validerAdmin}
              disabled={statut !== 'en_cours' || restantes.length > 0 || snap.role === 'analyste'}
              title={snap.role === 'analyste' ? 'Réservé à l’Admin et au Directeur' : undefined}
            >
              Valider (Admin)
            </button>
            <button
              type="button"
              className="g-btn g-btn--ghost"
              onClick={validerDirecteur}
              disabled={statut !== 'valide_admin' || snap.role !== 'directeur'}
              title={snap.role !== 'directeur' ? 'Réservé au Directeur' : undefined}
            >
              Valider (Directeur)
            </button>
            <Link className="g-btn g-btn--ghost" href="/admin/controle">Aller en Contrôle</Link>
          </div>
        </div>
        <div className="g-hero-side">
          <b className="g-num">{restantes.length}</b>
          <span>restantes</span>
          <small>{snap.mois}</small>
        </div>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Version finale · {resultat.lignes.length} lignes</h3>
            <p className="g-card-sub">Montants recalculés après corrections. C&apos;est cette version qui sera exportée en Factures.</p>
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
                <th style={{ textAlign: 'right' }}>Montant final</th>
              </tr>
            </thead>
            <tbody>
              {resultat.lignes.slice(0, 30).map((l, i) => (
                <tr key={i}>
                  <td>{l.feuille} · ligne {l.ligne_excel}</td>
                  <td>{l.no_cli || '—'}</td>
                  <td><b>{l.famille}</b> · {l.code_service}</td>
                  <td>{l.nature}</td>
                  <td style={{ textAlign: 'right' }}>{l.montant_attendu ?? l.paiement_pav ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="g-card-foot">
          <span>Total final : {resultat.totalRecalcule.toLocaleString('fr-FR')} $</span>
          <span>Statut : {statut}</span>
        </div>
      </section>
    </>
  );
}

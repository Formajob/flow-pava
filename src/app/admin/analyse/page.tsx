'use client';

/**
 * Analyse PAVA — détection automatique des incohérences.
 * Même logique que la démo (incoherences() dans pava-store).
 * Chaque ligne affiche sa Réf et sa feuille/ligne Excel.
 */

import { useMemo, useSyncExternalStore } from 'react';
import { getPavaState, subscribePava, incoherences } from '@/lib/pava-store';

export default function AnalysePage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const liste = useMemo(() => incoherences(snap.lignes, snap.mois), [snap.lignes, snap.mois]);

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Analyse</h1>
          <p className="g-lead">Détection automatique des incohérences sur le mois {snap.mois}. Chaque résultat indique sa référence Excel.</p>
        </div>
      </header>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Incohérences · {liste.length}</h3>
            <p className="g-card-sub">TPC en double, doublons, quantités, sources absentes, incomplets.</p>
          </div>
        </div>
        {liste.length === 0 ? (
          <p className="g-empty">Aucune incohérence détectée.</p>
        ) : (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>Réf</th>
                  <th>Compte</th>
                  <th>Produit</th>
                  <th>Feuille / Ligne Excel</th>
                  <th>Incohérence</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((l) => (
                  <tr key={l.id}>
                    <td><span className="g-ref">{l.ref || '—'}</span></td>
                    <td>{l.compte ? `Compte ${l.compte}` : '—'}</td>
                    <td><b>{l.produit}</b> · {l.desc}</td>
                    <td>{l.feuille || '—'}{l.ligneExcel ? ` · ligne ${l.ligneExcel}` : ''}</td>
                    <td>{l.incoherence || l.incomplet || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="g-card-foot">
          <span>{liste.length} incohérences</span>
          <span>Mois {snap.mois}</span>
        </div>
      </section>
    </>
  );
}

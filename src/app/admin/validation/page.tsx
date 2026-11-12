'use client';

/**
 * Validation PAVA — deux niveaux : Admin puis Directeur.
 */

import { useSyncExternalStore } from 'react';
import { getPavaState, subscribePava } from '@/lib/pava-store';

export default function ValidationPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Validation</h1>
          <p className="g-lead">Validation mensuelle en deux niveaux : Admin puis Directeur. Septembre validée, octobre en cours.</p>
        </div>
      </header>

      <section className="g-grid-2">
        <article className="g-card g-glass g-rise">
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Septembre 2026</h3>
              <p className="g-card-sub">Facture validée.</p>
            </div>
            <span className="g-badge is-ok"><i className="g-dot" />Validée</span>
          </div>
          <div className="g-card-foot">
            <span>3 587 lignes · 257 405 $</span>
            <span>Excel + PDF générés</span>
          </div>
        </article>

        <article className="g-card g-glass g-rise">
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Octobre 2026</h3>
              <p className="g-card-sub">Facture en cours de traitement.</p>
            </div>
            <span className="g-badge is-warn"><i className="g-dot" />En cours</span>
          </div>
          <div className="g-card-foot">
            <span>3 314 lignes · 232 735 $</span>
            <span>Validation Admin puis Directeur</span>
          </div>
        </article>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Étapes</h3>
            <p className="g-card-sub">Workflow mensuel.</p>
          </div>
        </div>
        <ol className="g-steps">
          <li className="g-step is-done"><b>Réception</b><span>Import Excel/CSV</span></li>
          <li className="g-step is-done"><b>Analyse</b><span>Incohérences</span></li>
          <li className="g-step is-active"><b>Contrôle</b><span>Vérification</span></li>
          <li className="g-step"><b>Validation Admin</b><span>Niveau 1</span></li>
          <li className="g-step"><b>Validation Directeur</b><span>Niveau 2</span></li>
          <li className="g-step"><b>Factures</b><span>Excel + PDF</span></li>
        </ol>
        <div className="g-card-foot">
          <span>Rôle actuel : {snap.role}</span>
          <span>Mois : {snap.mois}</span>
        </div>
      </section>
    </>
  );
}

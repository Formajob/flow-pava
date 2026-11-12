'use client';

/**
 * Contrôle PAVA — vérification avant validation.
 */

import { useSyncExternalStore } from 'react';
import { getPavaState, subscribePava } from '@/lib/pava-store';

export default function ControlePage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const lignes = snap.lignes.filter((l) => l.mois === snap.mois);
  const inco = lignes.filter((l) => l.incoherence || l.incomplet);

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Contrôle</h1>
          <p className="g-lead">Vérification des lignes avant validation Admin puis Directeur.</p>
        </div>
      </header>

      <section className="g-kpis">
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num">{lignes.length}</b>
          <span className="g-label">Lignes du mois</span>
        </article>
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num" style={{ color: inco.length ? 'var(--g-bad)' : undefined }}>{inco.length}</b>
          <span className="g-label">À corriger</span>
        </article>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Points de contrôle</h3>
            <p className="g-card-sub">Doublons, quantités, sources, incomplets.</p>
          </div>
        </div>
        <ul className="g-list">
          <li><div className="g-list-item"><span className="g-list-main"><b>TPC : 1 ligne par compte</b><span>Contrôle doublons</span></span><span className="g-list-side"><span className="g-badge is-ok"><i className="g-dot" />OK</span></span></div></li>
          <li><div className="g-list-item"><span className="g-list-main"><b>Quantités payées à l&apos;unité</b><span>AJOUT et Renouvellement</span></span><span className="g-list-side"><span className={`g-badge ${inco.length ? 'is-warn' : 'is-ok'}`}><i className="g-dot" />{inco.length ? 'À valider' : 'OK'}</span></span></div></li>
          <li><div className="g-list-item"><span className="g-list-main"><b>Sources 43 / 45 / 41 / 07</b><span>Présence des sources</span></span><span className="g-list-side"><span className="g-badge is-ok"><i className="g-dot" />OK</span></span></div></li>
        </ul>
      </section>
    </>
  );
}

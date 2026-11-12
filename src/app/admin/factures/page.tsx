'use client';

/**
 * Factures PAVA — navigation par mois et statut.
 * Septembre validée (Excel + PDF), octobre en cours.
 * Résumé du mois choisi, sans afficher toutes les lignes en bas.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import { getPavaState, subscribePava } from '@/lib/pava-store';

const MOIS = [
  { id: '2026-09', label: 'Septembre 2026', statut: 'Validée' },
  { id: '2026-10', label: 'Octobre 2026', statut: 'En cours' },
];

export default function FacturesPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [mois, setMois] = useState('2026-09');
  const lignes = useMemo(() => snap.lignes.filter((l) => l.mois === mois), [snap.lignes, mois]);
  const total = lignes.reduce((s, l) => s + ((l.montantCalcule ?? l.montantOrigine ?? 0) + (l.ajustement || 0)), 0);
  const validee = mois === '2026-09';

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Factures</h1>
          <p className="g-lead">Résumé de la facture du mois choisi et téléchargement des rapports.</p>
        </div>
        <div className="g-tools">
          <select className="g-chip" aria-label="Mois" value={mois} onChange={(e) => setMois(e.target.value)}>
            {MOIS.map((m) => (
              <option key={m.id} value={m.id}>{m.label} · {m.statut}</option>
            ))}
          </select>
        </div>
      </header>

      <section className="g-hero g-glass g-rise">
        <div>
          <div className="g-kicker"><i /> {validee ? 'Facture validée' : 'Facture en cours'}</div>
          <h2>{MOIS.find((m) => m.id === mois)?.label} · <em>{total.toLocaleString('fr-FR')} $</em></h2>
          <p>{lignes.length} lignes · {validee ? 'Excel + PDF générés' : 'En attente de validation Admin puis Directeur'}.</p>
          <div className="g-hero-actions">
            <button type="button" className="g-btn" disabled={!validee}>
              Télécharger Excel
            </button>
            <button type="button" className="g-btn g-btn--ghost" disabled={!validee}>
              Télécharger PDF
            </button>
          </div>
        </div>
        <div className="g-hero-side">
          <b className="g-num">{lignes.length}</b>
          <span>lignes</span>
          <small>{validee ? 'Validée' : 'En cours'}</small>
        </div>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Détail du mois</h3>
            <p className="g-card-sub">Le détail complet est dans les rapports Excel/PDF.</p>
          </div>
          <span className={`g-badge ${validee ? 'is-ok' : 'is-warn'}`}><i className="g-dot" />{validee ? 'Validée' : 'En cours'}</span>
        </div>
        <div className="g-card-foot">
          <span>{lignes.length} lignes · {total.toLocaleString('fr-FR')} $</span>
          <span>{validee ? 'Prête à télécharger' : 'Validation en cours'}</span>
        </div>
      </section>
    </>
  );
}

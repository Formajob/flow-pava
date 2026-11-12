'use client';

/**
 * Administration PAVA — rôles et paramètres.
 * L'Analyste ne voit pas les montants. L'Admin et le Directeur voient tout.
 */

import { useSyncExternalStore } from 'react';
import { getPavaState, subscribePava, setPavaRole, type Role } from '@/lib/pava-store';

export default function AdminPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Administration</h1>
          <p className="g-lead">Rôles et accès. L&apos;Analyste importe et analyse sans voir les montants finaux.</p>
        </div>
      </header>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Rôle actuel</h3>
            <p className="g-card-sub">Changez de rôle pour tester les accès.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['analyste', 'admin', 'directeur'] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              className={`g-btn ${snap.role === r ? '' : 'g-btn--ghost'}`}
              onClick={() => setPavaRole(r)}
            >
              {r === 'analyste' ? 'Analyste' : r === 'admin' ? 'Admin' : 'Directeur'}
            </button>
          ))}
        </div>
        <div className="g-card-foot">
          <span>Rôle : {snap.role}</span>
          <span>{snap.role === 'analyste' ? 'Montants masqués' : 'Montants visibles'}</span>
        </div>
      </section>
    </>
  );
}

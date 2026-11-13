'use client';

import { useSyncExternalStore } from 'react';
import { subscribePava, getPavaState } from '@/lib/pava-store';

/**
 * Barre fine animée en haut du contenu, visible tant que le state
 * ou les lignes de la commande consultée se chargent (mode base).
 * Complète la CarteChargement : l'utilisateur sait toujours que
 * l'application travaille, quelle que soit la page ouverte.
 */
export default function BarreChargement() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  if (!snap.enChargement) return null;
  return (
    <div
      role="status"
      aria-label="Chargement en cours"
      style={{
        position: 'sticky', top: 0, zIndex: 40,
        margin: '0 0 12px', padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid rgba(37,99,235,.22)',
        background: 'rgba(37,99,235,.07)',
        display: 'flex', gap: 10, alignItems: 'center',
        fontSize: 13, fontWeight: 600, color: 'var(--g-blue, #2563eb)',
      }}
    >
      <span className="g-loadspin" aria-hidden="true" />
      <span>Chargement des données de la base…</span>
    </div>
  );
}

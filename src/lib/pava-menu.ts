import type { MenuItem } from '@/components/layout/Sidebar';

/**
 * Menu FLOW VL PAVA — 8 onglets, sans doublons.
 * Passé en prop au Sidebar portable (aucune dépendance lib/menu).
 */
export const PAVA_MENU: MenuItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', href: '/admin' },
  { id: 'reception', label: 'Réception', href: '/admin/reception' },
  { id: 'analyse', label: 'Analyse', href: '/admin/analyse' },
  { id: 'regles', label: 'Règles', href: '/admin/regles' },
  { id: 'controle', label: 'Contrôle', href: '/admin/controle' },
  { id: 'validation', label: 'Validation', href: '/admin/validation' },
  { id: 'facture', label: 'Factures', href: '/admin/factures' },
  { id: 'admin', label: 'Administration', href: '/admin/admin' },
];

export const PAVA_SPACE_LABEL = 'Espace VL PAVA';

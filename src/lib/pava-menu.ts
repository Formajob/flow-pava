import type { MenuItem } from '@/components/layout/Sidebar';

/**
 * Menu FLOW VL PAVA — ordre du flux demandé :
 * Importation → Analyse → Contrôle → Règles → Validation → Factures.
 * Passé en prop au Sidebar portable (aucune dépendance lib/menu).
 */
export const PAVA_MENU: MenuItem[] = [
  { id: 'dashboard', label: 'Tableau de bord', href: '/admin' },
  { id: 'reception', label: 'Importation', href: '/admin/importation' },
  { id: 'analyse', label: 'Analyse', href: '/admin/analyse' },
  { id: 'controle', label: 'Contrôle', href: '/admin/controle' },
  { id: 'regles', label: 'Règles', href: '/admin/regles' },
  { id: 'validation', label: 'Validation', href: '/admin/validation' },
  { id: 'facture', label: 'Factures', href: '/admin/factures' },
  { id: 'admin', label: 'Administration', href: '/admin/admin' },
];

export const PAVA_SPACE_LABEL = 'Espace VL PAVA';

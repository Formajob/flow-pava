import { getSupabase } from '@/lib/supabase';
import { calculerStats, STATS_VIDES, type StatsCommande } from './stats';
import type { PavaLigne } from '@/lib/pava-store';

/**
 * Accès au stockage « blob » des lignes (serveur uniquement).
 * Les lignes d'un fichier importé vivent dans pava_fichiers.contenu
 * (un seul champ JSON par fichier), les retouches dans pava_corrections.
 */

/** Lignes assemblées d'une commande : blobs + corrections (supprimées exclues). */
export async function assemblerLignes(commandeId: string): Promise<PavaLigne[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const [ficsRes, corrsRes] = await Promise.all([
    supabase.from('pava_fichiers').select('contenu').eq('commande_id', commandeId).order('date_import'),
    supabase.from('pava_corrections').select('ligne_ref, patch, supprime').eq('commande_id', commandeId),
  ]);
  const parRef = new Map<string, { patch: Record<string, unknown> | null; supprime: boolean }>();
  for (const c of corrsRes.data || []) parRef.set(c.ligne_ref, { patch: c.patch, supprime: c.supprime });
  const lignes: PavaLigne[] = [];
  for (const f of ficsRes.data || []) {
    for (const l of (f.contenu as PavaLigne[] | null) || []) {
      const c = parRef.get(String(l.id));
      if (c?.supprime) continue;
      lignes.push(c?.patch ? ({ ...l, ...c.patch } as PavaLigne) : l);
    }
  }
  return lignes;
}

/** Recalcule et enregistre pava_commandes.stats (totaux du tableau de bord). */
export async function recalculerStatsCommande(commandeId: string): Promise<StatsCommande> {
  const supabase = getSupabase();
  if (!supabase) return STATS_VIDES;
  const lignes = await assemblerLignes(commandeId);
  const stats = lignes.length ? calculerStats(lignes) : STATS_VIDES;
  await supabase.from('pava_commandes').update({ stats }).eq('id', commandeId);
  return stats;
}

/** Copie sans la ligne source `brut` (jamais envoyée au navigateur). */
export function sansBrut(lignes: PavaLigne[]): PavaLigne[] {
  return lignes.map((l) => {
    const copie: Record<string, unknown> = { ...l };
    delete copie.brut;
    return copie as unknown as PavaLigne;
  });
}

'use client';

/**
 * Contrôle PAVA — triage des incohérences par GROUPES.
 * On ne parcourt plus des milliers de lignes : chaque groupe (règle + raison) se traite
 * en bloc (ignorer, valider, corriger automatiquement) ou ligne par ligne via sélection.
 * La liste détaillée d'un groupe est paginée (25 lignes) et filtrable.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import CarteChargement from '@/components/pava/CarteChargement';
import GroupeAnomalies from '@/components/pava/GroupeAnomalies';
import ModalLigne from '@/components/pava/ModalLigne';
import { getPavaState, subscribePava, setDecisionsBulk, corrigerLignesBulk, updateLigne, deleteLigne, type CorrectionLigne, type PavaLigne } from '@/lib/pava-store';
import { runEngine, depuisDemo, historiqueVersRows } from '@/lib/pava/engine';
import { aTraiter, estTraitee, grouper, lignesDistinctes } from '@/lib/pava/groupes';
import type { Anomaly } from '@/lib/pava/types';

type Onglet = 'traiter' | 'traitees' | 'infos';

export default function ControlePage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [onglet, setOnglet] = useState<Onglet>('traiter');
  const [occupe, setOccupe] = useState(false);
  const [edition, setEdition] = useState<Anomaly | null>(null);

  const lignesNorm = useMemo(
    () => depuisDemo(snap.lignes as unknown as Array<Record<string, unknown>>, snap.mois),
    [snap.lignes, snap.mois]
  );
  // Historique des autres commandes (endpoint /renouvellements) → règle R03.
  const refsMoteur = useMemo(
    () => ({ historique: historiqueVersRows(snap.renouvellements) }),
    [snap.renouvellements]
  );
  const resultat = useMemo(() => runEngine(lignesNorm, snap.params, refsMoteur), [lignesNorm, snap.params, refsMoteur]);
  const rows = useMemo(() => new Map(resultat.lignes.map((r) => [r.ligne_id, r])), [resultat.lignes]);
  const lignesParId = useMemo(() => new Map(snap.lignes.map((l) => [l.id, l])), [snap.lignes]);

  const ouvertes = useMemo(() => aTraiter(resultat.anomalies, snap.decisions), [resultat.anomalies, snap.decisions]);
  const traitees = useMemo(
    () => resultat.anomalies.filter((a) => a.scope === 'ligne' && a.confiance !== 'INFO' && estTraitee(a, snap.decisions)),
    [resultat.anomalies, snap.decisions]
  );
  const infos = useMemo(() => resultat.anomalies.filter((a) => a.scope === 'global' || a.confiance === 'INFO'), [resultat.anomalies]);

  const courantes = onglet === 'traiter' ? ouvertes : onglet === 'traitees' ? traitees : infos;
  const groupes = useMemo(() => grouper(courantes, snap.decisions), [courantes, snap.decisions]);
  const nbGroupesOuverts = useMemo(() => grouper(ouvertes, snap.decisions).length, [ouvertes, snap.decisions]);
  const impactOuvert = ouvertes.reduce((s, a) => s + a.impact, 0);

  const ids = (items: Anomaly[]) => items.map((a) => a.id);
  const executer = async (fn: () => Promise<unknown> | unknown) => {
    setOccupe(true);
    try {
      await fn();
    } finally {
      setOccupe(false);
    }
  };

  const ignorer = (items: Anomaly[], commentaire: string) => executer(() => setDecisionsBulk(ids(items), 'ignore', commentaire));
  const valider = (items: Anomaly[]) => executer(() => setDecisionsBulk(ids(items), 'valide', 'Validée en Contrôle.'));
  const rouvrir = (items: Anomaly[]) => executer(() => setDecisionsBulk(ids(items), 'ouvert', ''));

  /** Correction automatique : applique le « fix » de chaque règle en UN appel (suppression ou montant attendu). */
  const corriger = (items: Anomaly[]) =>
    executer(async () => {
      const parLigne = new Map<string, CorrectionLigne>();
      for (const a of items) {
        if (!a.fix || !a.ligne_id) continue;
        if (a.fix.type === 'supprimer') parLigne.set(a.ligne_id, { id: a.ligne_id, supprimer: true });
        else if (!parLigne.get(a.ligne_id)?.supprimer) parLigne.set(a.ligne_id, { id: a.ligne_id, patch: { montantOrigine: a.fix.valeur, montantCalcule: a.fix.valeur } });
      }
      const ok = await corrigerLignesBulk([...parLigne.values()]);
      if (ok) await setDecisionsBulk(ids(items), 'corrige', 'Correction automatique.');
    });

  const ligneEditee: PavaLigne | undefined = edition ? lignesParId.get(edition.ligne_id) : undefined;
  const anomaliesLigne = edition ? resultat.anomalies.filter((a) => a.ligne_id === edition.ligne_id) : [];

  const sauver = (patch: Partial<PavaLigne>) =>
    executer(async () => {
      if (!ligneEditee) return;
      const ok = await updateLigne(ligneEditee.id, patch);
      if (ok) await setDecisionsBulk(ids(anomaliesLigne), 'corrige', 'Ligne modifiée en Contrôle.');
      setEdition(null);
    });
  const supprimer = () =>
    executer(async () => {
      if (!ligneEditee) return;
      const ok = await deleteLigne(ligneEditee.id);
      if (ok) await setDecisionsBulk(ids(anomaliesLigne), 'corrige', 'Ligne supprimée en Contrôle.');
      setEdition(null);
    });

  const chip = (o: Onglet, label: string, n: number) => (
    <button key={o} type="button" className={`g-btn g-btn--sm ${onglet === o ? '' : 'g-btn--ghost'}`} onClick={() => setOnglet(o)}>
      {label} · {n.toLocaleString('fr-FR')}
    </button>
  );

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Contrôle</h1>
          <p className="g-lead">
            Traitez les incohérences par groupe : corrigez automatiquement, ignorez avec un commentaire, ou ouvrez le groupe pour agir sur une sélection de lignes.
          </p>
        </div>
        <div className="g-tools">
          <Link className="g-btn g-btn--ghost" href="/admin/analyse">Analyse</Link>
          <Link className="g-btn" href="/admin/validation">Validation</Link>
        </div>
      </header>

      {snap.erreur && (
        <div className="g-card g-glass" style={{ borderColor: 'var(--g-bad, #dc2626)' }}>
          <p style={{ fontSize: 13 }}><b>Erreur base de données :</b> {snap.erreur}</p>
        </div>
      )}
      {snap.enChargement && <CarteChargement titre="Chargement du contrôle…" texte="Les lignes de la commande sont récupérées puis passées dans les règles R01–R13." />}

      <section className="g-kpis">
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num" style={{ color: ouvertes.length ? 'var(--g-bad)' : undefined }}>{lignesDistinctes(ouvertes).toLocaleString('fr-FR')}</b>
          <span className="g-label">Lignes à traiter</span>
        </article>
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num">{nbGroupesOuverts}</b>
          <span className="g-label">Groupes à traiter</span>
        </article>
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num">{traitees.length.toLocaleString('fr-FR')}</b>
          <span className="g-label">Déjà traitées</span>
        </article>
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num" style={{ color: impactOuvert < 0 ? 'var(--g-bad)' : 'var(--g-ok)' }}>{impactOuvert.toLocaleString('fr-FR')} $</b>
          <span className="g-label">Impact restant (négatif = surfacturé)</span>
        </article>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 12px' }}>
        {chip('traiter', 'À traiter', ouvertes.length)}
        {chip('traitees', 'Traitées', traitees.length)}
        {chip('infos', 'Informations (qualité, alertes)', infos.length)}
      </div>

      {groupes.length === 0 ? (
        <p className="g-empty">
          {onglet === 'traiter' ? 'Rien à traiter. Passez à la Validation.' : onglet === 'traitees' ? 'Aucune anomalie traitée pour le moment.' : 'Aucune information.'}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {groupes.map((g) => (
            <GroupeAnomalies
              key={`${onglet}-${g.cle}`}
              groupe={g}
              items={g.items}
              mode={onglet}
              decisions={snap.decisions}
              rows={rows}
              occupe={occupe}
              onIgnorer={ignorer}
              onValider={valider}
              onCorriger={corriger}
              onRouvrir={rouvrir}
              onEditer={setEdition}
            />
          ))}
        </div>
      )}

      {edition && ligneEditee && (
        <ModalLigne ligne={ligneEditee} anomalies={anomaliesLigne} onSave={sauver} onDelete={supprimer} onClose={() => setEdition(null)} />
      )}
    </>
  );
}

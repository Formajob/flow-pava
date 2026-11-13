'use client';

/**
 * Contrôle PAVA — action sur les incohérences restantes.
 * Ignorer : on oublie l'incohérence et on laisse un commentaire.
 * Corriger : formulaire avec toutes les infos de la ligne, modification des champs/montants,
 * enregistrement et suppression.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import { getPavaState, subscribePava, setDecision, updateLigne, deleteLigne } from '@/lib/pava-store';
import { runEngine, depuisDemo } from '@/lib/pava/engine';
import CarteChargement from '@/components/pava/CarteChargement';

export default function ControlePage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [commentaires, setCommentaires] = useState<Record<string, string>>({});
  const [correction, setCorrection] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const lignesNorm = useMemo(
    () => depuisDemo(snap.lignes as unknown as Array<Record<string, unknown>>, snap.mois),
    [snap.lignes, snap.mois]
  );
  const resultat = useMemo(() => runEngine(lignesNorm, snap.params), [lignesNorm, snap.params]);

  const restantes = resultat.anomalies.filter((a) => {
    const d = snap.decisions[a.id];
    return !d || d.statut === 'ouvert';
  });

  const ignorer = (id: string) => {
    const commentaire = commentaires[id] || '';
    if (!commentaire.trim()) {
      alert('Laissez un commentaire pour la raison avant d’ignorer.');
      return;
    }
    setDecision(id, { statut: 'ignore', commentaire });
  };

  const ouvrirCorrection = (id: string) => {
    const a = resultat.anomalies.find((x) => x.id === id);
    if (!a) return;
    // Retrouver la ligne source via feuille + ligne Excel
    const ligne = snap.lignes.find((l) => l.feuille === a.feuille && l.ligneExcel === a.ligne_excel);
    if (!ligne) {
      alert('Ligne source introuvable.');
      return;
    }
    setCorrection(ligne.id);
    setForm({
      compte: ligne.compte, produit: ligne.produit, desc: ligne.desc,
      categorie: ligne.categorie, source: ligne.source,
      quantite: String(ligne.quantite), montantOrigine: String(ligne.montantOrigine ?? ''),
      puissance: ligne.puissance || '',
    });
  };

  const enregistrer = () => {
    if (!correction) return;
    updateLigne(correction, {
      compte: form.compte, produit: form.produit, desc: form.desc,
      categorie: form.categorie as never, source: form.source,
      quantite: Number(form.quantite) || 1,
      montantOrigine: form.montantOrigine === '' ? null : Number(form.montantOrigine),
      puissance: form.puissance,
    });
    setDecision(correction, { statut: 'corrige', commentaire: 'Ligne corrigée en Contrôle.' });
    setCorrection(null);
  };

  const supprimer = () => {
    if (!correction) return;
    if (!confirm('Supprimer cette ligne de la facture ?')) return;
    deleteLigne(correction);
    setCorrection(null);
  };

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Contrôle</h1>
          <p className="g-lead">Prenez action sur les incohérences restantes : ignorez avec commentaire, ou corrigez la ligne.</p>
        </div>
      </header>

      {snap.enChargement && <CarteChargement titre="Chargement du contrôle…" texte="Les lignes de la commande sont récupérées puis passées dans les règles R01–R13." />}

      <section className="g-kpis">
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num">{resultat.anomalies.length}</b>
          <span className="g-label">Incohérences détectées</span>
        </article>
        <article className="g-kpi g-glass g-rise">
          <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
          <b className="g-value g-num" style={{ color: restantes.length ? 'var(--g-bad)' : undefined }}>{restantes.length}</b>
          <span className="g-label">Restantes à traiter</span>
        </article>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Incohérences restantes · {restantes.length}</h3>
            <p className="g-card-sub">Ignorer = on oublie avec commentaire. Corriger = formulaire avec toutes les infos de la ligne.</p>
          </div>
        </div>
        {restantes.length === 0 ? (
          <p className="g-empty">Toutes les incohérences ont été traitées. Passez à la Validation.</p>
        ) : (
          <ul className="g-list">
            {restantes.map((a) => (
              <li key={a.id}>
                <div className="g-list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <span className="g-list-main">
                      <b>{a.id} · {a.raison}</b>
                      <span>{a.explication} — {a.solution} · Impact {a.impact} $ · {a.feuille} ligne {a.ligne_excel}</span>
                    </span>
                    <span className="g-list-side">
                      <span className={`g-badge ${a.confiance === 'REGLE' ? 'is-ok' : a.confiance === 'PROBABLE' ? 'is-info' : 'is-warn'}`}><i className="g-dot" />{a.confiance}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                      className="g-input"
                      style={{ maxWidth: 320 }}
                      placeholder="Commentaire (obligatoire pour ignorer)"
                      value={commentaires[a.id] || ''}
                      onChange={(e) => setCommentaires({ ...commentaires, [a.id]: e.target.value })}
                    />
                    <button type="button" className="g-btn g-btn--ghost g-btn--sm" style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Ignorer" aria-label="Ignorer" onClick={() => ignorer(a.id)}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></svg>
                    </button>
                    <button type="button" className="g-btn g-btn--sm" style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Corriger" aria-label="Corriger" onClick={() => ouvrirCorrection(a.id)}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                    </button>
                  </div>
                  {correction && (
                    <div className="g-card" style={{ padding: 16, background: 'rgba(255,255,255,.6)' }}>
                      <h4 style={{ margin: '0 0 12px' }}>Corriger la ligne</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                        <label>Compte<input className="g-input" value={form.compte || ''} onChange={(e) => setForm({ ...form, compte: e.target.value })} /></label>
                        <label>Produit<input className="g-input" value={form.produit || ''} onChange={(e) => setForm({ ...form, produit: e.target.value })} /></label>
                        <label>Description<input className="g-input" value={form.desc || ''} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></label>
                        <label>Catégorie
                          <select className="g-input" value={form.categorie || ''} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
                            <option>AJOUT</option><option>RENOUVELLEMENT</option><option>SACA</option><option>NON_FACTUREE</option>
                          </select>
                        </label>
                        <label>Source<input className="g-input" value={form.source || ''} onChange={(e) => setForm({ ...form, source: e.target.value })} /></label>
                        <label>Quantité<input className="g-input" type="number" value={form.quantite || ''} onChange={(e) => setForm({ ...form, quantite: e.target.value })} /></label>
                        <label>Montant<input className="g-input" type="number" value={form.montantOrigine || ''} onChange={(e) => setForm({ ...form, montantOrigine: e.target.value })} /></label>
                        <label>Puissance<input className="g-input" value={form.puissance || ''} onChange={(e) => setForm({ ...form, puissance: e.target.value })} /></label>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button type="button" className="g-btn g-btn--sm" onClick={enregistrer}>Enregistrer la modification</button>
                        <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={supprimer}>Supprimer la ligne</button>
                        <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => setCorrection(null)}>Annuler</button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

'use client';

/** Fenêtre unique de correction d'une ligne (au lieu d'un formulaire répété sous chaque anomalie). */

import { useState } from 'react';
import type { PavaLigne } from '@/lib/pava-store';
import type { Anomaly } from '@/lib/pava/types';

interface Props {
  ligne: PavaLigne;
  anomalies: Anomaly[];
  onSave: (patch: Partial<PavaLigne>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function ModalLigne({ ligne, anomalies, onSave, onDelete, onClose }: Props) {
  const [form, setForm] = useState({
    compte: ligne.compte, desc: ligne.desc, produit: ligne.produit, categorie: ligne.categorie, source: ligne.source,
    quantite: String(ligne.quantite), montantOrigine: String(ligne.montantOrigine ?? ''), puissance: ligne.puissance || '',
  });
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });
  const m = ligne.meta;

  const enregistrer = () =>
    onSave({
      compte: form.compte, desc: form.desc, produit: form.produit, famille: form.produit,
      categorie: form.categorie as PavaLigne['categorie'], source: form.source, puissance: form.puissance,
      quantite: Number(form.quantite) || 1,
      montantOrigine: form.montantOrigine === '' ? null : Number(form.montantOrigine),
    });

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(11,19,48,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="g-card g-glass" onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
        <h3 className="g-card-title">Corriger la ligne · {ligne.feuille?.trim()} ligne {ligne.ligneExcel}</h3>
        <ul style={{ margin: '8px 0 12px', paddingLeft: 18, fontSize: 12 }}>
          {anomalies.map((a) => <li key={a.id}><b>{a.regle}</b> — {a.explication}</li>)}
        </ul>
        {m && (
          <p className="g-card-sub" style={{ marginBottom: 12 }}>
            {m.nom_client && <>Client : <b>{m.nom_client}</b> · </>}
            {m.cle_com && <>Commande : {m.cle_com} · </>}
            {m.no_serv && <>Service : {m.no_serv} · </>}
            {m.nb_mois_eng !== null && <>Engagement : {m.nb_mois_eng} mois · </>}
            {m.date_compl && <>Complétée : {m.date_compl}</>}
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <label>Compte<input className="g-input" value={form.compte} onChange={(e) => set('compte', e.target.value)} /></label>
          <label>Famille<input className="g-input" value={form.produit} onChange={(e) => set('produit', e.target.value)} /></label>
          <label>Code service<input className="g-input" value={form.desc} onChange={(e) => set('desc', e.target.value)} /></label>
          <label>Puissance<input className="g-input" value={form.puissance} onChange={(e) => set('puissance', e.target.value)} /></label>
          <label>Catégorie
            <select className="g-input" value={form.categorie} onChange={(e) => set('categorie', e.target.value)}>
              <option>AJOUT</option><option>RENOUVELLEMENT</option><option>SACA</option><option>NON_FACTUREE</option>
            </select>
          </label>
          <label>Source<input className="g-input" value={form.source} onChange={(e) => set('source', e.target.value)} /></label>
          <label>Quantité<input className="g-input" type="number" value={form.quantite} onChange={(e) => set('quantite', e.target.value)} /></label>
          <label>Montant ($)<input className="g-input" type="number" value={form.montantOrigine} onChange={(e) => set('montantOrigine', e.target.value)} /></label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button type="button" className="g-btn g-btn--sm" onClick={enregistrer}>Enregistrer</button>
          <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => { if (confirm('Retirer cette ligne de la facture ?')) onDelete(); }}>Supprimer la ligne</button>
          <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

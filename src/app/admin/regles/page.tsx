'use client';

/**
 * Règles PAVA — Price Plan modifiable.
 * Une fois validées, l'Analyse se refait avec les nouvelles règles.
 */

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getPavaState, subscribePava, setParams } from '@/lib/pava-store';
import type { PavaParams } from '@/lib/pava/types';

export default function ReglesPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [form, setForm] = useState<PavaParams>(snap.params);
  const [message, setMessage] = useState('');

  const set = (cle: keyof PavaParams, valeur: string | number | boolean) => {
    setForm({ ...form, [cle]: valeur });
  };
  const setInternet = (cle: string, valeur: string) => {
    setForm({ ...form, internet: { ...form.internet, [cle]: Number(valeur) || 0 } });
  };
  const setTpc = (cle: string, valeur: string) => {
    setForm({ ...form, tpc: { ...form.tpc, [cle]: Number(valeur) || 0 } });
  };

  const enregistrer = () => {
    setParams(form);
    setMessage('Règles enregistrées. L’Analyse a été refaite avec les nouvelles règles.');
  };

  const champ = (label: string, valeur: number, onChange: (v: string) => void) => (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>
      {label}
      <input className="g-input" type="number" value={valeur} onChange={(e) => onChange(e.target.value)} style={{ marginTop: 6 }} />
    </label>
  );

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Règles</h1>
          <p className="g-lead">Modifiez le Price Plan et les paramètres, puis validez : l&apos;Analyse se refait avec les nouvelles règles.</p>
        </div>
        <div className="g-tools">
          <button type="button" className="g-btn" onClick={enregistrer}>Valider les règles</button>
          <Link className="g-btn g-btn--ghost" href="/admin/analyse">Voir l&apos;Analyse</Link>
        </div>
      </header>

      {message && <p style={{ fontSize: 13 }}><b>{message}</b></p>}

      <section className="g-grid-2">
        <article className="g-card g-glass g-rise">
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Price Plan — AJOUT</h3>
              <p className="g-card-sub">Prix unitaires éditables.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            {champ('Internet 15 Mb', form.internet['15'], (v) => setInternet('15', v))}
            {champ('Internet 100 Mb', form.internet['100'], (v) => setInternet('100', v))}
            {champ('Internet 200 Mb', form.internet['200'], (v) => setInternet('200', v))}
            {champ('Internet 400 Mb', form.internet['400'], (v) => setInternet('400', v))}
            {champ('Internet 500 Mb (exception)', form.internet['500'], (v) => setInternet('500', v))}
            {champ('Internet Giga', form.internet['Giga'], (v) => setInternet('Giga', v))}
            {champ('TPC 60 mois', form.tpc['60'], (v) => setTpc('60', v))}
            {champ('TPC 36 mois', form.tpc['36'], (v) => setTpc('36', v))}
            {champ('TPC sans / 12 / 24 mois', form.tpc['sans'], (v) => setTpc('sans', v))}
            {champ('SIM / TMO', form.sim, (v) => set('sim', Number(v) || 0))}
            {champ('TV (NUM)', form.tv, (v) => set('tv', Number(v) || 0))}
            {champ('TIPN', form.tipn, (v) => set('tipn', Number(v) || 0))}
            {champ('WIFIPRO', form.wifipro, (v) => set('wifipro', Number(v) || 0))}
            {champ('Redondance', form.redo, (v) => set('redo', Number(v) || 0))}
            {champ('Renouvellement', form.renouvellement, (v) => set('renouvellement', Number(v) || 0))}
            {champ('Forfait 50/50 (à confirmer)', form.forfait5050, (v) => set('forfait5050', Number(v) || 0))}
          </div>
        </article>

        <article className="g-card g-glass g-rise">
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Paramètres du moteur</h3>
              <p className="g-card-sub">Contrôle sur N mois, déménagements.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {champ('Contrôle renouvellements sur N mois', form.n_mois, (v) => set('n_mois', Number(v) || 3))}
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.demenagement_payable} onChange={(e) => set('demenagement_payable', e.target.checked)} />
              Déménagement payable : {form.demenagement_payable ? 'oui' : 'non'}
            </label>
            <p style={{ fontSize: 12, color: 'var(--g-muted)' }}>
              Exceptions : Internet 500 au prix du 400 (300), TPC sans engagement / 12 / 24 mois au prix du TPC 36 mois (100),
              sources 43 / 45 / 41 incluses, SACA = source 07.
            </p>
          </div>
        </article>
      </section>
    </>
  );
}

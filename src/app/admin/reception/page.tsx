'use client';

/**
 * Réception PAVA — import Excel/CSV (même logique que la démo).
 * Les fichiers sont lus dans le navigateur, jamais envoyés sur un serveur.
 */

import { useState } from 'react';

export default function ReceptionPage() {
  const [nom, setNom] = useState('');
  const [nb, setNb] = useState(0);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setNom(f.name);
    setNb(0);
    // Lecture simple : compter les lignes pour la démo.
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setNb(text.split(/\r?\n/).filter(Boolean).length);
    };
    reader.readAsText(f);
  };

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Réception</h1>
          <p className="g-lead">Importez les fichiers Excel ou CSV (interne Xceed + client Videotron Affaire) pour passer à l&apos;étape Analyse.</p>
        </div>
      </header>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Importer un fichier</h3>
            <p className="g-card-sub">La Réception ne se fait jamais à la main : déposez le fichier raw ici.</p>
          </div>
        </div>
        <label className="g-btn" style={{ display: 'inline-flex', cursor: 'pointer' }}>
          Choisir un fichier Excel ou CSV
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: 'none' }} />
        </label>
        {nom && (
          <p style={{ marginTop: 12, fontSize: 13 }}>
            <b>{nom}</b> · {nb} lignes lues. Passez à l&apos;Analyse pour voir les incohérences.
          </p>
        )}
        <div className="g-card-foot">
          <span>Sources : interne Xceed + client Videotron Affaire</span>
          <span>Formats : .xlsx, .xls, .csv</span>
        </div>
      </section>
    </>
  );
}

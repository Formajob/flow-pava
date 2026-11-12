'use client';

/**
 * Réception PAVA — import Excel/CSV avec affichage des fichiers.
 * Les fichiers sont lus dans le navigateur (SheetJS), normalisés,
 * puis passés à l'Analyse. Jamais de saisie manuelle.
 */

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getPavaState, subscribePava, addImportedFile, type PavaLigne } from '@/lib/pava-store';
import { detecterFeuille, normaliserLigne } from '@/lib/pava/normalize';

export default function ReceptionPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [message, setMessage] = useState('');
  const [chargement, setChargement] = useState(false);
  const [apercu, setApercu] = useState<PavaLigne[]>([]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setChargement(true);
    setMessage('');
    try {
      const XLSX = await import('xlsx');
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const nouvelles: PavaLigne[] = [];
      const feuilles: string[] = [];
      let compteur = snap.lignes.length + 1;

      for (const nomFeuille of wb.SheetNames) {
        const ws = wb.Sheets[nomFeuille];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        if (rows.length === 0) continue;
        const colonnes = Object.keys(rows[0]);
        const feuille = detecterFeuille(nomFeuille, colonnes);
        feuilles.push(`${nomFeuille} (${feuille.format}/${feuille.nature})`);
        for (let i = 0; i < rows.length; i++) {
          const norm = normaliserLigne(rows[i], feuille, i + 2, snap.mois);
          if (norm.ligne_total) continue;
          nouvelles.push({
            id: `${snap.mois}-IMP-${String(compteur++).padStart(4, '0')}`,
            mois: snap.mois,
            compte: norm.no_cli,
            produit: norm.famille,
            famille: norm.famille,
            type: '',
            desc: norm.code_service,
            categorie: norm.nature === 'RENO' ? 'RENOUVELLEMENT' : norm.nature === 'SACA' ? 'SACA' : norm.nature === 'NON_FACTUREE' ? 'NON_FACTUREE' : 'AJOUT',
            source: norm.src_code,
            puissance: norm.puissance,
            quantite: norm.qty,
            montantOrigine: norm.paiement_pav,
            feuille: norm.feuille,
            ligneExcel: norm.ligne_excel,
          });
        }
      }

      if (nouvelles.length === 0) {
        setMessage('Aucune ligne exploitable trouvée dans ce fichier. Vérifiez les feuilles et les colonnes.');
      } else {
        addImportedFile(
          { id: `f-${Date.now()}`, nom: f.name, date: new Date().toLocaleString('fr-FR'), feuilles, nbLignes: nouvelles.length, mois: snap.mois },
          nouvelles
        );
        setApercu(nouvelles.slice(0, 20));
        setMessage(`${nouvelles.length} lignes importées depuis ${f.name}. Passez à l'Analyse.`);
      }
    } catch {
      setMessage('Impossible de lire ce fichier. Vérifiez le format (.xlsx, .xls, .csv).');
    } finally {
      setChargement(false);
      e.target.value = '';
    }
  };

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Réception</h1>
          <p className="g-lead">Importez les fichiers Excel ou CSV (interne Xceed + client Videotron Affaire). L&apos;Analyse se fait ensuite automatiquement.</p>
        </div>
        <div className="g-tools">
          <Link className="g-btn" href="/admin/analyse">Passer à l&apos;Analyse</Link>
        </div>
      </header>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Importer un fichier</h3>
            <p className="g-card-sub">La Réception ne se fait jamais à la main : déposez le fichier raw ici. Feuilles détectées par nom et colonnes.</p>
          </div>
        </div>
        <label className="g-btn" style={{ display: 'inline-flex', cursor: chargement ? 'wait' : 'pointer' }}>
          {chargement ? 'Lecture en cours…' : 'Choisir un fichier Excel ou CSV'}
          <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: 'none' }} disabled={chargement} />
        </label>
        {message && <p style={{ marginTop: 12, fontSize: 13 }}><b>{message}</b></p>}
        <div className="g-card-foot">
          <span>Sources : interne Xceed + client Videotron Affaire</span>
          <span>Formats : .xlsx, .xls, .csv · Mois : {snap.mois}</span>
        </div>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Fichiers importés · {snap.fichiers.length}</h3>
            <p className="g-card-sub">Historique des imports pour le mois en cours.</p>
          </div>
        </div>
        {snap.fichiers.length === 0 ? (
          <p className="g-empty">Aucun fichier importé pour l&apos;instant. Les données de démo (septembre + octobre) sont déjà chargées.</p>
        ) : (
          <ul className="g-list">
            {snap.fichiers.map((f) => (
              <li key={f.id}>
                <div className="g-list-item">
                  <span className="g-list-main">
                    <b>{f.nom}</b>
                    <span>{f.feuilles.join(' · ')} · {f.date}</span>
                  </span>
                  <span className="g-list-side"><span className="g-badge is-ok"><i className="g-dot" />{f.nbLignes} lignes</span></span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {apercu.length > 0 && (
        <section className="g-card g-glass g-rise">
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Aperçu des lignes importées</h3>
              <p className="g-card-sub">Premières lignes normalisées (schéma commun).</p>
            </div>
          </div>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr><th>Feuille</th><th>Ligne Excel</th><th>Compte</th><th>Produit</th><th>Catégorie</th><th style={{ textAlign: 'right' }}>Montant</th></tr>
              </thead>
              <tbody>
                {apercu.map((l) => (
                  <tr key={l.id}>
                    <td>{l.feuille}</td>
                    <td>{l.ligneExcel}</td>
                    <td>{l.compte || '—'}</td>
                    <td><b>{l.produit}</b> · {l.desc}</td>
                    <td>{l.categorie}</td>
                    <td style={{ textAlign: 'right' }}>{l.montantOrigine ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

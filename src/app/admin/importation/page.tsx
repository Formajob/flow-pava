'use client';

/**
 * Importation PAVA (ex-Réception) — création de commande + import Excel/CSV.
 * Chaque commande = une entrée/projet avec historique.
 * La commande génère un fichier Excel au nom saisi + page Data importés.
 */

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getPavaState, subscribePava, addImportedFile, createCommande, setActiveCommande, addHistorique, type PavaLigne } from '@/lib/pava-store';
import { detecterFeuille, normaliserLigne } from '@/lib/pava/normalize';

export default function ImportationPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [nom, setNom] = useState('');
  const [type, setType] = useState<'facture_mois' | 'verification' | 'test' | 'suivi'>('facture_mois');
  const [message, setMessage] = useState('');
  const [chargement, setChargement] = useState(false);
  const [apercu, setApercu] = useState<PavaLigne[]>([]);

  const creer = () => {
    if (!nom.trim()) {
      setMessage('Le nom de la commande est obligatoire.');
      return;
    }
    createCommande(nom, type, snap.mois);
    setMessage(`Commande « ${nom.trim()} » créée. Importez maintenant les fichiers.`);
    setNom('');
  };

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
        setMessage('Aucune ligne exploitable trouvée. Vérifiez les feuilles et les colonnes.');
      } else {
        addImportedFile(
          { id: `f-${Date.now()}`, nom: f.name, date: new Date().toLocaleString('fr-FR'), feuilles, nbLignes: nouvelles.length, mois: snap.mois },
          nouvelles
        );
        addHistorique(`Import ${f.name} : ${nouvelles.length} lignes`);
        setApercu(nouvelles.slice(0, 20));
        setMessage(`${nouvelles.length} lignes importées. La commande se génère comme fichier Excel au nom saisi.`);
      }
    } catch {
      setMessage('Impossible de lire ce fichier. Vérifiez le format (.xlsx, .xls, .csv).');
    } finally {
      setChargement(false);
      e.target.value = '';
    }
  };

  const telechargerCommande = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const rows = snap.lignes.map((l) => ({
      Feuille: l.feuille, 'Ligne Excel': l.ligneExcel, Compte: l.compte,
      Produit: l.produit, Description: l.desc, Catégorie: l.categorie,
      Source: l.source, Quantité: l.quantite, Montant: l.montantOrigine,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Data importés');
    const nomFichier = (snap.nomCommande || 'commande').replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `${nomFichier}.xlsx`);
  };

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Importation</h1>
          <p className="g-lead">Créez une commande de facture, importez les fichiers Excel, puis passez à l&apos;Analyse.</p>
        </div>
        <div className="g-tools">
          <Link className="g-btn" href="/admin/analyse">Passer à l&apos;Analyse</Link>
        </div>
      </header>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Créer une commande de facture</h3>
            <p className="g-card-sub">Chaque commande = une entrée/projet avec historique. Le nom est obligatoire.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ flex: '1 1 260px', fontSize: 12, fontWeight: 700 }}>
            Nom de la commande *
            <input className="g-input" placeholder="Ex : Facture Novembre, Facture_test, Vérification Août 2026" value={nom} onChange={(e) => setNom(e.target.value)} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Type
            <select className="g-input" value={type} onChange={(e) => setType(e.target.value as never)} style={{ marginTop: 6 }}>
              <option value="facture_mois">Facture du mois à préparer</option>
              <option value="verification">Ancienne facture à valider</option>
              <option value="test">Test de facture</option>
              <option value="suivi">Suivi de production PAVA</option>
            </select>
          </label>
          <button type="button" className="g-btn" onClick={creer}>Créer la commande</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 13 }}>
          Commande active : <b>{snap.nomCommande}</b> · {snap.lignes.length} lignes · {snap.fichiers.length} fichiers
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Choisir une commande existante
            <select className="g-input" value={snap.activeCommandeId} onChange={(e) => setActiveCommande(e.target.value)} style={{ marginTop: 6 }}>
              {snap.commandes.map((c) => (
                <option key={c.id} value={c.id}>{c.nom} · {c.statut}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Importer des fichiers</h3>
            <p className="g-card-sub">Excel ou CSV (interne Xceed + client Videotron Affaire). La commande se génère comme fichier Excel au nom saisi.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="g-btn" style={{ display: 'inline-flex', cursor: chargement ? 'wait' : 'pointer' }}>
            {chargement ? 'Lecture en cours…' : 'Choisir un fichier Excel ou CSV'}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: 'none' }} disabled={chargement} />
          </label>
          <button type="button" className="g-btn g-btn--ghost" onClick={telechargerCommande} disabled={snap.lignes.length === 0}>
            Télécharger la commande (.xlsx)
          </button>
        </div>
        {message && <p style={{ marginTop: 12, fontSize: 13 }}><b>{message}</b></p>}
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Data importés · {snap.lignes.length} lignes</h3>
            <p className="g-card-sub">Lignes de tous les fichiers importés pour cette commande.</p>
          </div>
        </div>
        {snap.lignes.length === 0 ? (
          <p className="g-empty">Aucune ligne pour cette commande. Importez un fichier pour commencer.</p>
        ) : (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead><tr><th>Feuille</th><th>Ligne Excel</th><th>Compte</th><th>Produit</th><th>Catégorie</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
              <tbody>
                {(apercu.length ? apercu : snap.lignes.slice(0, 20)).map((l) => (
                  <tr key={l.id}>
                    <td>{l.feuille}</td><td>{l.ligneExcel}</td><td>{l.compte || '—'}</td>
                    <td><b>{l.produit}</b> · {l.desc}</td><td>{l.categorie}</td>
                    <td style={{ textAlign: 'right' }}>{l.montantOrigine ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="g-card-foot">
          <span>{snap.fichiers.length} fichiers importés</span>
          <span>Historique conservé à chaque étape</span>
        </div>
      </section>
    </>
  );
}

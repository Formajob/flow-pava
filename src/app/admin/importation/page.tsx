'use client';

/**
 * Importation PAVA (ex-Réception) — création de commande + import Excel/CSV.
 * Chaque commande = une entrée/projet avec historique.
 * « Data importés » affiche un sommaire des lignes importées (pas toutes les lignes).
 */

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getPavaState, subscribePava, addImportedFile, createCommande, setActiveCommande, addHistorique, addVersion, type PavaLigne } from '@/lib/pava-store';
import { detecterFeuille, normaliserLigne } from '@/lib/pava/normalize';

function fmt(n: number) {
  return Number(n || 0).toLocaleString('fr-FR');
}

export default function ImportationPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [nom, setNom] = useState('');
  const [message, setMessage] = useState('');
  const [chargement, setChargement] = useState(false);

  const creer = async () => {
    if (!nom.trim()) {
      setMessage('Le nom de la commande est obligatoire.');
      return;
    }
    setMessage('Création de la commande…');
    const ok = await createCommande(nom, snap.mois);
    if (ok) {
      setMessage(`Commande « ${nom.trim()} » créée. Importez maintenant les fichiers.`);
      setNom('');
    } else {
      setMessage(snap.erreur || 'Création impossible.');
    }
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
            brut: rows[i], // ligne source conservée en base pour traçabilité
          });
        }
      }

      if (nouvelles.length === 0) {
        setMessage('Aucune ligne exploitable trouvée. Vérifiez les feuilles et les colonnes.');
      } else {
        setMessage(`Enregistrement de ${nouvelles.length} lignes dans la base…`);
        const ok = await addImportedFile(
          { id: `f-${Date.now()}`, nom: f.name, date: new Date().toLocaleString('fr-FR'), feuilles, nbLignes: nouvelles.length, mois: snap.mois },
          nouvelles
        );
        if (ok) {
          setMessage(`${nouvelles.length} lignes importées et enregistrées. La commande se génère comme fichier Excel au nom saisi.`);
        } else {
          setMessage(snap.erreur || 'Enregistrement impossible — réessayez.');
        }
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
    // Version tracée dans la base (une version par étape, nommée d'après la commande)
    void addVersion('importation', `${nomFichier}.xlsx`, snap.lignes.length);
  };

  // Sommaire des lignes importées : par type de produit + total général
  const sommaire = (() => {
    const parProduit = new Map<string, { lignes: number; qte: number; montant: number }>();
    for (const l of snap.lignes) {
      const cle = l.produit || l.famille || '—';
      const e = parProduit.get(cle) || { lignes: 0, qte: 0, montant: 0 };
      e.lignes += 1;
      e.qte += l.quantite || 0;
      e.montant += l.montantOrigine ?? 0;
      parProduit.set(cle, e);
    }
    return [...parProduit.entries()].sort((a, b) => b[1].lignes - a[1].lignes);
  })();
  const totalLignes = snap.lignes.length;
  const totalQte = snap.lignes.reduce((s, l) => s + (l.quantite || 0), 0);
  const totalMontant = snap.lignes.reduce((s, l) => s + (l.montantOrigine ?? 0), 0);

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

      {snap.enChargement && (
        <p className="g-lead" style={{ marginTop: -6 }}>Chargement des commandes depuis la base…</p>
      )}
      {snap.erreur && (
        <div className="g-card g-glass" style={{ borderColor: 'var(--g-bad, #dc2626)' }}>
          <p style={{ fontSize: 13 }}><b>Erreur base de données :</b> {snap.erreur}</p>
        </div>
      )}

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Créer une commande de facture</h3>
            <p className="g-card-sub">Chaque commande = une entrée/projet avec historique. Le nom est obligatoire.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ flex: '1 1 320px', fontSize: 12, fontWeight: 700 }}>
            Nom de la commande *
            <input className="g-input" placeholder="Ex : Facture Novembre, facture_test, Vérification Août 2026" value={nom} onChange={(e) => setNom(e.target.value)} style={{ marginTop: 6 }} />
          </label>
          <button type="button" className="g-btn" onClick={creer}>Créer la commande</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 13 }}>
          Commande active :{' '}
          {snap.activeCommandeId ? (
            <><b>{snap.nomCommande}</b> · {snap.lignes.length} lignes · {snap.fichiers.length} fichiers</>
          ) : (
            <b>aucune — créez la première commande de facturation ci-dessus</b>
          )}
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
            <h3 className="g-card-title">Data importés · sommaire</h3>
            <p className="g-card-sub">Sommaire des lignes importées pour cette commande — le détail complet reste dans le fichier téléchargeable.</p>
          </div>
          <span className="g-badge is-info"><i className="g-dot" />{totalLignes} lignes</span>
        </div>
        {snap.fichiers.length > 0 && (
          <div className="g-table-wrap" style={{ marginBottom: 16 }}>
            <table className="g-table">
              <thead><tr><th>Fichier</th><th>Date</th><th>Feuilles</th><th style={{ textAlign: 'right' }}>Lignes</th></tr></thead>
              <tbody>
                {snap.fichiers.map((f) => (
                  <tr key={f.id}>
                    <td><b>{f.nom}</b></td>
                    <td>{f.date}</td>
                    <td style={{ maxWidth: 320 }}>{f.feuilles.join(' · ')}</td>
                    <td style={{ textAlign: 'right' }}>{f.nbLignes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalLignes === 0 ? (
          <p className="g-empty">Aucune ligne pour cette commande. Importez un fichier pour commencer.</p>
        ) : (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead><tr><th>Type de produit</th><th style={{ textAlign: 'right' }}>Lignes</th><th style={{ textAlign: 'right' }}>Quantité</th><th style={{ textAlign: 'right' }}>Montant importé</th></tr></thead>
              <tbody>
                {sommaire.map(([p, v]) => (
                  <tr key={p}>
                    <td><b>{p}</b></td>
                    <td style={{ textAlign: 'right' }}>{v.lignes}</td>
                    <td style={{ textAlign: 'right' }}>{v.qte}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(v.montant)} $</td>
                  </tr>
                ))}
                <tr>
                  <td><b>Total</b></td>
                  <td style={{ textAlign: 'right' }}><b>{totalLignes}</b></td>
                  <td style={{ textAlign: 'right' }}><b>{totalQte}</b></td>
                  <td style={{ textAlign: 'right' }}><b>{fmt(totalMontant)} $</b></td>
                </tr>
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

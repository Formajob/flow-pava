'use client';

/**
 * Importation PAVA (ex-Réception) — création de commande + import Excel/CSV.
 * Chaque commande = une entrée/projet avec historique.
 * « Data importés » affiche un sommaire des lignes importées (pas toutes les lignes).
 */

import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getPavaState, subscribePava, addImportedFile, createCommande, setActiveCommande, addHistorique, addVersion, changerMoisCommande, type PavaLigne } from '@/lib/pava-store';
import { detecterFeuille, normaliserLigne, ligneDepuisRow, type FeuilleDetectee } from '@/lib/pava/normalize';
import { montantAttendu } from '@/lib/pava/price-plan';

function fmt(n: number) {
  return Number(n || 0).toLocaleString('fr-FR');
}

interface FeuillePrete {
  nom: string;
  detectee: FeuilleDetectee;
  rows: Record<string, unknown>[];
  coche: boolean;
}

export default function ImportationPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [nom, setNom] = useState('');
  // Mois de la facture créée : essentiel pour importer les mois précédents
  // (chaque commande porte son mois → suivi de l'évolution mensuelle).
  const [moisChoisi, setMoisChoisi] = useState(snap.mois || new Date().toISOString().slice(0, 7));
  const [moisFix, setMoisFix] = useState(snap.mois || '');
  const [message, setMessage] = useState('');
  const [chargement, setChargement] = useState(false);
  const [pending, setPending] = useState<{ nomFichier: string; feuilles: FeuillePrete[] } | null>(null);

  const creer = async () => {
    if (!nom.trim()) {
      setMessage('Le nom de la commande est obligatoire.');
      return;
    }
    setMessage('Création de la commande…');
    const ok = await createCommande(nom, moisChoisi);
    if (ok) {
      setMessage(`Commande « ${nom.trim()} » créée pour ${moisChoisi}. Importez maintenant les fichiers Excel/CSV du mois.`);
      setNom('');
    } else {
      setMessage(snap.erreur || 'Création impossible.');
    }
  };

  /** Corriger la période de la commande active : re-timbre aussi toutes ses
   * lignes importées (utile quand un fichier d'octobre a été importé en novembre,
   * par ex.). Vide = sans période (fichier hors facture mensuelle). */
  const corrigerMois = async () => {
    setMessage('Correction de la période…');
    const ok = await changerMoisCommande(moisFix.trim());
    setMessage(ok ? `Période de la commande corrigée → ${moisFix.trim() || 'sans période'}. Les exports Excel/PDF utilisent maintenant cette période.` : snap.erreur || 'Correction impossible.');
  };

  /** Étape 1 — analyser le fichier : feuilles détectées, à confirmer. */
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setChargement(true);
    setMessage('');
    setPending(null);
    try {
      const XLSX = await import('xlsx');
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const feuilles: FeuillePrete[] = [];
      for (const nomFeuille of wb.SheetNames) {
        const ws = wb.Sheets[nomFeuille];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        if (rows.length === 0) continue;
        const colonnes = Object.keys(rows[0]);
        const detectee = detecterFeuille(nomFeuille, colonnes);
        // Feuilles de référence (Price Plan, synthèse, COM, inconnues) : jamais
        // des lignes facturables → décochées et verrouillées à l'import.
        const coche = !detectee.ignorer;
        feuilles.push({ nom: nomFeuille, detectee, rows, coche });
      }
      if (feuilles.length === 0) {
        setMessage('Aucune feuille exploitable trouvée dans ce fichier.');
      } else {
        setPending({ nomFichier: f.name, feuilles });
      }
    } catch {
      setMessage('Impossible de lire ce fichier. Vérifiez le format (.xlsx, .xls, .csv).');
    } finally {
      setChargement(false);
      e.target.value = '';
    }
  };

  /** Étape 2 — importer les feuilles cochées après confirmation.
   * Les feuilles de référence (Price Plan, FAC PAVA/synthèse, COM) sont ignorées :
   * elles ne sont jamais des lignes facturables (sinon double comptage). */
  const importer = async () => {
    if (!pending) return;
    const nouvelles: PavaLigne[] = [];
    const feuilles: string[] = [];
    const ignorees: string[] = [];
    let compteur = snap.lignes.length + 1;

    for (const f of pending.feuilles) {
      if (f.detectee.ignorer) {
        ignorees.push(f.nom);
        continue;
      }
      if (!f.coche) continue;
      feuilles.push(`${f.nom} (${f.detectee.format}/${f.detectee.nature})`);
      for (let i = 0; i < f.rows.length; i++) {
        const norm = normaliserLigne(f.rows[i], f.detectee, i + 2, snap.mois);
        if (norm.ligne_total) continue;
        const id = `${snap.mois}-IMP-${String(compteur++).padStart(4, '0')}`;
        norm.ligne_id = id;
        // Déménagement : si la raison officielle est vide mais que la ligne
        // source mentionne un déménagement → alimente R09 (la ligne brute
        // n'est plus envoyée au serveur, on capture l'info ici).
        if (!norm.raison && Object.values(f.rows[i]).some((v) => /DEMENAG/i.test(String(v)))) {
          norm.raison = 'DEMENAGEMENT';
        }
        // montantCalcule = prix attendu du price plan (sinon le montant facturé) → totaux du tableau de bord.
        // PAS de `brut` dans l'envoi : 3 579 lignes + brut ≈ 5,3 Mo > limite 4,5 Mo
        // de Vercel (erreur 413). Sans brut ≈ 2 Mo, et le brut n'est jamais relu.
        const calcule = montantAttendu(norm, snap.params) ?? norm.paiement_pav ?? undefined;
        nouvelles.push(ligneDepuisRow(norm, id, calcule));
      }
    }
    if (nouvelles.length === 0) {
      setMessage('Aucune ligne exploitable dans les feuilles cochées.');
      return;
    }
    setChargement(true);
    setMessage(`Enregistrement de ${nouvelles.length} lignes dans la base…`);
    const ok = await addImportedFile(
      { id: `f-${Date.now()}`, nom: pending.nomFichier, date: new Date().toLocaleString('fr-FR'), feuilles, nbLignes: nouvelles.length, mois: snap.mois },
      nouvelles
    );
    setChargement(false);
    setPending(null);
    if (ok) {
      setMessage(`${nouvelles.length} lignes importées et enregistrées.${ignorees.length ? ` Feuilles de référence ignorées : ${ignorees.join(', ')}.` : ''} Passez à l’Analyse.`);
    } else {
      setMessage(snap.erreur || 'Enregistrement impossible — réessayez.');
    }
  };

  const telechargerCommande = async () => {
    if (snap.lignes.length === 0) {
      setMessage('Aucune ligne à télécharger pour l’instant : choisissez un fichier Excel ou CSV ci-dessous, confirmez l’import, puis revenez cliquer ici.');
      return;
    }
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
          <p className="g-lead">Créez une commande, importez les fichiers, puis passez à l&apos;Analyse.</p>
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
          <label style={{ flex: '1 1 260px', fontSize: 12, fontWeight: 700 }}>
            Nom de la commande *
            <input className="g-input" placeholder="Ex : Facture Décembre v1, Production semaine 50 équipe 3, Vérification Mars 2026…" value={nom} onChange={(e) => setNom(e.target.value)} style={{ marginTop: 6 }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Mois / période
            <input
              className="g-input"
              type="month"
              value={moisChoisi}
              onChange={(e) => setMoisChoisi(e.target.value)}
              style={{ marginTop: 6 }}
              title="Laissez vide pour un fichier sans période mensuelle (ex. suivi de performance de production)"
            />
          </label>
          <button type="button" className="g-btn" onClick={creer}>Créer la commande</button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--g-muted, #64748b)' }}>
          Le nom est libre et représentatif du contenu : « Facture Décembre version 1 », « Production semaine 50 — équipe 3 »,
          « Vérification facture Mars 2026 »… Pour les factures mensuelles, indiquez le mois (ex. 2026-09) : le tableau de bord
          suivra l&apos;évolution mensuelle des montants par famille. Hors facture mensuelle, laissez le mois vide.
        </p>
        <div style={{ marginTop: 12, fontSize: 13 }}>
          Commande active :{' '}
          {snap.activeCommandeId ? (
            <><b>{snap.nomCommande}</b> · {snap.lignes.length} lignes · {snap.fichiers.length} fichiers</>
          ) : (
            <b>aucune — créez la première commande ci-dessus</b>
          )}
        </div>
        {snap.activeCommandeId && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
            <span style={{ color: 'var(--g-muted, #64748b)' }}>Période actuelle :</span>
            <b>{snap.mois || 'sans période'}</b>
            <input
              className="g-input"
              type="month"
              value={moisFix}
              onChange={(e) => setMoisFix(e.target.value)}
              style={{ maxWidth: 150, minHeight: 30 }}
              title="Corriger le mois réel des données (re-timbre toutes les lignes importées)"
            />
            <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => void corrigerMois()}>
              Corriger la période
            </button>
            <span style={{ color: 'var(--g-muted, #64748b)', fontSize: 11.5 }}>
              (si un fichier d&apos;octobre a été importé en novembre, remettez ici le mois réel des données)
            </span>
          </div>
        )}
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
            <p className="g-card-sub">Excel ou CSV (interne Xceed + client PAV Affaire).</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="g-btn" style={{ display: 'inline-flex', cursor: chargement ? 'wait' : 'pointer' }}>
            {chargement ? 'Lecture en cours…' : 'Choisir un fichier Excel ou CSV'}
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ display: 'none' }} disabled={chargement} />
          </label>
          <button type="button" className="g-btn g-btn--ghost" onClick={telechargerCommande}>
            Télécharger la commande (.xlsx){totalLignes > 0 ? ` — ${totalLignes.toLocaleString('fr-FR')} lignes` : ''}
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--g-muted, #64748b)' }}>
          Génère le fichier Excel de la commande active (toutes ses lignes importées). Sans ligne importée, un simple message vous le dira — le bouton n&apos;est plus jamais grisé.
        </p>
        {pending && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--g-line, #e4e8f1)' }}>
            <p style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 700 }}>
              Confirmer l&apos;import de « {pending.nomFichier} » — décochez les feuilles à ignorer :
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {pending.feuilles.map((f, i) => (
                <label key={f.nom} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, padding: '8px 10px', borderRadius: 10, background: f.coche ? 'rgba(37,99,235,.05)' : 'transparent', border: '1px solid var(--g-line, #e4e8f1)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={f.coche}
                    disabled={Boolean(f.detectee.ignorer)}
                    onChange={(e) => {
                      const feuilles = pending.feuilles.map((x, j) => (j === i ? { ...x, coche: e.target.checked } : x));
                      setPending({ ...pending, feuilles });
                    }}
                  />
                  <span style={{ flex: 1 }}>
                    <b>{f.nom}</b> · {f.detectee.ignorer ? 'référence (non importée)' : f.detectee.nature} · {f.rows.length.toLocaleString('fr-FR')} ligne(s)
                    {f.detectee.avertissement && (
                      <span style={{ color: 'var(--g-warn, #b45309)' }}> — {f.detectee.avertissement}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" className="g-btn" disabled={chargement} onClick={() => void importer()}>
                {chargement ? 'Enregistrement…' : `Importer (${pending.feuilles.filter((f) => f.coche && !f.detectee.ignorer).reduce((s2, f) => s2 + f.rows.length, 0).toLocaleString('fr-FR')} lignes)`}
              </button>
              <button type="button" className="g-btn g-btn--ghost" disabled={chargement} onClick={() => setPending(null)}>Annuler</button>
            </div>
          </div>
        )}
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

'use client';

/**
 * Factures PAVA — résumé du mois + export Excel/PDF.
 * Septembre validée, octobre en cours. Boutons actifs pour tester les exports.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import { getPavaState, subscribePava } from '@/lib/pava-store';
import { runEngine, depuisDemo } from '@/lib/pava/engine';

const MOIS = [
  { id: '2026-09', label: 'Septembre 2026' },
  { id: '2026-10', label: 'Octobre 2026' },
];

export default function FacturesPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [mois, setMois] = useState('2026-09');

  const lignesNorm = useMemo(
    () => depuisDemo(snap.lignes.filter((l) => l.mois === mois) as unknown as Array<Record<string, unknown>>, mois),
    [snap.lignes, mois]
  );
  const resultat = useMemo(() => runEngine(lignesNorm, snap.params), [lignesNorm, snap.params]);
  const statut = snap.statutFacture[mois] || 'en_cours';
  const validee = statut === 'validee' || statut === 'valide_admin';

  const exporterExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const rows = resultat.lignes.map((l) => ({
      Période: l.periode, Feuille: l.feuille, 'Ligne Excel': l.ligne_excel,
      NO_CLI: l.no_cli, Nature: l.nature, Famille: l.famille, Code: l.code_service,
      Qty: l.qty, Payé: l.paiement_pav, Attendu: l.montant_attendu, Écart: l.ecart,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Facture');
    XLSX.writeFile(wb, `facture-pava-${mois}.xlsx`);
  };

  const exporterPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Facture PAVA — ${mois}`, 14, 18);
    doc.setFontSize(11);
    doc.text(`Total : ${resultat.totalRecalcule.toLocaleString('fr-FR')} $ · ${resultat.lignes.length} lignes · Statut : ${statut}`, 14, 26);
    autoTable(doc, {
      startY: 32,
      head: [['Feuille', 'Ligne', 'Compte', 'Produit', 'Catégorie', 'Montant']],
      body: resultat.lignes.slice(0, 100).map((l) => [
        l.feuille, String(l.ligne_excel), l.no_cli || '—', `${l.famille} ${l.code_service}`, l.nature, String(l.montant_attendu ?? l.paiement_pav ?? ''),
      ]),
    });
    doc.save(`facture-pava-${mois}.pdf`);
  };

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Factures</h1>
          <p className="g-lead">Résumé de la facture du mois choisi et téléchargement des rapports.</p>
        </div>
        <div className="g-tools">
          <select className="g-chip" aria-label="Mois" value={mois} onChange={(e) => setMois(e.target.value)}>
            {MOIS.map((m) => (
              <option key={m.id} value={m.id}>{m.label} · {snap.statutFacture[m.id] === 'validee' ? 'Validée' : 'En cours'}</option>
            ))}
          </select>
        </div>
      </header>

      <section className="g-hero g-glass g-rise">
        <div>
          <div className="g-kicker"><i /> {validee ? 'Facture validée' : 'Facture en cours'}</div>
          <h2>{MOIS.find((m) => m.id === mois)?.label} · <em>{resultat.totalRecalcule.toLocaleString('fr-FR')} $</em></h2>
          <p>{resultat.lignes.length} lignes · {validee ? 'Prête à télécharger' : 'Validation en cours (Admin puis Directeur)'}.</p>
          <div className="g-hero-actions">
            <button type="button" className="g-btn" onClick={exporterExcel}>
              Télécharger Excel
            </button>
            <button type="button" className="g-btn g-btn--ghost" onClick={exporterPdf}>
              Télécharger PDF
            </button>
          </div>
        </div>
        <div className="g-hero-side">
          <b className="g-num">{resultat.lignes.length}</b>
          <span>lignes</span>
          <small>{statut}</small>
        </div>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Détail du mois</h3>
            <p className="g-card-sub">Le détail complet est dans les rapports Excel/PDF.</p>
          </div>
          <span className={`g-badge ${validee ? 'is-ok' : 'is-warn'}`}><i className="g-dot" />{validee ? 'Validée' : 'En cours'}</span>
        </div>
        <div className="g-card-foot">
          <span>{resultat.lignes.length} lignes · {resultat.totalRecalcule.toLocaleString('fr-FR')} $</span>
          <span>Testez les boutons Excel et PDF ci-dessus</span>
        </div>
      </section>
    </>
  );
}

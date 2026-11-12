'use client';

/**
 * Factures PAVA — résumé du mois + export Excel/PDF pro.
 * PDF : en-tête + logo Flow, tableaux synthèse (par famille + sommaire),
 * graphes, détail des lignes.
 * Excel : Synthèse, Price Plan, Détails, Anomalies, Lignes recalculées.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import { getPavaState, subscribePava, REF } from '@/lib/pava-store';
import { runEngine, depuisDemo } from '@/lib/pava/engine';

const MOIS = [
  { id: '2026-09', label: 'Septembre 2026' },
  { id: '2026-10', label: 'Octobre 2026' },
];

const COULEURS: Record<string, string> = {
  CAB: '#2563eb', CELL: '#0891b2', NUM: '#7c3aed', REDO: '#0ea5e9',
  TIPN: '#06b6d4', TPC: '#8b5cf6', WIFIPRO: '#22d3ee',
};

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

  // Synthèse par famille (comme la capture Excel)
  const parFamille = useMemo(() => {
    const map = new Map<string, { qte: number; montant: number }>();
    for (const l of resultat.lignes) {
      const e = map.get(l.famille) || { qte: 0, montant: 0 };
      e.qte += l.qty || 1;
      e.montant += l.montant_attendu ?? l.paiement_pav ?? 0;
      map.set(l.famille, e);
    }
    return [...map.entries()].sort((a, b) => b[1].montant - a[1].montant);
  }, [resultat.lignes]);

  const parNature = useMemo(() => {
    const map = new Map<string, { qte: number; montant: number }>();
    for (const l of resultat.lignes) {
      const cle = l.nature === 'RENO' ? 'Renouvellement' : l.nature === 'SACA' ? 'Source SACA' : l.nature === 'NON_FACTUREE' ? 'CMD non facturée par VL' : 'AJOUT';
      const e = map.get(cle) || { qte: 0, montant: 0 };
      e.qte += l.qty || 1;
      e.montant += l.montant_attendu ?? l.paiement_pav ?? 0;
      map.set(cle, e);
    }
    return [...map.entries()];
  }, [resultat.lignes]);

  const exporterExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // 1. Synthèse (tableaux comme la capture)
    const synthese: unknown[][] = [
      ['Étiquettes de lignes', 'Somme de QT_SERV_COM_COMPL', 'Somme de PAIEMENT_PAV'],
      ...parFamille.map(([f, v]) => [f, v.qte, v.montant]),
      ['Total général', parFamille.reduce((s, [, v]) => s + v.qte, 0), parFamille.reduce((s, [, v]) => s + v.montant, 0)],
      [],
      ['SOMMAIRE', 'QUANTITÉ', 'PRICE ($)'],
      ...parNature.map(([n, v]) => [n, v.qte, v.montant]),
      ['TOTAL', parNature.reduce((s, [, v]) => s + v.qte, 0), parNature.reduce((s, [, v]) => s + v.montant, 0)],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(synthese), 'Synthèse');

    // 2. Price Plan
    const p = snap.params;
    const pricePlan = [
      ['Produit', 'Prix ($)'],
      ['Internet 15 Mb', p.internet['15']], ['Internet 100 Mb', p.internet['100']],
      ['Internet 200 Mb', p.internet['200']], ['Internet 400 Mb', p.internet['400']],
      ['Internet 500 Mb (exception)', p.internet['500']], ['Internet Giga', p.internet['Giga']],
      ['TPC 60 mois', p.tpc['60']], ['TPC 36 mois', p.tpc['36']], ['TPC sans / 12 / 24 mois', p.tpc['sans']],
      ['SIM / TMO', p.sim], ['TV (NUM)', p.tv], ['TIPN', p.tipn],
      ['WIFIPRO', p.wifipro], ['Redondance', p.redo], ['Renouvellement', p.renouvellement],
      ['Forfait 50/50 (à confirmer)', p.forfait5050],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pricePlan), 'Price Plan');

    // 3. Détails
    const details = resultat.lignes.map((l) => ({
      Période: l.periode, Feuille: l.feuille, 'Ligne Excel': l.ligne_excel,
      NO_CLI: l.no_cli, Nature: l.nature, Famille: l.famille, Code: l.code_service,
      Qty: l.qty, Payé: l.paiement_pav, Attendu: l.montant_attendu, Écart: l.ecart,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(details), 'Détails');

    // 4. Anomalies
    const anomalies = resultat.anomalies.map((a) => ({
      Réf: a.id, Règle: a.regle, Feuille: a.feuille, 'Ligne Excel': a.ligne_excel,
      NO_CLI: a.no_cli, Raison: a.raison, Explication: a.explication, Solution: a.solution,
      'Impact $': a.impact, Confiance: a.confiance, Statut: a.statut,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(anomalies), 'Anomalies');

    // 5. Référence (sommaire officiel)
    const ref = REF[mois];
    if (ref) {
      const refRows = [
        ['Catégorie', 'Quantité', 'Montant ($)'],
        ['AJOUT', ref.ajout.n, ref.ajout.m],
        ['Renouvellement', ref.renouvellement.n, ref.renouvellement.m],
        ['Source SACA', ref.saca.n, ref.saca.m],
        ['CMD non facturée par VL', ref.nonFacturee.n, ref.nonFacturee.m],
        ['TOTAL', ref.total.n, ref.total.m],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(refRows), 'Référence');
    }

    XLSX.writeFile(wb, `facture-pava-${mois}.xlsx`);
  };

  const exporterPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();

    // En-tête + logo Flow
    try {
      const res = await fetch('/acx-flow-logo-transparent.png');
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
      });
      doc.addImage(base64, 'PNG', 14, 8, 55, 8.3);
    } catch { /* logo optionnel */ }
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text('By ACX Maroc', 14, 20);
    doc.setFontSize(16);
    doc.setTextColor(11, 19, 48);
    doc.text(`Facture PAVA — ${MOIS.find((m) => m.id === mois)?.label}`, 14, 30);
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Videotron PAV Affaire · Total : ${resultat.totalRecalcule.toLocaleString('fr-FR')} $ · ${resultat.lignes.length} lignes · Statut : ${statut}`, 14, 37);
    doc.text(`Générée le ${new Date().toLocaleDateString('fr-FR')} · ACX Flow`, 14, 43);

    // Tableau par famille
    doc.setFontSize(12);
    doc.setTextColor(11, 19, 48);
    doc.text('Synthèse par famille', 14, 52);
    autoTable(doc, {
      startY: 55,
      head: [['Famille', 'Quantité', 'Montant ($)']],
      body: [
        ...parFamille.map(([f, v]) => [f, String(v.qte), v.montant.toLocaleString('fr-FR')]),
        ['Total général', String(parFamille.reduce((s, [, v]) => s + v.qte, 0)), parFamille.reduce((s, [, v]) => s + v.montant, 0).toLocaleString('fr-FR')],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [11, 19, 48] },
    });

    // Tableau sommaire
    const y1 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 90;
    doc.setFontSize(12);
    doc.text('Sommaire', 14, y1 + 10);
    autoTable(doc, {
      startY: y1 + 13,
      head: [['Catégorie', 'Quantité', 'Prix ($)']],
      body: [
        ...parNature.map(([n, v]) => [n, String(v.qte), v.montant.toLocaleString('fr-FR')]),
        ['TOTAL', String(parNature.reduce((s, [, v]) => s + v.qte, 0)), parNature.reduce((s, [, v]) => s + v.montant, 0).toLocaleString('fr-FR')],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [11, 19, 48] },
    });

    // Graphes : barres par famille
    const y2 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 130;
    if (y2 > 250) doc.addPage();
    const gy = y2 > 250 ? 20 : y2 + 12;
    doc.setFontSize(12);
    doc.text('Montants par famille', 14, gy);
    const max = Math.max(1, ...parFamille.map(([, v]) => v.montant));
    parFamille.forEach(([f, v], i) => {
      const y = gy + 8 + i * 9;
      doc.setFontSize(8);
      doc.setTextColor(60);
      doc.text(f, 14, y + 3);
      const w = (v.montant / max) * 110;
      doc.setFillColor(37, 99, 235);
      doc.rect(32, y, w, 5, 'F');
      doc.setTextColor(11, 19, 48);
      doc.text(`${v.montant.toLocaleString('fr-FR')} $`, 34 + w, y + 3);
    });

    // Détail des lignes (page suivante)
    doc.addPage();
    doc.setFontSize(12);
    doc.setTextColor(11, 19, 48);
    doc.text('Détail des lignes', 14, 16);
    autoTable(doc, {
      startY: 20,
      head: [['Feuille', 'Ligne', 'Compte', 'Produit', 'Catégorie', 'Montant']],
      body: resultat.lignes.slice(0, 200).map((l) => [
        l.feuille, String(l.ligne_excel), l.no_cli || '—', `${l.famille} ${l.code_service}`, l.nature, String(l.montant_attendu ?? l.paiement_pav ?? ''),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [11, 19, 48] },
    });

    doc.save(`facture-pava-${mois}.pdf`);
  };

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Factures</h1>
          <p className="g-lead">Résumé de la facture du mois choisi et téléchargement des rapports pro.</p>
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
          <p>{resultat.lignes.length} lignes · PDF pro avec en-tête, logo Flow, tableaux et graphes · Excel avec Synthèse, Price Plan, Détails, Anomalies.</p>
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
            <h3 className="g-card-title">Synthèse du mois</h3>
            <p className="g-card-sub">Mêmes tableaux que le PDF/Excel : par famille et sommaire.</p>
          </div>
          <span className={`g-badge ${validee ? 'is-ok' : 'is-warn'}`}><i className="g-dot" />{validee ? 'Validée' : 'En cours'}</span>
        </div>
        <div className="g-grid-2">
          <div className="g-table-wrap">
            <table className="g-table">
              <thead><tr><th>Famille</th><th>Quantité</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
              <tbody>
                {parFamille.map(([f, v]) => (
                  <tr key={f}><td><b>{f}</b></td><td>{v.qte}</td><td style={{ textAlign: 'right' }}>{v.montant.toLocaleString('fr-FR')} $</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead><tr><th>Sommaire</th><th>Quantité</th><th style={{ textAlign: 'right' }}>Prix</th></tr></thead>
              <tbody>
                {parNature.map(([n, v]) => (
                  <tr key={n}><td><b>{n}</b></td><td>{v.qte}</td><td style={{ textAlign: 'right' }}>{v.montant.toLocaleString('fr-FR')} $</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="g-card-foot">
          <span>{resultat.lignes.length} lignes · {resultat.totalRecalcule.toLocaleString('fr-FR')} $</span>
          <span>Testez les boutons Excel et PDF ci-dessus</span>
        </div>
      </section>
    </>
  );
}

'use client';

/**
 * Factures PAVA — résumé du mois + export Excel/PDF pro.
 * PDF : en-tête + logo Flow, tableaux synthèse (par famille + sommaire),
 * graphes, détail des lignes.
 * Excel : Synthèse, Price Plan, Détails, Anomalies, Lignes recalculées.
 */

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import CarteChargement from '@/components/pava/CarteChargement';

import { getPavaState, subscribePava, REF, setActiveCommande, deleteCommande, addVersion } from '@/lib/pava-store';
import { runEngine, depuisDemo, historiqueVersRows } from '@/lib/pava/engine';

const MOIS_DEMO = [
  { id: '2026-09', label: 'Septembre 2026' },
  { id: '2026-10', label: 'Octobre 2026' },
];

const MOIS_C = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function libelleMois(id: string) {
  const [a, m] = id.split('-');
  const idx = Number(m) - 1;
  return MOIS_C[idx] ? `${MOIS_C[idx]} ${a}` : id;
}

const COULEURS: Record<string, string> = {
  CAB: '#2563eb', CELL: '#0891b2', NUM: '#7c3aed', REDO: '#0ea5e9',
  TIPN: '#06b6d4', TPC: '#8b5cf6', WIFIPRO: '#22d3ee',
};

/** Format nombre avec espace simple (évite le "/" de certains rendus). */
function fmt(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function FacturesPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  // Mois proposés : ceux des commandes (DB) + les mois démo si vide
  const MOIS = (() => {
    const ids = [...new Set(snap.commandes.map((c) => c.mois).filter(Boolean))] as string[];
    if (ids.length > 0) {
      return ids.sort().reverse().map((id) => ({ id, label: libelleMois(id) }));
    }
    return MOIS_DEMO;
  })();
  const moisDefaut = snap.commandes.find((c) => c.id === snap.activeCommandeId)?.mois || MOIS[0]?.id || '';
  const [moisChoisi, setMoisChoisi] = useState('');
  const mois = moisChoisi || moisDefaut;

  const lignesNorm = useMemo(
    () => depuisDemo(snap.lignes.filter((l) => l.mois === mois) as unknown as Array<Record<string, unknown>>, mois),
    [snap.lignes, mois]
  );
  // Références de rapprochement (COM, synthèse, renouvellements des autres commandes)
  // chargées avec les lignes — alimentent R03/R08/R12.
  const refsMoteur = useMemo(
    () => ({
      com: depuisDemo(snap.com as unknown as Array<Record<string, unknown>>, snap.mois),
      synthese: snap.synthese || undefined,
      historique: historiqueVersRows(snap.renouvellements),
    }),
    [snap.com, snap.synthese, snap.renouvellements, snap.mois]
  );
  const resultat = useMemo(() => runEngine(lignesNorm, snap.params, refsMoteur), [lignesNorm, snap.params, refsMoteur]);
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

    const nomFichier = (snap.nomCommande || `facture-pava-${mois}`).replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `${nomFichier}.xlsx`);
    void addVersion('factures', `${nomFichier}.xlsx`, resultat.lignes.length, resultat.totalRecalcule);
  };

  const exporterPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();

    const moisLabel = MOIS.find((m) => m.id === mois)?.label || mois;
    const noFacture = `PAVA-${mois}`;
    const statutLabel = statut === 'validee' ? 'VALIDÉE' : statut === 'valide_admin' ? 'VALIDÉE ADMIN' : 'EN COURS';
    const statutCoul: [number, number, number] = statut === 'validee' ? [22, 163, 74] : statut === 'valide_admin' ? [8, 145, 178] : [217, 119, 6];
    const qteTotale = parFamille.reduce((s2, [, v]) => s2 + v.qte, 0);
    const totalFamilles = parFamille.reduce((s2, [, v]) => s2 + v.montant, 0);
    const ecart = resultat.totalRecalcule - resultat.totalFacture;

    // ════════ PAGE 1 — EN-TÊTE FACTURE ════════
    doc.setFillColor(11, 19, 48);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setFillColor(38, 212, 234);
    doc.rect(0, 28, 210, 1.2, 'F');
    try {
      const res = await fetch('/acx-flow-logo-light.png');
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(blob);
      });
      doc.addImage(base64, 'PNG', 14, 7, 52, 7.9);
    } catch { /* logo optionnel */ }
    doc.setFontSize(8);
    doc.setTextColor(195, 206, 228);
    doc.text('By ACX Maroc', 14, 20);
    doc.setFontSize(19);
    doc.setTextColor(11, 19, 48);
    doc.text(`Facture PAVA — ${moisLabel}`, 14, 40);
    doc.setFontSize(10.5);
    doc.setTextColor(84, 101, 138);
    doc.text(snap.nomCommande || 'Commande de facturation', 14, 46.5);

    // Bloc méta à droite : n° facture, date, statut (pastille)
    doc.setDrawColor(219, 227, 243);
    doc.setFillColor(246, 248, 253);
    doc.roundedRect(134, 33, 62, 22, 2.2, 2.2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(132, 148, 184);
    doc.text('N° DE FACTURE', 139, 38.5);
    doc.text('DATE D\u2019ÉMISSION', 139, 45);
    doc.setFontSize(10.5);
    doc.setTextColor(11, 19, 48);
    doc.text(noFacture, 139, 42.3);
    doc.text(new Date().toLocaleDateString('fr-FR'), 139, 48.8);
    doc.setFillColor(statutCoul[0], statutCoul[1], statutCoul[2]);
    doc.roundedRect(170.5, 35.6, 22, 6.4, 3.2, 3.2, 'F');
    doc.setFontSize(7.4);
    doc.setTextColor(255, 255, 255);
    doc.text(statutLabel, 181.5, 39.9, { align: 'center' });

    // Émetteur / destinataire
    doc.setFontSize(8);
    doc.setTextColor(132, 148, 184);
    doc.text('ÉMETTEUR', 14, 57);
    doc.text('DESTINATAIRE', 110, 57);
    doc.setFontSize(9.5);
    doc.setTextColor(35, 45, 75);
    doc.text(doc.splitTextToSize('ACX Maroc — préparé via ACX Flow · Espace VL PAVA', 85), 14, 61.5);
    doc.text(doc.splitTextToSize('Videotron PAV Affaire — renouvellements et branchements', 85), 110, 61.5);

    // Rangée de KPI
    const kpis: Array<[string, string, string]> = [
      ['TOTAL RECALCULÉ', `${fmt(resultat.totalRecalcule)} $`, `${resultat.lignes.length} lignes`],
      ['TOTAL FACTURÉ (SOURCE)', `${fmt(resultat.totalFacture)} $`, 'montant du fichier importé'],
      ['ÉCART', `${ecart >= 0 ? '+' : ''}${fmt(ecart)} $`, Math.abs(ecart) < 0.5 ? 'conforme' : 'après corrections'],
      ['QUANTITÉS', fmt(qteTotale), `${parFamille.length} familles de produits`],
    ];
    kpis.forEach((k, i) => {
      const x = 14 + i * 45.75;
      doc.setDrawColor(219, 227, 243);
      doc.setFillColor(249, 250, 254);
      doc.roundedRect(x, 70, 43.5, 19, 2.2, 2.2, 'FD');
      doc.setFontSize(7);
      doc.setTextColor(132, 148, 184);
      doc.text(k[0], x + 3, 75.5);
      doc.setFontSize(11.5);
      doc.setTextColor(11, 19, 48);
      doc.text(k[1], x + 3, 81.5);
      doc.setFontSize(7);
      doc.setTextColor(132, 148, 184);
      doc.text(doc.splitTextToSize(k[2], 38), x + 3, 86);
    });

    // Sommaire par famille (avec % du total)
    doc.setFontSize(12);
    doc.setTextColor(11, 19, 48);
    doc.text('Sommaire — par famille de produits', 14, 98);
    autoTable(doc, {
      startY: 101,
      head: [['Famille', 'Quantité', 'Montant ($)', '% du total']],
      body: parFamille.map(([f, v]) => [
        f,
        String(v.qte),
        fmt(v.montant),
        `${totalFamilles ? ((v.montant / totalFamilles) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : 0} %`,
      ]),
      foot: [['Total général', String(qteTotale), fmt(totalFamilles), '100 %']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [11, 19, 48], textColor: [255, 255, 255] },
      footStyles: { fillColor: [238, 242, 251], textColor: [11, 19, 48], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 248, 253] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });

    const y1 = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 130;
    // Sommaire par nature (si la place reste, sinon page suivante)
    let yNature = y1 + 12;
    if (yNature > 235) { doc.addPage(); yNature = 20; }
    doc.setFontSize(12);
    doc.setTextColor(11, 19, 48);
    doc.text('Sommaire — par nature', 14, yNature);
    const totalNature = parNature.reduce((s2, [, v]) => s2 + v.montant, 0);
    autoTable(doc, {
      startY: yNature + 3,
      head: [['Nature', 'Quantité', 'Montant ($)', '% du total']],
      body: parNature.map(([n, v]) => [
        n,
        String(v.qte),
        fmt(v.montant),
        `${totalNature ? ((v.montant / totalNature) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : 0} %`,
      ]),
      foot: [['TOTAL', String(parNature.reduce((s2, [, v]) => s2 + v.qte, 0)), fmt(totalNature), '100 %']],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [11, 19, 48], textColor: [255, 255, 255] },
      footStyles: { fillColor: [238, 242, 251], textColor: [11, 19, 48], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 248, 253] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });

    // ════════ PAGE 2 — ANALYSES ════════
    doc.addPage();
    doc.setFontSize(12);
    doc.setTextColor(11, 19, 48);
    doc.text('Montants par famille', 14, 18);
    const max = Math.max(1, ...parFamille.map(([, v]) => v.montant));
    const rgb: Record<string, [number, number, number]> = {
      CAB: [37, 99, 235], CELL: [8, 145, 178], NUM: [124, 58, 237], REDO: [14, 165, 233],
      TIPN: [6, 182, 212], TPC: [139, 92, 246], WIFIPRO: [34, 211, 238],
    };
    parFamille.forEach(([f, v], i) => {
      const y = 26 + i * 10;
      doc.setFontSize(8.5);
      doc.setTextColor(84, 101, 138);
      doc.text(f, 14, y + 4);
      const w = (v.montant / max) * 105;
      const c = rgb[f] || [37, 99, 235];
      doc.setFillColor(219, 227, 243);
      doc.rect(34, y, 105, 5.5, 'F');
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(34, y, w, 5.5, 'F');
      doc.setTextColor(11, 19, 48);
      doc.text(`${fmt(v.montant)} $ (${totalFamilles ? ((v.montant / totalFamilles) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : 0} %)`, 34 + w + 3, y + 4);
    });

    // Évolution mensuelle (dès que 2 mois de factures sont importés)
    const parMoisPdf = (() => {
      const m = new Map<string, number>();
      for (const c of snap.commandes) {
        if (!c.mois) continue;
        m.set(c.mois, (m.get(c.mois) || 0) + (c.stats?.totalCalcule || 0));
      }
      return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    })();
    const yEvol = 26 + parFamille.length * 10 + 12;
    doc.setFontSize(12);
    doc.setTextColor(11, 19, 48);
    doc.text('Évolution des montants facturés', 14, yEvol);
    if (parMoisPdf.length >= 2) {
      const lignesEvol = parMoisPdf.map(([id, montant], i) => {
        const prec = i > 0 ? parMoisPdf[i - 1][1] : null;
        const delta = prec !== null ? montant - prec : null;
        const pct = prec ? ((montant - prec) / prec) * 100 : null;
        return [
          libelleMois(id),
          `${fmt(montant)} $`,
          delta === null ? '—' : `${delta >= 0 ? '+' : ''}${fmt(delta)} $`,
          pct === null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`,
        ];
      });
      autoTable(doc, {
        startY: yEvol + 3,
        head: [['Mois', 'Montant facturé', 'Δ vs mois précédent', 'Variation']],
        body: lignesEvol,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [11, 19, 48], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [246, 248, 253] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      });
    } else {
      doc.setFontSize(9);
      doc.setTextColor(132, 148, 184);
      doc.text(
        doc.splitTextToSize(
          'Un seul mois de facture est importé pour l\u2019instant. Importez les factures des mois précédents (une commande par mois) et l\u2019évolution des montants facturés s\u2019affichera ici, avec le détail par famille.',
          178
        ),
        14,
        yEvol + 7
      );
    }

    // ════════ PAGE 3 — DÉTAILS ════════
    doc.addPage();
    doc.setFontSize(12);
    doc.setTextColor(11, 19, 48);
    doc.text('Détails utiles pour la facturation', 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(84, 101, 138);
    doc.text('Résumé par code service. Le détail ligne par ligne est dans le fichier Excel.', 14, 22);
    const parCode = new Map<string, { qte: number; montant: number }>();
    for (const l of resultat.lignes) {
      const cle = l.code_service || l.famille;
      const e = parCode.get(cle) || { qte: 0, montant: 0 };
      e.qte += l.qty || 1;
      e.montant += l.montant_attendu ?? l.paiement_pav ?? 0;
      parCode.set(cle, e);
    }
    autoTable(doc, {
      startY: 26,
      head: [['Code service', 'Quantité', 'Montant ($)']],
      body: [...parCode.entries()].sort((a, b) => b[1].montant - a[1].montant).map(([c, v]) => [c, String(v.qte), fmt(v.montant)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [11, 19, 48], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [246, 248, 253] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });

    const yTop = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;
    let yComptes = yTop + 14;
    if (yComptes > 220) { doc.addPage(); yComptes = 20; }
    doc.setFontSize(12);
    doc.setTextColor(11, 19, 48);
    doc.text('Top 10 comptes clients', 14, yComptes - 6);
    const parCompte = new Map<string, { qte: number; montant: number }>();
    for (const l of resultat.lignes) {
      const cle = l.no_cli || '—';
      const e = parCompte.get(cle) || { qte: 0, montant: 0 };
      e.qte += l.qty || 1;
      e.montant += l.montant_attendu ?? l.paiement_pav ?? 0;
      parCompte.set(cle, e);
    }
    autoTable(doc, {
      startY: yComptes,
      head: [['Compte client', 'Quantité', 'Montant ($)']],
      body: [...parCompte.entries()].sort((a, b) => b[1].montant - a[1].montant).slice(0, 10).map(([c, v]) => [c, String(v.qte), fmt(v.montant)]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [11, 19, 48], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [246, 248, 253] },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
    });

    // ════════ Pieds de page paginés ════════
    const nbPages = doc.getNumberOfPages();
    for (let i = 1; i <= nbPages; i++) {
      doc.setPage(i);
      doc.setDrawColor(219, 227, 243);
      doc.line(14, 285, 196, 285);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 160, 188);
      doc.text(`ACX Flow · Espace VL PAVA · Facture ${moisLabel} (${noFacture}) · Générée le ${new Date().toLocaleDateString('fr-FR')}`, 14, 289.5);
      doc.text(`Page ${i} / ${nbPages}`, 196, 289.5, { align: 'right' });
    }

    const nomPdf = (snap.nomCommande || `facture-pava-${mois}`).replace(/[\\/:*?\"<>|]/g, '_');
    doc.save(`${nomPdf}.pdf`);
  };

  if (snap.enChargement) {
    return (
      <>
        <header className="g-top g-rise">
          <div>
            <div className="g-kicker"><i /> VL · PAV Affaire</div>
            <h1>Factures</h1>
            <p className="g-lead">Chargement des commandes depuis la base…</p>
          </div>
        </header>
        <CarteChargement titre="Chargement des factures…" />
      </>
    );
  }

  if (snap.commandes.length === 0) {
    return (
      <>
        <header className="g-top g-rise">
          <div>
            <div className="g-kicker"><i /> VL · PAVA Affaire</div>
            <h1>Factures</h1>
            <p className="g-lead">Toutes les commandes de facturation : facture du mois, ancienne facture à valider, test, suivi de production.</p>
          </div>
        </header>
        <section className="g-card g-glass g-rise">
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Aucune commande</h3>
              <p className="g-card-sub">Créez une première commande de facturation en Importation pour la voir apparaître ici.</p>
            </div>
          </div>
          <Link className="g-btn" href="/admin/importation">Créer une commande</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Factures</h1>
          <p className="g-lead">Toutes les commandes de facturation : facture du mois, ancienne facture à valider, test, suivi de production.</p>
        </div>
        <div className="g-tools">
          <select className="g-chip" aria-label="Mois" value={mois} onChange={(e) => setMoisChoisi(e.target.value)}>
            {MOIS.map((m) => (
              <option key={m.id} value={m.id}>{m.label} · {snap.statutFacture[m.id] === 'validee' ? 'Validée' : 'En cours'}</option>
            ))}
          </select>
        </div>
      </header>

      {snap.erreur && (
        <div className="g-card g-glass" style={{ borderColor: 'var(--g-bad, #dc2626)' }}>
          <p style={{ fontSize: 13 }}><b>Erreur base de données :</b> {snap.erreur}</p>
        </div>
      )}
      <section className="g-hero g-glass g-rise">
        <div>
          <div className="g-kicker"><i /> {validee ? 'Facture validée' : 'Facture en cours'}</div>
          <h2>{MOIS.find((m) => m.id === mois)?.label} · <em>{fmt(resultat.totalRecalcule)} $</em></h2>
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
                  <tr key={f}><td><b>{f}</b></td><td>{v.qte}</td><td style={{ textAlign: 'right' }}>{fmt(v.montant)} $</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead><tr><th>Sommaire</th><th>Quantité</th><th style={{ textAlign: 'right' }}>Prix</th></tr></thead>
              <tbody>
                {parNature.map(([n, v]) => (
                  <tr key={n}><td><b>{n}</b></td><td>{v.qte}</td><td style={{ textAlign: 'right' }}>{fmt(v.montant)} $</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="g-card-foot">
          <span>{resultat.lignes.length} lignes · {fmt(resultat.totalRecalcule)} $</span>
          <span>Testez les boutons Excel et PDF ci-dessus</span>
        </div>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Toutes les commandes · {snap.commandes.length}</h3>
            <p className="g-card-sub">Une commande en cours peut être supprimée. Une facture validée par le Directeur ne peut pas être supprimée sans accès.</p>
          </div>
        </div>
        <ul className="g-list">
          {snap.commandes.map((c) => (
            <li key={c.id}>
              <div className="g-list-item">
                <span className="g-list-main">
                  <b>{c.nom}</b>
                  <span>{c.lignes.length} lignes · {c.historique.length} entrées d&apos;historique</span>
                </span>
                <span className="g-list-side" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className={`g-badge ${c.statut === 'validee' ? 'is-ok' : c.statut === 'valide_admin' ? 'is-info' : 'is-warn'}`}><i className="g-dot" />{c.statut === 'validee' ? 'Validée' : c.statut === 'valide_admin' ? 'Validée Admin' : 'En cours'}</span>
                  <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => setActiveCommande(c.id)}>Ouvrir</button>
                  <button
                    type="button"
                    className="g-btn g-btn--ghost g-btn--sm"
                    disabled={c.statut === 'validee'}
                    title={c.statut === 'validee' ? 'Validée par le Directeur : suppression interdite sans accès' : 'Supprimer'}
                    onClick={async () => {
                      if (!confirm(`Supprimer la commande « ${c.nom} » ?`)) return;
                      const ok = await deleteCommande(c.id);
                      if (!ok) alert('Suppression impossible : facture validée par le Directeur.');
                    }}
                  >
                    Supprimer
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

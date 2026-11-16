'use client';

/**
 * Tableau de bord PAVA — habillage Glassy V22 (classes g-).
 * Vue globale sur toutes les commandes + filtre par commande traitée.
 * Chiffres lus dans le store, jamais en constante. L'Analyste ne voit
 * pas les montants.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import CarteChargement from '@/components/pava/CarteChargement';
import { fusionnerStats, STATS_VIDES, type StatsCommande } from '@/lib/pava/stats';
import Link from 'next/link';
import { getPavaState, subscribePava } from '@/lib/pava-store';

function fmt(n: number) {
  return Number(n || 0).toLocaleString('fr-FR');
}

/** '2026-11' → 'nov. 2026' */
function libelleMois(id: string) {
  const [a, m] = id.split('-');
  const noms = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${noms[Number(m) - 1] || m} ${a}`;
}

/** Montant compact pour les graphiques : 257,4 k$ / 1,2 M$ */
function fmtCourt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M$`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)} k$`;
  if (Math.abs(n) >= 1_000) return `${(n / 1000).toFixed(1).replace('.', ',')} k$`;
  return `${fmt(n)} $`;
}

/** Couleurs stables par famille (mêmes teintes que le PDF). */
const COULEURS: Record<string, string> = {
  CAB: '#2563eb', TPC: '#8b5cf6', CELL: '#0891b2', TIPN: '#06b6d4',
  NUM: '#7c3aed', REDO: '#0ea5e9', WIFIPRO: '#22d3ee', AUTRE: '#94a3b8',
};

type Totaux = {
  AJOUT: { n: number; m: number };
  RENOUVELLEMENT: { n: number; m: number };
  SACA: { n: number; m: number };
  NON_FACTUREE: { n: number; m: number };
  TOTAL: { n: number; m: number };
};

const TOTAUX_VIDES: Totaux = {
  AJOUT: { n: 0, m: 0 }, RENOUVELLEMENT: { n: 0, m: 0 }, SACA: { n: 0, m: 0 },
  NON_FACTUREE: { n: 0, m: 0 }, TOTAL: { n: 0, m: 0 },
};

export default function AdminDashboardPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [today, setToday] = useState<Date>(() => new Date());
  useEffect(() => {
    setToday(new Date());
    const t = setInterval(() => setToday(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const [filtre, setFiltre] = useState<string>('toutes');
  const [anneeChoisie, setAnneeChoisie] = useState<string>('');

  const longDate = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const canSee = snap.role === 'admin' || snap.role === 'directeur';
  const montant = (n: number) => (canSee ? `${fmt(n)} $` : 'Masqué');

  // Stats pré-calculées (mode base : pava_commandes.stats) — le tableau de bord
  // n'a plus besoin de charger les ~3 500 lignes de chaque commande.
  const commandeActive = snap.commandes.find((c) => c.id === filtre);

  const stats: StatsCommande = useMemo(
    () =>
      filtre === 'toutes'
        ? fusionnerStats(snap.commandes.map((c) => c.stats || STATS_VIDES))
        : commandeActive?.stats || STATS_VIDES,
    [snap.commandes, filtre, commandeActive]
  );

  // Comptes clients distincts : stats pré-calculées, avec repli sur calcul
  // direct pour la commande active (stats antérieures sans nbComptes).
  const nbComptes = useMemo(() => {
    if (stats.nbComptes) return stats.nbComptes;
    if (commandeActive && commandeActive.id === snap.activeCommandeId) {
      return new Set(snap.lignes.map((l) => l.compte).filter(Boolean)).size;
    }
    return stats.nbComptes || 0;
  }, [stats, commandeActive, snap.activeCommandeId, snap.lignes]);

  const totaux = useMemo<Totaux>(() => {
    const t = JSON.parse(JSON.stringify(TOTAUX_VIDES)) as Totaux;
    for (const [cat, v] of Object.entries(stats.parCategorie || {})) {
      if (!(cat in t)) continue;
      t[cat as keyof Totaux].n += v.n;
      t[cat as keyof Totaux].m += v.m;
      t.TOTAL.n += v.n;
      t.TOTAL.m += v.m;
    }
    return t;
  }, [stats]);

  const nbIncoherences = stats.nbIncoherences || 0;

  // Par commande : montant + statut (vue globale, depuis les stats)
  const parCommande = useMemo(
    () =>
      snap.commandes.map((c) => {
        const st = c.stats || STATS_VIDES;
        return {
          id: c.id, nom: c.nom, statut: c.statut,
          lignes: st.nbLignes, comptes: st.nbComptes || 0, montant: st.totalCalcule, inco: st.nbIncoherences,
        };
      }),
    [snap.commandes]
  );

  const maxCat = Math.max(1, totaux.AJOUT.m, totaux.RENOUVELLEMENT.m);
  const maxCmd = Math.max(1, ...parCommande.map((c) => c.montant));
  const nbEnCours = snap.commandes.filter((c) => c.statut !== 'validee').length;

  // Familles de produits : depuis les stats pré-calculées (parFamille) ;
  // repli sur calcul direct des lignes pour la commande active quand les
  // stats datent d'avant l'ajout de parFamille (commandes à réimporter).
  const familles = useMemo(() => {
    const entries = Object.entries(stats.parFamille || {}).filter(([, v]) => v.n > 0 || v.m > 0);
    if (entries.length > 0) return entries.sort((a, b) => b[1].m - a[1].m);
    if (commandeActive && commandeActive.id === snap.activeCommandeId) {
      const m = new Map<string, { n: number; m: number }>();
      for (const l of snap.lignes) {
        const fam = l.famille || l.produit || 'AUTRE';
        const e = m.get(fam) || { n: 0, m: 0 };
        e.n += l.quantite ?? 1;
        e.m += (l.montantCalcule ?? 0) + (l.ajustement || 0);
        m.set(fam, e);
      }
      return [...m.entries()].sort((a, b) => b[1].m - a[1].m);
    }
    return [] as [string, { n: number; m: number }][];
  }, [stats, commandeActive, snap.activeCommandeId, snap.lignes]);
  const totalFamilles = familles.reduce((s2, [, v]) => s2 + v.m, 0);
  const maxFamille = Math.max(1, ...familles.map(([, v]) => v.m));

  // Suivi mensuel : une ligne par MOIS (les commandes d'un même mois sont cumulées).
  // Se remplit au fil des imports des factures des mois précédents.
  const parMois = useMemo(() => {
    const m = new Map<string, { mois: string; cmd: number; lignes: number; comptes: number; montant: number; inco: number; familles: Record<string, { n: number; m: number }>; complet: boolean }>();
    for (const c of snap.commandes) {
      if (!c.mois) continue;
      const e = m.get(c.mois) || { mois: c.mois, cmd: 0, lignes: 0, comptes: 0, montant: 0, inco: 0, familles: {}, complet: true };
      const st = c.stats || STATS_VIDES;
      e.cmd += 1;
      e.lignes += st.nbLignes || 0;
      e.comptes += st.nbComptes || 0;
      e.montant += st.totalCalcule || 0;
      e.inco += st.nbIncoherences || 0;
      if (!st.parFamille || Object.keys(st.parFamille).length === 0) e.complet = false;
      for (const [f, v] of Object.entries(st.parFamille || {})) {
        const cur = e.familles[f] || { n: 0, m: 0 };
        cur.n += v.n || 0;
        cur.m += v.m || 0;
        e.familles[f] = cur;
      }
      m.set(c.mois, e);
    }
    return [...m.values()].sort((a, b) => a.mois.localeCompare(b.mois));
  }, [snap.commandes]);
  const maxMois = Math.max(1, ...parMois.map((m) => m.montant));
  const derniersMois = parMois.slice(-12); // le graphique montre les 12 derniers mois
  // Vue ANNÉE : une ligne par mois, indépendante du filtre commande.
  const annees = [...new Set(parMois.map((m) => m.mois.slice(0, 4)))].sort().reverse();
  const annee = annees.includes(anneeChoisie) ? anneeChoisie : (annees[0] || '');
  const moisAnnee = parMois.filter((m) => !annee || m.mois.startsWith(annee));
  const totAnnee = {
    cmd: moisAnnee.reduce((s2, m) => s2 + m.cmd, 0),
    lignes: moisAnnee.reduce((s2, m) => s2 + m.lignes, 0),
    comptes: moisAnnee.reduce((s2, m) => s2 + m.comptes, 0),
    montant: moisAnnee.reduce((s2, m) => s2 + m.montant, 0),
    inco: moisAnnee.reduce((s2, m) => s2 + m.inco, 0),
  };

  if (!mounted) {
    return (
      <>
        <header className="g-top">
          <div>
            <div className="g-kicker"><i /> Espace VL PAVA</div>
            <h1>Tableau de bord</h1>
            <p className="g-lead">Chargement du tableau de bord…</p>
          </div>
        </header>
        <section className="g-kpis">
          {[0, 1, 2, 3].map((i) => (
            <article key={i} className="g-kpi g-glass" aria-hidden="true">
              <div className="g-kpi-top"><span className="g-kpi-ico" /></div>
              <b className="g-value g-num">—</b>
              <span className="g-label">…</span>
            </article>
          ))}
        </section>
      </>
    );
  }

  return (
    <>
      <header className="g-top g-rise" style={{ ['--d' as string]: '.02s' }}>
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Tableau de bord</h1>
          <p className="g-lead">Facturation PAV Affaire — vue globale ou par commande.</p>
        </div>
        <div className="g-tools">
          <span className="g-date" suppressHydrationWarning>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" />
            </svg>
            {longDate}
          </span>
          <select className="g-chip" aria-label="Commande" value={filtre} onChange={(e) => setFiltre(e.target.value)}>
            <option value="toutes">Toutes les commandes ({snap.commandes.length})</option>
            {snap.commandes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>
      </header>

      {snap.enChargement && (
        <CarteChargement titre="Chargement du tableau de bord…" texte="Les totaux de chaque commande sont récupérés depuis la base (sans charger les lignes)." />
      )}

      <section className="g-hero g-glass g-rise" style={{ ['--d' as string]: '.06s' }}>
        <div>
          <div className="g-kicker"><i /> {filtre === 'toutes' ? `Vue globale · ${snap.commandes.length} commandes` : commandeActive?.statut === 'validee' ? 'Facture validée' : 'Facture en cours'}</div>
          <h2>
            {filtre === 'toutes' ? 'Toutes les commandes' : commandeActive?.nom} · <em>{montant(totaux.TOTAL.m)}</em>
          </h2>
          <p>
            {nbComptes.toLocaleString('fr-FR')} comptes clients · {totaux.TOTAL.n.toLocaleString('fr-FR')} lignes.
          </p>
          <div className="g-hero-actions">
            <Link className="g-btn" href="/admin/analyse">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
              </svg>
              Voir l&apos;analyse
            </Link>
            <Link className="g-btn g-btn--ghost" href="/admin/factures">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
              </svg>
              Voir les Factures
            </Link>
            <Link className="g-btn g-btn--ghost" href="/admin/importation">
              Créer une commande
            </Link>
          </div>
        </div>
        <div className="g-hero-side">
          <b className="g-num">{nbIncoherences.toLocaleString('fr-FR')}</b>
          <span>incohérences</span>
          <small>{filtre === 'toutes' ? `${nbEnCours} en cours` : (commandeActive?.mois || '')}</small>
        </div>
      </section>

      <section className="g-kpis" aria-label="Totaux">
        <article className="g-kpi g-glass g-rise" style={{ ['--d' as string]: '.1s' }}>
          <div className="g-kpi-top">
            <span className="g-kpi-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" />
              </svg>
            </span>
            <span className="g-delta">{nbComptes.toLocaleString('fr-FR')} comptes</span>
          </div>
          <b className="g-value g-num">{montant(totaux.AJOUT.m)}</b>
          <span className="g-label">AJOUT (branchements)</span>
        </article>

        <article className="g-kpi g-glass g-rise" style={{ ['--d' as string]: '.13s' }}>
          <div className="g-kpi-top">
            <span className="g-kpi-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span className="g-delta is-ok">{totaux.RENOUVELLEMENT.n} renouvellements · 65 $</span>
          </div>
          <b className="g-value g-num">{montant(totaux.RENOUVELLEMENT.m)}</b>
          <span className="g-label">Renouvellement</span>
        </article>

        <article className="g-kpi g-glass g-rise" style={{ ['--d' as string]: '.16s' }}>
          <div className="g-kpi-top">
            <span className="g-kpi-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3 2 21h20L12 3z" /><path d="M12 10v4M12 17h.01" />
              </svg>
            </span>
            <span className={`g-delta ${nbIncoherences ? 'is-warn' : 'is-ok'}`}>{nbIncoherences ? 'à valider' : 'aucune'}</span>
          </div>
          <b className="g-value g-num" style={{ color: nbIncoherences ? 'var(--g-bad)' : undefined }}>{nbIncoherences.toLocaleString('fr-FR')}</b>
          <span className="g-label">Incohérences à valider</span>
        </article>

        <article className="g-kpi g-glass g-rise" style={{ ['--d' as string]: '.19s' }}>
          <div className="g-kpi-top">
            <span className="g-kpi-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
              </svg>
            </span>
            <span className="g-delta">{filtre === 'toutes' ? `${snap.commandes.length} commandes` : `${totaux.SACA.n} SACA`}</span>
          </div>
          <b className="g-value g-num">{montant(totaux.TOTAL.m)}</b>
          <span className="g-label">{filtre === 'toutes' ? 'Total global' : 'Total de la commande'}</span>
        </article>
      </section>

      {parMois.length > 0 && (
        <section className="g-card g-glass g-rise" style={{ ['--d' as string]: '.2s' }}>
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Chiffres par mois · vue année</h3>
              <p className="g-card-sub">Toutes commandes, indépendamment du filtre.</p>
            </div>
            {annees.length > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                {annees.map((a) => (
                  <button key={a} type="button" className={`g-btn g-btn--sm ${a === annee ? '' : 'g-btn--ghost'}`} onClick={() => setAnneeChoisie(a)}>
                    {a}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>Mois</th>
                  <th style={{ textAlign: 'right' }}>Commandes</th>
                  <th style={{ textAlign: 'right' }}>Comptes</th>
                  <th style={{ textAlign: 'right' }}>Lignes</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                  <th style={{ textAlign: 'right' }}>Incohérences</th>
                </tr>
              </thead>
              <tbody>
                {moisAnnee.map((m) => (
                  <tr key={m.mois}>
                    <td><b>{libelleMois(m.mois)}</b></td>
                    <td style={{ textAlign: 'right' }}>{m.cmd}</td>
                    <td style={{ textAlign: 'right' }}>{m.comptes ? m.comptes.toLocaleString('fr-FR') : <span style={{ opacity: 0.4 }}>—</span>}</td>
                    <td style={{ textAlign: 'right' }}>{m.lignes.toLocaleString('fr-FR')}</td>
                    <td style={{ textAlign: 'right' }}><b className="g-num">{montant(m.montant)}</b></td>
                    <td style={{ textAlign: 'right' }}>{m.inco ? m.inco.toLocaleString('fr-FR') : '0'}</td>
                  </tr>
                ))}
                <tr>
                  <td><b>Total {annee || ''}</b></td>
                  <td style={{ textAlign: 'right' }}><b>{totAnnee.cmd}</b></td>
                  <td style={{ textAlign: 'right' }}><b>{totAnnee.comptes ? totAnnee.comptes.toLocaleString('fr-FR') : '—'}</b></td>
                  <td style={{ textAlign: 'right' }}><b>{totAnnee.lignes.toLocaleString('fr-FR')}</b></td>
                  <td style={{ textAlign: 'right' }}><b className="g-num">{montant(totAnnee.montant)}</b></td>
                  <td style={{ textAlign: 'right' }}><b>{totAnnee.inco.toLocaleString('fr-FR')}</b></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="g-card-foot">
            <span>Vue globale par mois — le filtre en haut ne s&apos;applique pas ici.</span>
            <span>Comptes = clients distincts par commande (cumul si plusieurs commandes).</span>
          </div>
        </section>
      )}

      <section className="g-grid-2">
        <article className="g-card g-glass g-rise" style={{ ['--d' as string]: '.22s' }}>
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Par catégorie</h3>
              <p className="g-card-sub">AJOUT vs Renouvellement — {filtre === 'toutes' ? 'toutes commandes confondues' : 'commande affichée'}.</p>
            </div>
          </div>
          <div className="g-bars">
            {[
              { label: 'AJOUT', n: totaux.AJOUT.m, color: '#3b82f6' },
              { label: 'Renouvellement', n: totaux.RENOUVELLEMENT.m, color: '#22d3ee' },
              { label: 'Source SACA', n: totaux.SACA.m, color: '#8b5cf6' },
            ].map((c) => (
              <div key={c.label} className="g-bar">
                <span className="g-bar-label">
                  <i style={{ background: c.color, color: c.color }} />
                  {c.label}
                </span>
                <span className="g-track">
                  <span className="g-fill" style={{ width: `${Math.round((c.n / maxCat) * 100)}%`, ['--g-bar-c' as string]: c.color }} />
                </span>
                <span className="g-bar-val">
                  <b className="g-num">{montant(c.n)}</b>
                </span>
              </div>
            ))}
          </div>
          <div className="g-card-foot">
            <span>Total <b className="g-num">{montant(totaux.TOTAL.m)}</b></span>
            <span>{totaux.TOTAL.n} lignes</span>
          </div>
        </article>

        <article className="g-card g-glass g-rise" style={{ ['--d' as string]: '.25s' }}>
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Incohérences</h3>
              <p className="g-card-sub">À valider avant la facture — par commande, depuis les totaux pré-calculés.</p>
            </div>
            <Link className="g-btn g-btn--ghost g-btn--sm" href="/admin/analyse">Tout voir</Link>
          </div>
          {nbIncoherences === 0 ? (
            <p className="g-empty">Aucune incohérence.</p>
          ) : (
            <ul className="g-list">
              {parCommande.filter((c) => c.inco > 0).slice(0, 6).map((c) => (
                <li key={c.id}>
                  <div className="g-list-item">
                    <span className="g-list-main">
                      <b>{c.nom}</b>
                      <span>{c.lignes.toLocaleString('fr-FR')} lignes · {c.statut === 'validee' ? 'Validée' : c.statut === 'valide_admin' ? 'Validée Admin' : 'En cours'}</span>
                    </span>
                    <span className="g-list-side">
                      <span className="g-badge is-warn"><i className="g-dot" />{c.inco.toLocaleString('fr-FR')}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="g-card-foot">
            <span><b className="g-num">{nbIncoherences.toLocaleString('fr-FR')}</b> à valider</span>
            <span>Analyse détaillée en page Analyse</span>
          </div>
        </article>
      </section>

      <section className="g-grid-2">
        {/* ── Familles de produits ── */}
        <article className="g-card g-glass g-rise" style={{ ['--d' as string]: '.26s' }}>
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Familles de produits</h3>
              <p className="g-card-sub">
                Montant facturé par famille — {filtre === 'toutes' ? 'toutes commandes confondues' : `commande affichée`}.
              </p>
            </div>
          </div>
          {familles.length === 0 ? (
            <p className="g-empty">
              Aucune répartition par famille pour cette sélection. Les commandes importées avant cette mise à jour
              doivent être réimportées pour l&apos;obtenir.
            </p>
          ) : (
            <div className="g-bars">
              {familles.map(([f, v]) => {
                const pct = totalFamilles ? (v.m / totalFamilles) * 100 : 0;
                return (
                  <div key={f} className="g-bar">
                    <span className="g-bar-label">
                      <i style={{ background: COULEURS[f] || '#3b82f6', color: COULEURS[f] || '#3b82f6' }} />
                      {f}
                    </span>
                    <span className="g-track">
                      <span className="g-fill" style={{ width: `${Math.round((v.m / maxFamille) * 100)}%`, ['--g-bar-c' as string]: COULEURS[f] || '#3b82f6' }} />
                    </span>
                    <span className="g-bar-val">
                      <b className="g-num">{montant(v.m)}</b>
                      <small style={{ display: 'block', fontSize: 11, opacity: 0.75 }}>
                        {v.n.toLocaleString('fr-FR')} u · {pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
                      </small>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="g-card-foot">
            <span>{familles.length} famille(s)</span>
            <span>Total <b className="g-num">{montant(totalFamilles)}</b></span>
          </div>
        </article>

        {/* ── Évolution mensuelle ── */}
        <article className="g-card g-glass g-rise" style={{ ['--d' as string]: '.28s' }}>
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Évolution des montants facturés</h3>
              <p className="g-card-sub">Un point par mois de facture importé — {parMois.length} mois suivi(s).</p>
            </div>
          </div>
          {parMois.length === 0 ? (
            <p className="g-empty">Créez une commande avec son mois pour démarrer le suivi.</p>
          ) : parMois.length === 1 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                  <rect x="20" y="14" width="24" height="38" rx="5" fill="#22d3ee" opacity="0.9" />
                </svg>
                <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
                  <b>{libelleMois(parMois[0].mois)}</b> · <b className="g-num">{montant(parMois[0].montant)}</b>
                  <br />
                  <span style={{ opacity: 0.8 }}>
                    {parMois[0].comptes ? `${parMois[0].comptes.toLocaleString('fr-FR')} comptes · ` : ''}{parMois[0].lignes.toLocaleString('fr-FR')} lignes
                  </span>
                </div>
              </div>
              <p className="g-empty" style={{ marginTop: 0 }}>
                Importez les factures des mois précédents (une commande par mois, nommée par ex. « Facture Octobre 2026 »)
                et l&apos;évolution mensuelle des montants et des familles s&apos;affichera ici automatiquement.
              </p>
            </>
          ) : (
            <>
              <svg viewBox={`0 0 560 168`} width="100%" role="img" aria-label="Montants facturés par mois" style={{ display: 'block' }}>
                {(() => {
                  const n = derniersMois.length;
                  const W = 560, H = 168, padX = 8, bas = 132, hautBarre = 96;
                  const pas = (W - padX * 2) / n;
                  return derniersMois.map((m, i) => {
                    const h = Math.max(4, Math.round((m.montant / maxMois) * hautBarre));
                    const bw = Math.min(46, pas * 0.6);
                    const x = padX + pas * i + (pas - bw) / 2;
                    const dernier = i === n - 1;
                    const coul = dernier ? '#22d3ee' : '#3b82f6';
                    const [annee, mm] = m.mois.split('-');
                    return (
                      <g key={m.mois}>
                        <rect x={x} y={bas - h} width={bw} height={h} rx="5" fill={coul} opacity={dernier ? 0.95 : 0.75}>
                          {dernier ? <animate attributeName="opacity" from="0.6" to="0.95" dur="0.6s" fill="freeze" /> : null}
                        </rect>
                        <text x={x + bw / 2} y={bas - h - 6} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#0b1330">
                          {fmtCourt(m.montant)}
                        </text>
                        <text x={x + bw / 2} y={bas + 15} textAnchor="middle" fontSize="10" fill="#54658a">
                          {['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][Number(mm) - 1] || mm}
                        </text>
                        <text x={x + bw / 2} y={bas + 27} textAnchor="middle" fontSize="8.5" fill="#8494b8">
                          {annee}
                        </text>
                      </g>
                    );
                  });
                })()}
                <line x1="6" y1={132.5} x2="554" y2={132.5} stroke="#dbe3f3" strokeWidth="1" />
              </svg>
              <ul className="g-list" style={{ marginTop: 8 }}>
                {parMois.slice(-3).reverse().map((m, i, arr) => {
                  const idx = parMois.indexOf(m);
                  const prec = idx > 0 ? parMois[idx - 1] : null;
                  const delta = prec ? m.montant - prec.montant : null;
                  const pct = prec && prec.montant ? (delta! / prec.montant) * 100 : null;
                  return (
                    <li key={m.mois}>
                      <div className="g-list-item">
                        <span className="g-list-main">
                          <b>{libelleMois(m.mois)}</b>
                          <span>{m.comptes ? `${m.comptes.toLocaleString('fr-FR')} comptes · ` : ''}{m.lignes.toLocaleString('fr-FR')} lignes</span>
                        </span>
                        <span className="g-list-side">
                          <b className="g-num">{montant(m.montant)}</b>{' '}
                          {delta !== null && (
                            <span className={`g-badge ${delta >= 0 ? 'is-ok' : 'is-warn'}`} style={{ marginLeft: 6 }}>
                              <i className="g-dot" />
                              {delta >= 0 ? '+' : ''}{fmtCourt(Math.abs(delta))}{pct !== null ? ` (${delta >= 0 ? '+' : ''}${pct.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %)` : ''}
                            </span>
                          )}
                          {i === 0 && prec === null && <span style={{ marginLeft: 6 }}><em style={{ opacity: 0.6, fontSize: 12 }}>référence</em></span>}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <div className="g-card-foot">
            <span>Suivi alimenté par les commandes importées (une par mois)</span>
            <span>Détail par famille dans le tableau ci-dessous</span>
          </div>
        </article>
      </section>

      {parMois.length > 0 && (
        <section className="g-card g-glass g-rise" style={{ ['--d' as string]: '.3s' }}>
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Suivi par famille et par mois</h3>
              <p className="g-card-sub">
                Montant facturé de chaque famille, mois après mois — le tableau s&apos;enrichit à chaque import d&apos;un mois précédent.
              </p>
            </div>
          </div>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>Famille</th>
                  {parMois.map((m) => (
                    <th key={m.mois} style={{ textAlign: 'right' }}>{libelleMois(m.mois)}</th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Cumul</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const fams = [...new Set(parMois.flatMap((m) => Object.keys(m.familles)))].sort((a, b) => {
                    const t = (f: string) => parMois.reduce((s2, m) => s2 + (m.familles[f]?.m || 0), 0);
                    return t(b) - t(a);
                  });
                  const lignesTable = fams.map((f) => (
                    <tr key={f}>
                      <td>
                        <span className="g-bar-label" style={{ margin: 0 }}>
                          <i style={{ background: COULEURS[f] || '#3b82f6', color: COULEURS[f] || '#3b82f6' }} />
                          <b>{f}</b>
                        </span>
                      </td>
                      {parMois.map((m) => (
                        <td key={m.mois} style={{ textAlign: 'right' }}>
                          {m.familles[f] ? montant(m.familles[f].m) : <span style={{ opacity: 0.4 }}>—</span>}
                        </td>
                      ))}
                      <td style={{ textAlign: 'right' }}>
                        <b className="g-num">{montant(parMois.reduce((s2, m) => s2 + (m.familles[f]?.m || 0), 0))}</b>
                      </td>
                    </tr>
                  ));
                  lignesTable.push(
                    <tr key="__total">
                      <td><b>Total</b></td>
                      {parMois.map((m) => (
                        <td key={m.mois} style={{ textAlign: 'right' }}>
                          <b className="g-num">{montant(Object.values(m.familles).reduce((s2, v) => s2 + v.m, 0))}</b>
                        </td>
                      ))}
                      <td style={{ textAlign: 'right' }}>
                        <b className="g-num">{montant(parMois.reduce((s2, m) => s2 + Object.values(m.familles).reduce((s3, v) => s3 + v.m, 0), 0))}</b>
                      </td>
                    </tr>
                  );
                  return lignesTable;
                })()}
              </tbody>
            </table>
          </div>
          <div className="g-card-foot">
            <span>{parMois.filter((m) => !m.complet).length > 0 ? `${parMois.filter((m) => !m.complet).length} mois sans détail familles (réimportez ces commandes)` : 'Tous les mois ont leur détail par famille'}</span>
            <span>Montants masqués pour l&apos;Analyste</span>
          </div>
        </section>
      )}

      {filtre === 'toutes' && (
        <section className="g-card g-glass g-rise" style={{ ['--d' as string]: '.28s' }}>
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Commandes traitées · {snap.commandes.length}</h3>
              <p className="g-card-sub">Montant et incohérences par commande. Cliquez sur une commande pour filtrer le tableau de bord.</p>
            </div>
          </div>
          <div className="g-bars" style={{ marginBottom: 14 }}>
            {parCommande.map((c) => (
              <button
                key={c.id}
                type="button"
                className="g-bar"
                style={{ cursor: 'pointer', background: 'none', border: 'none', font: 'inherit', textAlign: 'left', padding: 0 }}
                onClick={() => setFiltre(c.id)}
                title={`Filtrer sur ${c.nom}`}
              >
                <span className="g-bar-label">
                  <i style={{ background: c.statut === 'validee' ? '#22c55e' : '#3b82f6', color: c.statut === 'validee' ? '#22c55e' : '#3b82f6' }} />
                  {c.nom}
                </span>
                <span className="g-track">
                  <span className="g-fill" style={{ width: `${Math.round((c.montant / maxCmd) * 100)}%`, ['--g-bar-c' as string]: c.statut === 'validee' ? '#22c55e' : '#3b82f6' }} />
                </span>
                <span className="g-bar-val">
                  <b className="g-num">{montant(c.montant)}</b>
                </span>
              </button>
            ))}
          </div>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead><tr><th>Commande</th><th>Statut</th><th style={{ textAlign: 'right' }}>Comptes</th><th style={{ textAlign: 'right' }}>Incohérences</th><th style={{ textAlign: 'right' }}>Montant</th><th></th></tr></thead>
              <tbody>
                {parCommande.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.nom}</b></td>
                    <td>
                      <span className={`g-badge ${c.statut === 'validee' ? 'is-ok' : c.statut === 'valide_admin' ? 'is-info' : 'is-warn'}`}>
                        <i className="g-dot" />{c.statut === 'validee' ? 'Validée' : c.statut === 'valide_admin' ? 'Validée Admin' : 'En cours'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{c.comptes ? c.comptes.toLocaleString('fr-FR') : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{c.inco}</td>
                    <td style={{ textAlign: 'right' }}>{montant(c.montant)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => setFiltre(c.id)}>Afficher</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="g-card-foot">
            <span>Calculs globaux recalculés à chaque modification</span>
            <span>Le détail complet est sur la page Factures</span>
          </div>
        </section>
      )}

      <footer className="g-foot">
        <span>ACX Flow · Espace VL PAVA — chiffres lus dans les lignes.</span>
        <span className="g-tag">Glassy V22</span>
      </footer>
    </>
  );
}

'use client';

/**
 * Tableau de bord PAVA — habillage Glassy V22 (classes g-).
 * Même logique que la démo : chiffres lus dans le store, jamais en constante.
 * Septembre validée, octobre en cours. L'Analyste ne voit pas les montants.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { getPavaState, subscribePava } from '@/lib/pava-store';

const MOIS_C = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function fmt(n: number) {
  return Number(n || 0).toLocaleString('fr-FR');
}

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
  const [mois, setMois] = useState(snap.mois || '2026-10');

  const longDate = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const canSee = snap.role === 'admin' || snap.role === 'directeur';
  const montant = (n: number) => (canSee ? `${fmt(n)} $` : 'Masqué');

  const lignes = useMemo(
    () => snap.lignes.filter((l) => (l.mois || snap.mois) === mois),
    [snap.lignes, snap.mois, mois]
  );
  const totaux = useMemo(() => {
    const t = { AJOUT: { n: 0, m: 0 }, RENOUVELLEMENT: { n: 0, m: 0 }, SACA: { n: 0, m: 0 }, NON_FACTUREE: { n: 0, m: 0 }, TOTAL: { n: 0, m: 0 } };
    for (const l of lignes) {
      if (l.incomplet) continue;
      const m = (l.montantCalcule ?? 0) + (l.ajustement || 0);
      t[l.categorie as keyof typeof t].n += l.quantite;
      t[l.categorie as keyof typeof t].m += m;
      t.TOTAL.n += l.quantite;
      t.TOTAL.m += m;
    }
    return t;
  }, [lignes]);

  const incoherences = useMemo(
    () => snap.lignes.filter((l) => (l.mois || snap.mois) === mois && (l.incomplet || l.incoherence)),
    [snap.lignes, snap.mois, mois]
  );

  const maxCat = Math.max(1, totaux.AJOUT.m, totaux.RENOUVELLEMENT.m);

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
          <p className="g-lead">
            Facturation mensuelle Videotron PAV Affaire. Septembre validée, octobre en cours.
            L&apos;Analyste importe et analyse sans voir les montants finaux.
          </p>
        </div>
        <div className="g-tools">
          <span className="g-date" suppressHydrationWarning>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" />
            </svg>
            {longDate}
          </span>
          <select className="g-chip" aria-label="Mois" value={mois} onChange={(e) => setMois(e.target.value)}>
            <option value="2026-09">Septembre 2026</option>
            <option value="2026-10">Octobre 2026</option>
          </select>
        </div>
      </header>

      <section className="g-hero g-glass g-rise" style={{ ['--d' as string]: '.06s' }}>
        <div>
          <div className="g-kicker"><i /> {mois === '2026-09' ? 'Facture validée' : 'Facture en cours'}</div>
          <h2>
            {mois === '2026-09' ? 'Septembre' : 'Octobre'} · <em>{montant(totaux.TOTAL.m)}</em>
          </h2>
          <p>
            {totaux.TOTAL.n} lignes · AJOUT {totaux.AJOUT.n} · Renouvellement {totaux.RENOUVELLEMENT.n} ·
            SACA {totaux.SACA.n} · Non facturée {totaux.NON_FACTUREE.n}.
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
          </div>
        </div>
        <div className="g-hero-side">
          <b className="g-num">{incoherences.length}</b>
          <span>incohérences</span>
          <small>{mois}</small>
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
            <span className="g-delta">{totaux.AJOUT.n} lignes</span>
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
            <span className="g-delta is-ok">{totaux.RENOUVELLEMENT.n} lignes · 65 $</span>
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
            <span className={`g-delta ${incoherences.length ? 'is-warn' : 'is-ok'}`}>{incoherences.length ? 'à valider' : 'aucune'}</span>
          </div>
          <b className="g-value g-num" style={{ color: incoherences.length ? 'var(--g-bad)' : undefined }}>{incoherences.length}</b>
          <span className="g-label">Incohérences à valider</span>
        </article>

        <article className="g-kpi g-glass g-rise" style={{ ['--d' as string]: '.19s' }}>
          <div className="g-kpi-top">
            <span className="g-kpi-ico">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
              </svg>
            </span>
            <span className="g-delta">{totaux.SACA.n} SACA</span>
          </div>
          <b className="g-value g-num">{montant(totaux.TOTAL.m)}</b>
          <span className="g-label">Total du mois</span>
        </article>
      </section>

      <section className="g-grid-2">
        <article className="g-card g-glass g-rise" style={{ ['--d' as string]: '.22s' }}>
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Par catégorie</h3>
              <p className="g-card-sub">AJOUT vs Renouvellement, montants du mois choisi.</p>
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
              <p className="g-card-sub">À valider avant la facture. Chaque ligne indique sa référence Excel.</p>
            </div>
            <Link className="g-btn g-btn--ghost g-btn--sm" href="/admin/analyse">Tout voir</Link>
          </div>
          {incoherences.length === 0 ? (
            <p className="g-empty">Aucune incohérence.</p>
          ) : (
            <ul className="g-list">
              {incoherences.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <div className="g-list-item">
                    <span className="g-list-main">
                      <b>{l.id} · {l.compte ? `Compte ${l.compte}` : '—'}</b>
                      <span>{l.incoherence || l.incomplet}</span>
                    </span>
                    <span className="g-list-side">
                      <span className={`g-badge ${l.incomplet ? 'is-warn' : 'is-bad'}`}><i className="g-dot" />{l.incomplet ? 'Incomplet' : 'Incohérence'}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="g-card-foot">
            <span><b className="g-num">{incoherences.length}</b> à valider</span>
            <span>Analyse détaillée en page Analyse</span>
          </div>
        </article>
      </section>

      <section className="g-card g-glass g-rise" style={{ ['--d' as string]: '.28s' }}>
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Lignes du mois · {lignes.length}</h3>
            <p className="g-card-sub">Référence, compte, produit, catégorie et montant. Montants masqués pour l&apos;Analyste.</p>
          </div>
        </div>
        {lignes.length === 0 ? (
          <p className="g-empty">Aucune ligne ce mois-ci.</p>
        ) : (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Compte</th>
                  <th>Produit</th>
                  <th>Catégorie</th>
                  <th style={{ textAlign: 'right' }}>Montant</th>
                </tr>
              </thead>
              <tbody>
                {lignes.slice(0, 20).map((l) => (
                  <tr key={l.id}>
                    <td><span className="g-ref">{l.id}</span></td>
                    <td>{l.compte ? `Compte ${l.compte}` : '—'}</td>
                    <td><b>{l.produit}</b> · {l.desc}</td>
                    <td>{l.categorie}</td>
                    <td style={{ textAlign: 'right' }}>{montant((l.montantCalcule ?? 0) + (l.ajustement || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="g-card-foot">
          <span>{lignes.length} lignes · {montant(totaux.TOTAL.m)}</span>
          <span>Le détail complet est sur la page Factures</span>
        </div>
      </section>

      <footer className="g-foot">
        <span>ACX Flow · Espace VL PAVA — chiffres lus dans les lignes.</span>
        <span className="g-tag">Glassy V22</span>
      </footer>
    </>
  );
}

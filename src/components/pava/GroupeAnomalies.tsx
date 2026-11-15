'use client';

/**
 * Un GROUPE d'anomalies (règle + raison) : en-tête avec totaux et actions pour tout le groupe,
 * puis liste des lignes paginée (25 par page) avec recherche et sélection.
 * Règle d'or : on ne rend jamais plus de 25 lignes à la fois.
 */

import { useMemo, useRef, useState } from 'react';
import type { Anomaly, PavaRow } from '@/lib/pava/types';
import { libelleFix, estTraitee, type DecisionLite, type Groupe } from '@/lib/pava/groupes';

const PAR_PAGE = 25;

interface Props {
  groupe: Groupe;
  items: Anomaly[]; // lignes à afficher (déjà filtrées selon l'onglet)
  mode: 'traiter' | 'traitees' | 'infos';
  decisions: Record<string, DecisionLite>;
  rows: Map<string, PavaRow>;
  occupe: boolean;
  onIgnorer: (items: Anomaly[], commentaire: string) => void;
  onValider: (items: Anomaly[]) => void;
  onCorriger: (items: Anomaly[]) => void;
  onRouvrir: (items: Anomaly[]) => void;
  onEditer: (a: Anomaly) => void;
}

const fmt = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('fr-FR')} $`;

export default function GroupeAnomalies({ groupe, items, mode, decisions, rows, occupe, onIgnorer, onValider, onCorriger, onRouvrir, onEditer }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [commentaire, setCommentaire] = useState('');
  const [erreurComment, setErreurComment] = useState(false);
  const refComment = useRef<HTMLInputElement>(null);

  const filtrees = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((a) => `${a.no_cli} ${a.nom_client || ''} ${a.feuille} ${a.ligne_excel} ${a.explication}`.toLowerCase().includes(t));
  }, [items, q]);

  const nbPages = Math.max(1, Math.ceil(filtrees.length / PAR_PAGE));
  const p = Math.min(page, nbPages);
  const visibles = filtrees.slice((p - 1) * PAR_PAGE, p * PAR_PAGE);

  const choisies = items.filter((a) => sel.has(a.id));
  const cible = choisies.length > 0 ? choisies : filtrees; // sans sélection : tout ce que le filtre montre
  const portee = choisies.length > 0 ? `${choisies.length} sélectionnée(s)` : q.trim() ? `${filtrees.length} filtrée(s)` : `les ${items.length}`;
  const cibleFixable = cible.filter((a) => a.fix);
  const impact = items.reduce((s, a) => s + a.impact, 0);

  const ignorer = () => {
    if (!commentaire.trim()) {
      // Retour visible (et focus) au lieu d'une alerte facile à manquer :
      // le commentaire est la trace d'audit de la décision d'ignorance.
      setErreurComment(true);
      refComment.current?.focus();
      return;
    }
    if (!confirm(`Ignorer ${portee} anomalie(s) « ${groupe.raison} » ?`)) return;
    onIgnorer(cible, commentaire.trim());
    setSel(new Set());
  };
  const corriger = () => {
    if (cibleFixable.length === 0) return;
    const fix = libelleFix(cibleFixable[0].fix);
    if (!confirm(`${fix} sur ${cibleFixable.length} ligne(s) ? Cette modification est enregistrée dans la commande.`)) return;
    onCorriger(cibleFixable);
    setSel(new Set());
  };
  const valider = () => {
    if (!confirm(`Valider ${portee} anomalie(s) « ${groupe.raison} » (on garde la ligne telle quelle) ?`)) return;
    onValider(cible);
    setSel(new Set());
  };

  const basculer = (id: string) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSel(n);
  };
  const toutePage = visibles.every((a) => sel.has(a.id));
  const basculerPage = () => {
    const n = new Set(sel);
    for (const a of visibles) {
      if (toutePage) n.delete(a.id);
      else n.add(a.id);
    }
    setSel(n);
  };

  const badge = groupe.confiance === 'REGLE' ? 'is-ok' : groupe.confiance === 'PROBABLE' ? 'is-info' : groupe.confiance === 'A_VALIDER' ? 'is-warn' : 'is-muted';

  return (
    <article className="g-card g-glass g-rise">
      <div className="g-card-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3 className="g-card-title">
            {groupe.regle} · {groupe.raison}{' '}
            <span className={`g-badge ${badge}`}><i className="g-dot" />{groupe.confiance}</span>
          </h3>
          <p className="g-card-sub">
            <b>{items.length.toLocaleString('fr-FR')}</b> ligne(s)
            {mode === 'traiter' && <> · impact <b style={{ color: impact < 0 ? 'var(--g-bad)' : impact > 0 ? 'var(--g-ok)' : undefined }}>{fmt(impact)}</b></>}
            {mode === 'traiter' && groupe.fixables > 0 && <> · correction automatique : {libelleFix(items.find((a) => a.fix)?.fix)}</>}
          </p>
        </div>
        <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => setOuvert(!ouvert)}>
          {ouvert ? 'Masquer les lignes ▲' : 'Voir les lignes ▼'}
        </button>
      </div>

      {mode === 'traiter' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={refComment}
            className="g-input"
            style={{ maxWidth: 280, ...(erreurComment ? { borderColor: 'var(--g-bad, #dc2626)', boxShadow: '0 0 0 3px rgba(220,38,38,.12)' } : {}) }}
            placeholder="Raison de l’ignorance (obligatoire)"
            value={commentaire}
            onChange={(e) => { setCommentaire(e.target.value); setErreurComment(false); }}
          />
          {erreurComment && (
            <span style={{ fontSize: 12.5, color: 'var(--g-bad, #dc2626)', fontWeight: 700 }}>
              Écrivez d’abord la raison dans le champ à gauche, puis cliquez « Ignorer ».
            </span>
          )}
          <button type="button" className="g-btn g-btn--ghost g-btn--sm" disabled={occupe} onClick={ignorer}>Ignorer {choisies.length ? `(${choisies.length})` : 'tout'}</button>
          <button type="button" className="g-btn g-btn--ghost g-btn--sm" disabled={occupe} onClick={valider}>Valider {choisies.length ? `(${choisies.length})` : 'tout'}</button>
          {cibleFixable.length > 0 && (
            <button type="button" className="g-btn g-btn--sm" disabled={occupe} onClick={corriger}>
              {libelleFix(cibleFixable[0].fix)} ({cibleFixable.length})
            </button>
          )}
        </div>
      )}
      {mode === 'traitees' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="g-btn g-btn--ghost g-btn--sm" disabled={occupe} onClick={() => onRouvrir(cible)}>Rouvrir {choisies.length ? `(${choisies.length})` : 'tout'}</button>
        </div>
      )}

      {ouvert && (
        <div style={{ marginTop: 12 }}>
          <div className="g-pager">
            <input className="g-input" style={{ maxWidth: 260 }} placeholder="Rechercher compte, client, feuille…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            <b>{filtrees.length.toLocaleString('fr-FR')} ligne(s) · page {p} / {nbPages}</b>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="g-btn g-btn--ghost g-btn--sm" disabled={p <= 1} onClick={() => setPage(p - 1)}>‹</button>
              <button type="button" className="g-btn g-btn--ghost g-btn--sm" disabled={p >= nbPages} onClick={() => setPage(p + 1)}>›</button>
            </div>
          </div>
          <div className="g-table-wrap">
            <table className="g-table">
              <thead>
                <tr>
                  <th style={{ width: 28 }}><input type="checkbox" checked={toutePage && visibles.length > 0} onChange={basculerPage} aria-label="Sélectionner la page" /></th>
                  <th>Ligne</th>
                  <th>Compte</th>
                  <th style={{ textAlign: 'right' }}>Payé</th>
                  <th style={{ textAlign: 'right' }}>Attendu</th>
                  <th>Explication</th>
                  <th style={{ textAlign: 'right' }}>Impact</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibles.map((a) => {
                  const r = rows.get(a.ligne_id);
                  const d = decisions[a.id];
                  return (
                    <tr key={a.id}>
                      <td><input type="checkbox" checked={sel.has(a.id)} onChange={() => basculer(a.id)} aria-label="Sélectionner" /></td>
                      <td><span className="g-ref">{a.feuille.trim()}</span><div style={{ fontSize: 11, color: 'var(--g-muted)' }}>ligne {a.ligne_excel}</div></td>
                      <td>{a.no_cli || '—'}{a.nom_client && <div style={{ fontSize: 11, color: 'var(--g-muted)' }}>{a.nom_client}</div>}</td>
                      <td style={{ textAlign: 'right' }}>{r?.paiement_pav ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{r?.montant_attendu ?? '—'}</td>
                      <td style={{ fontSize: 12 }}>
                        {a.explication}
                        {estTraitee(a, decisions) && d && <div style={{ fontSize: 11, color: 'var(--g-muted)' }}><b>{d.statut}</b>{d.commentaire ? ` — ${d.commentaire}` : ''}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}><b style={{ color: a.impact < 0 ? 'var(--g-bad)' : a.impact > 0 ? 'var(--g-ok)' : undefined }}>{fmt(a.impact)}</b></td>
                      <td>{a.scope === 'ligne' && <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => onEditer(a)}>Modifier</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {choisies.length === 0 && filtrees.length > PAR_PAGE && (
            <p className="g-card-sub" style={{ marginTop: 8 }}>Sans sélection, les actions du haut s’appliquent à toutes les lignes affichées par la recherche ({filtrees.length.toLocaleString('fr-FR')}).</p>
          )}
        </div>
      )}
    </article>
  );
}

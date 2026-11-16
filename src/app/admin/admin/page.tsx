'use client';

/**
 * Administration PAVA — accès, comptes et stockage.
 * Comptes en base (pava_utilisateurs) : l'Admin peut ajouter des
 * utilisateurs, changer les mots de passe, désactiver ou supprimer.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { getPavaState, subscribePava, setPavaRole, EST_MODE_DB, type Role } from '@/lib/pava-store';
import { TITRE_ROLE, type PavaRole } from '@/lib/pava-users';

interface UtilisateurRow {
  id: string;
  email: string;
  nom: string;
  role: PavaRole;
  multi_roles: boolean;
  actif: boolean;
}

const DROITS: Record<string, string> = {
  admin: 'Tout voir, corriger, Price Plan, valider (1er niveau), gérer les comptes',
  analyste: 'Importer et analyser · montants masqués · aucune validation',
  directeur: 'Tout voir · validation définitive · suppression interdite après validation',
};

export default function AdminPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const { data: session } = useSession();
  const role = snap.role;
  const rolesAutorises = (session?.user?.roles as PavaRole[] | undefined) || [];
  const multiRoles = rolesAutorises.length > 1;

  const [users, setUsers] = useState<UtilisateurRow[] | null>(null);
  const [msgUsers, setMsgUsers] = useState('');
  const [nouveau, setNouveau] = useState({ email: '', nom: '', role: 'analyste', multiRoles: false, motDePasse: '' });
  // Changement de mot de passe en ligne : id de l'utilisateur ciblé + nouveau mdp.
  const [mdpPour, setMdpPour] = useState<{ id: string; valeur: string } | null>(null);
  const gestionActive = EST_MODE_DB && role === 'admin';

  const chargerUsers = useCallback(async () => {
    try {
      const r = await fetch('/api/pava/utilisateurs');
      const d = await r.json();
      if (!r.ok) { setMsgUsers(d.error || 'Chargement impossible.'); setUsers([]); return; }
      setUsers(d.utilisateurs || []);
      // NB : ne pas effacer msgUsers ici — le rechargement qui suit une action
      // effaçait le message de retour (« Suspendu », « Mot de passe changé »…).
    } catch {
      setUsers([]);
      setMsgUsers('Chargement des comptes impossible.');
    }
  }, []);

  useEffect(() => {
    if (gestionActive) void chargerUsers();
  }, [gestionActive, chargerUsers]);

  const creerUser = async () => {
    setMsgUsers('Création…');
    const r = await fetch('/api/pava/utilisateurs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nouveau),
    });
    const d = await r.json();
    if (!r.ok) { setMsgUsers(d.error || 'Création impossible.'); return; }
    setMsgUsers(`Compte « ${d.utilisateur.email} » créé.`);
    setNouveau({ email: '', nom: '', role: 'analyste', multiRoles: false, motDePasse: '' });
    void chargerUsers();
  };

  const majUser = async (id: string, patch: Record<string, unknown>, apres?: string) => {
    const r = await fetch(`/api/pava/utilisateurs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const d = await r.json();
    if (!r.ok) { setMsgUsers(d.error || 'Modification impossible.'); return; }
    if (apres) setMsgUsers(apres);
    void chargerUsers();
  };

  const supprimerUser = async (u: UtilisateurRow) => {
    if (!confirm(`Supprimer le compte « ${u.email} » ?`)) return;
    const r = await fetch(`/api/pava/utilisateurs/${u.id}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsgUsers(d.error || 'Suppression impossible.'); return; }
    setMsgUsers(`Compte « ${u.email} » supprimé.`);
    void chargerUsers();
  };

  const changerMdp = async (u: UtilisateurRow) => {
    if (!mdpPour || mdpPour.valeur.length < 6) {
      setMsgUsers('Mot de passe : 6 caractères minimum.');
      return;
    }
    await majUser(u.id, { motDePasse: mdpPour.valeur }, `Mot de passe de ${u.email} changé.`);
    setMdpPour(null);
  };

  const changerRole = async (u: UtilisateurRow, role2: string) => {
    await majUser(u.id, { role: role2 }, `Rôle de ${u.email} → ${TITRE_ROLE[role2 as PavaRole]}.`);
  };

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Administration</h1>
          <p className="g-lead">Rôles, accès et comptes utilisateurs.</p>
        </div>
      </header>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Compte connecté</h3>
            <p className="g-card-sub">Session en cours.</p>
          </div>
          {session?.user && (
            <span className={`g-badge ${role === 'directeur' ? 'is-ok' : role === 'admin' ? 'is-info' : 'is-warn'}`}>
              <i className="g-dot" />{TITRE_ROLE[role]}
            </span>
          )}
        </div>
        {session?.user ? (
          <>
            <div className="g-table-wrap">
              <table className="g-table">
                <tbody>
                  <tr><td>Nom</td><td><b>{session.user.name}</b></td></tr>
                  <tr><td>Adresse</td><td>{session.user.email}</td></tr>
                  <tr><td>Rôle</td><td><b>{TITRE_ROLE[role]}</b>{multiRoles ? ' (au choix)' : ' (fixe)'}</td></tr>
                  <tr><td>Montants</td><td>{role === 'analyste' ? 'Masqués' : 'Visibles'}</td></tr>
                </tbody>
              </table>
            </div>
            {multiRoles && (
              <div style={{ marginTop: 14 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 700 }}>Changer de rôle (compte multi-rôles)</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {rolesAutorises.map((r) => (
                    <button key={r} type="button" className={`g-btn ${role === r ? '' : 'g-btn--ghost'}`} onClick={() => setPavaRole(r as Role)}>
                      {TITRE_ROLE[r]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <button type="button" className="g-btn g-btn--ghost" onClick={() => signOut({ callbackUrl: '/login' })}>
                Se déconnecter
              </button>
            </div>
          </>
        ) : (
          <p className="g-empty">Aucune session active — rôle démo : <b>{TITRE_ROLE[role]}</b>.</p>
        )}
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Comptes utilisateurs</h3>
            <p className="g-card-sub">Ajouter, suspendre, réactiver, changer rôle ou mot de passe.</p>
          </div>
        </div>

        {gestionActive ? (
          <>
            <div className="g-table-wrap">
              <table className="g-table">
                <thead><tr><th>Adresse</th><th>Nom</th><th>Rôle</th><th>État</th><th>Actions</th></tr></thead>
                <tbody>
                  {(users || []).map((u) => (
                    <tr key={u.id} style={u.actif ? undefined : { opacity: 0.6 }}>
                      <td>{u.email}{u.email === session?.user?.email ? ' (vous)' : ''}</td>
                      <td><b>{u.nom}</b></td>
                      <td>
                        {u.email === session?.user?.email ? (
                          <span className={`g-badge ${u.role === 'directeur' ? 'is-ok' : u.role === 'admin' ? 'is-info' : 'is-warn'}`}>
                            <i className="g-dot" />{TITRE_ROLE[u.role]}{u.multi_roles ? ' + au choix' : ''}
                          </span>
                        ) : (
                          <select
                            className="g-input"
                            style={{ minHeight: 30, padding: '2px 8px' }}
                            value={u.role}
                            onChange={(e) => void changerRole(u, e.target.value)}
                            title="Changer le rôle"
                          >
                            <option value="analyste">Analyste</option>
                            <option value="admin">Admin</option>
                            <option value="directeur">Directeur</option>
                          </select>
                        )}
                      </td>
                      <td>
                        <span className={`g-badge ${u.actif ? 'is-ok' : 'is-warn'}`}><i className="g-dot" />{u.actif ? 'Actif' : 'Suspendu'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {mdpPour?.id === u.id ? (
                            <>
                              <input
                                className="g-input"
                                type="password"
                                style={{ minHeight: 30, width: 150 }}
                                placeholder="Nouveau mot de passe"
                                value={mdpPour.valeur}
                                autoFocus
                                onChange={(e) => setMdpPour({ id: u.id, valeur: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') void changerMdp(u); if (e.key === 'Escape') setMdpPour(null); }}
                              />
                              <button type="button" className="g-btn g-btn--sm" onClick={() => void changerMdp(u)}>OK</button>
                              <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => setMdpPour(null)}>Annuler</button>
                            </>
                          ) : (
                            <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => setMdpPour({ id: u.id, valeur: '' })}>Mot de passe</button>
                          )}
                          <button
                            type="button"
                            className="g-btn g-btn--ghost g-btn--sm"
                            onClick={() => majUser(u.id, { actif: !u.actif }, u.actif ? `Compte ${u.email} suspendu — accès refusé à la connexion.` : `Compte ${u.email} réactivé.`)}
                          >
                            {u.actif ? 'Suspendre' : 'Réactiver'}
                          </button>
                          {u.email !== session?.user?.email && (
                            <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => supprimerUser(u)}>Supprimer</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users && users.length === 0 && (
                    <tr><td colSpan={5}>Aucun compte — exécutez supabase/migrations/002_pava_utilisateurs.sql.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--g-line, #e4e8f1)' }}>
              <p style={{ margin: '0 0 10px', fontSize: 12.5, fontWeight: 700 }}>Ajouter un utilisateur</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                <label style={{ flex: '1 1 180px', fontSize: 12, fontWeight: 700 }}>E-mail
                  <input className="g-input" style={{ marginTop: 4 }} value={nouveau.email} placeholder="prenom@videotron.com" onChange={(e) => setNouveau({ ...nouveau, email: e.target.value })} />
                </label>
                <label style={{ flex: '1 1 140px', fontSize: 12, fontWeight: 700 }}>Nom
                  <input className="g-input" style={{ marginTop: 4 }} value={nouveau.nom} placeholder="Prénom Nom" onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} />
                </label>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Rôle
                  <select className="g-input" style={{ marginTop: 4 }} value={nouveau.role} onChange={(e) => setNouveau({ ...nouveau, role: e.target.value })}>
                    <option value="analyste">Analyste</option>
                    <option value="admin">Admin</option>
                    <option value="directeur">Directeur</option>
                  </select>
                </label>
                <label style={{ flex: '1 1 150px', fontSize: 12, fontWeight: 700 }}>Mot de passe (≥ 6)
                  <input className="g-input" style={{ marginTop: 4 }} type="password" value={nouveau.motDePasse} onChange={(e) => setNouveau({ ...nouveau, motDePasse: e.target.value })} />
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, fontWeight: 700, paddingBottom: 8 }}>
                  <input type="checkbox" checked={nouveau.multiRoles} onChange={(e) => setNouveau({ ...nouveau, multiRoles: e.target.checked })} />
                  Multi-rôles
                </label>
                <button type="button" className="g-btn" onClick={creerUser}>Créer</button>
              </div>
              {msgUsers && <p style={{ marginTop: 10, fontSize: 13 }}><b>{msgUsers}</b></p>}
            </div>
          </>
        ) : (
          <div className="g-table-wrap">
            <table className="g-table">
              <thead><tr><th>Adresse</th><th>Nom</th><th>Rôle</th><th>Droits</th></tr></thead>
              <tbody>
                <tr><td>jawad@acx.ma</td><td><b>Jawad</b></td><td><span className="g-badge is-info"><i className="g-dot" />Analyste · Admin · Directeur (au choix)</span></td><td style={{ fontSize: 12.5 }}>{DROITS.admin}</td></tr>
                <tr><td>ghita.khalil@videotron.com</td><td><b>Ghita Khalil</b></td><td><span className="g-badge is-warn"><i className="g-dot" />Analyste</span></td><td style={{ fontSize: 12.5 }}>{DROITS.analyste}</td></tr>
                <tr><td>marzouk.ousmane@videotron.com</td><td><b>Marzouk Ousmane</b></td><td><span className="g-badge is-ok"><i className="g-dot" />Directeur</span></td><td style={{ fontSize: 12.5 }}>{DROITS.directeur}</td></tr>
              </tbody>
            </table>
            {!EST_MODE_DB && <p style={{ marginTop: 10, fontSize: 12.5 }}>Mode démo : comptes en code (src/lib/pava-users.ts), mot de passe non vérifié.</p>}
          </div>
        )}
      </section>
    </>
  );
}

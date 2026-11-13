'use client';

/**
 * Administration PAVA — accès, comptes et stockage.
 * Comptes en base (pava_utilisateurs) : l'Admin peut ajouter des
 * utilisateurs, changer les mots de passe, désactiver ou supprimer.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { getPavaState, subscribePava, setPavaRole, reinitialiserDemo, EST_MODE_DB, type Role } from '@/lib/pava-store';
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
  const gestionActive = EST_MODE_DB && role === 'admin';

  const chargerUsers = useCallback(async () => {
    try {
      const r = await fetch('/api/pava/utilisateurs');
      const d = await r.json();
      if (!r.ok) { setMsgUsers(d.error || 'Chargement impossible.'); setUsers([]); return; }
      setUsers(d.utilisateurs || []);
      setMsgUsers('');
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
    const mdp = prompt(`Nouveau mot de passe pour ${u.email} (6 caractères minimum) :`);
    if (!mdp) return;
    await majUser(u.id, { motDePasse: mdp }, `Mot de passe de ${u.email} changé.`);
  };

  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Administration</h1>
          <p className="g-lead">Rôles et accès. L&apos;Analyste importe et analyse sans voir les montants finaux.</p>
        </div>
      </header>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Compte connecté</h3>
            <p className="g-card-sub">Le rôle est attribué par l&apos;adresse e-mail de connexion.</p>
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
            <h3 className="g-card-title">Stockage des données</h3>
            <p className="g-card-sub">Où sont enregistrées les commandes, lignes et décisions.</p>
          </div>
          <span className={`g-badge ${EST_MODE_DB ? 'is-ok' : 'is-warn'}`}>
            <i className="g-dot" />{EST_MODE_DB ? 'Base de données Supabase' : 'Mode démo (navigateur)'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>
          {EST_MODE_DB ? (
            <>Les données sont enregistrées dans Supabase (base <b>flow</b>, tables <b>pava_*</b>) via les routes API du serveur.</>
          ) : (
            <>Les données restent dans <b>ce navigateur</b> (localStorage) — rien n&apos;est envoyé à Supabase.
            Créez <b>.env.local</b> avec <b>NEXT_PUBLIC_SUPABASE_URL</b> et <b>SUPABASE_SERVICE_ROLE_KEY</b> puis relancez le serveur.</>
          )}
        </p>
        {!EST_MODE_DB && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              className="g-btn g-btn--ghost"
              onClick={() => {
                if (!confirm('Effacer les données démo de ce navigateur (Facture Septembre, Octobre, imports test) ?')) return;
                reinitialiserDemo();
              }}
            >
              Effacer les données démo
            </button>
          </div>
        )}
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Comptes utilisateurs</h3>
            <p className="g-card-sub">
              {EST_MODE_DB
                ? 'Gérés dans la table pava_utilisateurs — ajoutez des comptes, changez les mots de passe, désactivez un accès.'
                : 'En mode base, les comptes seront gérables ici (table pava_utilisateurs).'}
            </p>
          </div>
        </div>

        {gestionActive ? (
          <>
            <div className="g-table-wrap">
              <table className="g-table">
                <thead><tr><th>Adresse</th><th>Nom</th><th>Rôle</th><th>État</th><th>Actions</th></tr></thead>
                <tbody>
                  {(users || []).map((u) => (
                    <tr key={u.id}>
                      <td>{u.email}{u.email === session?.user?.email ? ' (vous)' : ''}</td>
                      <td><b>{u.nom}</b></td>
                      <td>
                        <span className={`g-badge ${u.role === 'directeur' ? 'is-ok' : u.role === 'admin' ? 'is-info' : 'is-warn'}`}>
                          <i className="g-dot" />{TITRE_ROLE[u.role]}{u.multi_roles ? ' + au choix' : ''}
                        </span>
                      </td>
                      <td>{u.actif ? 'Actif' : 'Désactivé'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => changerMdp(u)}>Mot de passe</button>
                          <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => majUser(u.id, { actif: !u.actif }, u.actif ? 'Compte désactivé.' : 'Compte réactivé.')}>
                            {u.actif ? 'Désactiver' : 'Réactiver'}
                          </button>
                          {u.email !== session?.user?.email && (
                            <button type="button" className="g-btn g-btn--ghost g-btn--sm" onClick={() => supprimerUser(u)}>Supprimer</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users && users.length === 0 && (
                    <tr><td colSpan={5}>Aucun compte — la table pava_utilisateurs est vide (exécutez supabase/migrations/002_pava_utilisateurs.sql).</td></tr>
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

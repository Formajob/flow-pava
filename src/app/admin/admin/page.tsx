'use client';

/**
 * Administration PAVA — accès et comptes.
 * Compte multi-rôles (jawad@acx.ma) : sélection du rôle Analyste / Admin /
 * Directeur. Les autres adresses ont un rôle fixe ( Analyste sans montants,
 * Directeur validation finale).
 */

import { useSyncExternalStore } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { getPavaState, subscribePava, setPavaRole, reinitialiserDemo, EST_MODE_DB, type Role } from '@/lib/pava-store';
import { UTILISATEURS_PAVA, TITRE_ROLE, type PavaRole } from '@/lib/pava-users';

const DROITS: Record<string, string[]> = {
  admin: ['Importer et analyser', 'Voir tous les montants', 'Corriger les lignes', 'Modifier le Price Plan', 'Valider (1er niveau)'],
  analyste: ['Importer et analyser', 'Montants masqués', 'Signaler les incohérences', 'Aucune validation'],
  directeur: ['Tout voir', 'Valider définitivement (Directeur)', 'Suppression interdite après validation'],
};

export default function AdminPage() {
  const snap = useSyncExternalStore(subscribePava, getPavaState, getPavaState);
  const { data: session } = useSession();
  const role = snap.role;
  const rolesAutorises = (session?.user?.roles as PavaRole[] | undefined) || [];
  const multiRoles = rolesAutorises.length > 1;

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
                    <button
                      key={r}
                      type="button"
                      className={`g-btn ${role === r ? '' : 'g-btn--ghost'}`}
                      onClick={() => setPavaRole(r as Role)}
                    >
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
            <>
              Les données restent dans <b>ce navigateur</b> (localStorage) — rien n&apos;est envoyé à Supabase.
              Créez <b>.env.local</b> avec <b>NEXT_PUBLIC_SUPABASE_URL</b> et <b>SUPABASE_SERVICE_ROLE_KEY</b> puis relancez le serveur.
            </>
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
        <div className="g-card-foot">
          <span>Test rapide : <b>/api/pava/state</b> doit renvoyer les commandes en mode base</span>
          <span>{EST_MODE_DB ? 'Connecté' : 'Non configuré'}</span>
        </div>
      </section>

      <section className="g-card g-glass g-rise">
        <div className="g-card-head">
          <div>
            <h3 className="g-card-title">Comptes autorisés</h3>
            <p className="g-card-sub">Seules ces adresses peuvent se connecter à la plateforme.</p>
          </div>
        </div>
        <div className="g-table-wrap">
          <table className="g-table">
            <thead><tr><th>Adresse</th><th>Nom</th><th>Rôle</th><th>Droits</th></tr></thead>
            <tbody>
              {UTILISATEURS_PAVA.map((u) => (
                <tr key={u.email}>
                  <td>{u.email}</td>
                  <td><b>{u.nom}</b></td>
                  <td>
                    {u.roles.length > 1 ? (
                      <span className="g-badge is-info"><i className="g-dot" />Analyste · Admin · Directeur (au choix)</span>
                    ) : (
                      <span className={`g-badge ${u.role === 'directeur' ? 'is-ok' : u.role === 'admin' ? 'is-info' : 'is-warn'}`}>
                        <i className="g-dot" />{TITRE_ROLE[u.role]}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{DROITS[u.role].join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="g-card-foot">
          <span>Mot de passe : non vérifié en démo (à brancher sur la base)</span>
          <span>Validation mensuelle : Admin puis Directeur</span>
        </div>
      </section>
    </>
  );
}

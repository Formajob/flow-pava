'use client'
// SIGNATURE-LOGIN: lg-autonome-v6

/**
 * Page de connexion — autonome.
 *
 * Tout le style est ici, préfixé `lg-` : la page ne dépend d'aucune autre
 * feuille (ni globals.css, ni glass.css) ni d'aucun composant de marque.
 * C'est volontaire : elle doit s'afficher pareil quel que soit l'état du reste
 * du projet. Les seules dépendances sont React, next-auth et next/navigation.
 */

import { Suspense, useEffect, useState, FormEvent, ChangeEvent } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <>
      {/* Marqueur lisible par un simple curl : present des le HTML serveur,
          meme quand le formulaire est en attente d'hydratation. */}
      <meta name="acx-login" content="lg-autonome-v6" />
      <Suspense
        fallback={
          <div
            style={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#eef2fb',
              fontFamily: 'Inter,system-ui,sans-serif',
              color: '#54658a',
              fontSize: 13,
              letterSpacing: '.04em',
            }}
          >
            Chargement…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const fromFlow = searchParams.get('from') === 'flow'

  useEffect(() => {
    const prefilled = searchParams.get('email')
    if (prefilled && prefilled.includes('@')) setEmail(prefilled.trim().toLowerCase())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (status === 'authenticated') router.replace('/admin')
  }, [status, router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const result = await signIn('credentials', { email, password, redirect: false })
      if (result?.error) {
        setError('Identifiants incorrects. Vérifiez votre adresse et votre mot de passe.')
        setIsLoading(false)
        return
      }
      router.replace('/admin')
    } catch {
      setError('Connexion impossible pour le moment. Réessayez.')
      setIsLoading(false)
    }
  }

  return (
    <div className="lg">
      <style>{LG_CSS}</style>

      {/* ── colonne gauche ─────────────────────────────────────────── */}
      <section className="lg-left">
        <span className="lg-halo lg-halo-a" aria-hidden="true" />
        <span className="lg-halo lg-halo-b" aria-hidden="true" />
        <span className="lg-grid" aria-hidden="true" />

        <div className="lg-left-in">
          <div className="lg-brand">
            <span className="lg-word">ACX<em>Flow</em></span>
            <a className="lg-by" href="https://acx.ma/" target="_blank" rel="noreferrer">By ACX Maroc</a>
          </div>

          <div className="lg-pitch">
            <span className="lg-chip"><i /> Espace VL PAVA</span>
            <h1>Votre équipe.<br /><em>au même rythme.</em></h1>
            <p>
              Facturation mensuelle Videotron PAV Affaire — réception des fichiers, analyse des incohérences, validation Admin puis Directeur, génération des factures.
            </p>

            <div className="lg-tiles">
              <div><span>Réception</span><b>Import Excel · CSV · Analyse</b></div>
              <div><span>Analyse</span><b>Incohérences · Règles · Contrôle</b></div>
              <div><span>Factures</span><b>Validation · Excel · PDF</b></div>
            </div>
          </div>

          <p className="lg-copy">© 2026 ACX Maroc — Plateforme interne. Tous droits réservés.</p>
        </div>
      </section>

      {/* ── colonne droite ─────────────────────────────────────────── */}
      <section className="lg-right">
        <div className="lg-box">
          <div className="lg-mobile-brand">
            <span className="lg-word lg-word-dark">ACX<em>Flow</em></span>
            <a className="lg-by lg-by-dark" href="https://acx.ma/" target="_blank" rel="noreferrer">By ACX Maroc</a>
          </div>

          <div className="lg-card">
            <header>
              <h2>{fromFlow ? 'Espace VL PAVA' : 'Bienvenue'}</h2>
              <p>{fromFlow ? 'Saisissez votre mot de passe pour continuer.' : 'Connectez-vous à la plateforme ACX Flow.'}</p>
            </header>

            <form onSubmit={handleSubmit} noValidate>
              {error && <div className="lg-error" role="alert">{error}</div>}
              {fromFlow && (
                <div className="lg-note">
                  <span aria-hidden="true" />
                  E-mail validé par le portail Flow — il ne reste que votre mot de passe.
                </div>
              )}

              <label className="lg-field">
                <span>Email</span>
                <input
                  id="email"
                  type="email"
                  placeholder="nom@acx.ma"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  autoComplete="username"
                  disabled={isLoading}
                />
              </label>

              <label className="lg-field">
                <span>Mot de passe</span>
                <input
                  id="password"
                  type="password"
                  placeholder="Entrez votre mot de passe"
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </label>

              <button type="submit" className="lg-submit" disabled={isLoading}>
                {isLoading ? 'Connexion…' : 'Se connecter'}
              </button>

              <p className="lg-help">
                Pas de compte ?{' '}
                <a href="mailto:support@acx.ma?subject=Demande%20de%20compte%20ACX%20Flow">Contactez l’administrateur</a>
              </p>

              <div className="lg-demo">
                <p>Accès démo</p>
                <div>
                  <Link href="/admin">Admin</Link>
                  <Link href="/admin">Analyste</Link>
                  <Link href="/admin">Directeur</Link>
                </div>
              </div>

              <p className="lg-ver">Login autonome · v6</p>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}

const LG_CSS = `
/* Filet de sécurité : si le projet laisse un fond décoratif fixe (.g-aurora),
   il peut repeindre par-dessus le formulaire. On l'éteint sur cette page. */
body:has(.lg) > .g-aurora,
body:has(.lg) .g-aurora{display:none!important}
.lg{
  /* le fond global .g-aurora (fixed, z-index 0) est un frère rendu après cette page :
     sans contexte d'empilement, il repeint PAR-DESSUS la carte du formulaire. */
  position:relative;z-index:50;isolation:isolate;
  display:grid;grid-template-columns:1.05fr 1fr;min-height:100vh;
  background:
    radial-gradient(circle at 78% 12%,rgba(124,58,237,.10),transparent 46%),
    radial-gradient(circle at 62% 88%,rgba(34,211,238,.12),transparent 48%),
    #eef2fb;
  font-family:Inter,ui-sans-serif,system-ui,"Segoe UI",Roboto,Arial,sans-serif;
  color:#0b1730;
}
.lg *{box-sizing:border-box}
.lg :where(h1,h2,p){margin:0}
.lg a{text-decoration:none;color:inherit}
.lg button{font:inherit;cursor:pointer;border:0}

/* colonne gauche */
.lg-left{position:relative;isolation:isolate;overflow:hidden;display:flex;padding:44px 52px;color:#fff;
  background:linear-gradient(155deg,#0b1330 0%,#0d1838 55%,#0a1228 100%)}
.lg-halo{position:absolute;border-radius:50%;filter:blur(60px);pointer-events:none;z-index:0}
.lg-halo-a{width:520px;height:520px;top:-200px;right:-140px;background:radial-gradient(circle,rgba(124,58,237,.55),transparent 68%)}
.lg-halo-b{width:460px;height:460px;bottom:-220px;left:-160px;background:radial-gradient(circle,rgba(34,211,238,.45),transparent 68%)}
.lg-grid{position:absolute;inset:0;z-index:0;opacity:.32;pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);
  background-size:42px 42px}
.lg-left-in{position:relative;z-index:1;display:flex;flex-direction:column;width:100%;gap:20px}
.lg-brand{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.lg-word{font-size:26px;font-weight:800;letter-spacing:-.03em;line-height:1;color:#fff}
.lg-word em{font-style:normal;background:linear-gradient(100deg,#67e8f9,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}
.lg-word-dark{color:#0b1330}
.lg-by{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  color:#c3cee4;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:4px 10px}
.lg-by-dark{color:#54658a;border-color:rgba(15,35,80,.16)}
.lg-pitch{margin:auto 0;max-width:520px;padding:28px 0}
.lg-chip{display:inline-flex;align-items:center;gap:9px;padding:7px 14px;border-radius:999px;
  border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);
  font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#d7e0f4}
.lg-chip i{width:7px;height:7px;border-radius:50%;background:#26d4ea;box-shadow:0 0 0 5px rgba(38,212,234,.16)}
.lg-pitch h1{margin-top:22px;font-size:clamp(30px,3.6vw,50px);line-height:1.07;letter-spacing:-.045em;font-weight:800;color:#fff}
.lg-pitch h1 em{font-style:normal;background:linear-gradient(100deg,#67e8f9,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent}
.lg-pitch p{margin-top:18px;max-width:440px;font-size:14px;line-height:1.6;color:#9eb0cc}
.lg-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:30px;max-width:470px}
.lg-tiles div{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:16px;padding:14px}
.lg-tiles span{display:block;font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#26d4ea}
.lg-tiles b{display:block;margin-top:6px;font-size:11.5px;line-height:1.45;font-weight:500;color:#c3cee4}
.lg-copy{font-size:11px;color:#7f90ae}

/* colonne droite */
.lg-right{display:flex;align-items:center;justify-content:center;padding:44px 24px}
.lg-box{width:100%;max-width:430px}
.lg-mobile-brand{display:none;flex-direction:column;align-items:center;gap:8px;margin-bottom:20px}
.lg-card{
  padding:30px 28px 26px;border-radius:24px;
  background:#fff;border:1px solid rgba(15,35,80,.10);
  box-shadow:0 30px 70px -34px rgba(23,49,110,.45),0 2px 6px rgba(23,49,110,.06);
}
.lg-card header h2{font-size:25px;letter-spacing:-.035em;font-weight:800;color:#0b1730}
.lg-card header p{margin-top:6px;font-size:13px;color:#54658a}
.lg-card form{display:block}
.lg-error{margin-top:16px;padding:10px 12px;border-radius:12px;font-size:12.5px;font-weight:650;
  background:rgba(225,29,72,.08);color:#be123c;border:1px solid rgba(225,29,72,.2)}
.lg-note{display:flex;align-items:center;gap:10px;margin-top:16px;padding:11px 13px;border-radius:12px;
  font-size:12.5px;color:#6d28d9;background:rgba(124,58,237,.07);border:1px solid rgba(124,58,237,.18)}
.lg-note span{width:7px;height:7px;border-radius:50%;background:#7c3aed;box-shadow:0 0 0 4px rgba(124,58,237,.14);flex:0 0 7px}
.lg-field{display:block;margin-top:16px}
.lg-field > span{display:block;margin-bottom:7px;font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#5b6b8c}
.lg .lg-field input{
  display:block;width:100%;height:46px;padding:0 14px;
  border:1px solid rgba(15,35,80,.18);border-radius:12px;
  background:#fff;color:#0b1730;font-size:13.5px;font-weight:600;
  outline:none;transition:border-color .2s,box-shadow .2s;
}
.lg .lg-field input::placeholder{color:#93a2bd;font-weight:500}
.lg .lg-field input:hover{border-color:rgba(37,99,235,.45)}
.lg .lg-field input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.16)}
.lg .lg-field input:disabled{background:#f1f5fb;color:#7b8aa6}
.lg .lg-submit{
  display:flex;align-items:center;justify-content:center;
  width:100%;height:46px;margin-top:22px;border-radius:999px;
  background:linear-gradient(100deg,#3b82f6,#22d3ee);
  color:#fff;font-size:14px;font-weight:750;letter-spacing:-.005em;
  box-shadow:0 16px 30px -18px rgba(37,99,235,.85);
  transition:transform .18s,filter .18s;
}
.lg .lg-submit:hover{transform:translateY(-1px);filter:brightness(1.05)}
.lg .lg-submit:disabled{opacity:.75;cursor:progress;transform:none}
.lg-help{margin-top:14px;text-align:center;font-size:12.5px;color:#54658a}
.lg .lg-help a{color:#7c3aed;font-weight:750}
.lg .lg-help a:hover{text-decoration:underline;text-underline-offset:3px}
.lg-demo{margin-top:22px;padding-top:18px;border-top:1px solid rgba(15,35,80,.08)}
.lg-demo p{text-align:center;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8290ab;margin-bottom:10px}
.lg-demo div{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.lg .lg-demo a{display:flex;align-items:center;justify-content:center;height:38px;border-radius:11px;
  border:1px solid rgba(15,35,80,.16);background:#fff;color:#0b1730;font-size:12px;font-weight:700;transition:.2s}
.lg .lg-demo a:hover{border-color:#2563eb;color:#1d4ed8}
.lg-ver{margin-top:14px;text-align:center;font-size:10px;letter-spacing:.06em;color:#a4b0c6}

@media (max-width:980px){
  .lg{grid-template-columns:1fr}
  .lg-left{display:none}
  .lg-right{padding:28px 18px;min-height:100vh}
  .lg-mobile-brand{display:flex}
}
@media (max-width:420px){
  .lg-card{padding:22px 18px 20px;border-radius:20px}
  .lg-card header h2{font-size:22px}
}
`

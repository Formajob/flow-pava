/**
 * Identité visible ACX Flow.
 *
 * Trois déclinaisons du logo sont disponibles dans /public, toutes générées
 * par scripts/build-logo-variants.mjs à partir du logo canonique embarqué
 * dans le portail Flow (flow.acx.ma) :
 *   - acx-flow-logo.png              → fond blanc, surfaces claires
 *   - acx-flow-logo-transparent.png  → fond transparent, surfaces claires
 *   - acx-flow-logo-light.png        → monochrome blanc, surfaces sombres
 *
 * Le logo canonique mesure 1549×234 (ratio 6.62:1). La version initialement
 * présente dans le dépôt (1774×887) contenait un énorme padding blanc qui
 * réduisait le logo à ~80px à l'affichage.
 *
 * La balise « By ACX Maroc » est un élément séparé, cliquable vers acx.ma
 * (ce n'est pas un texte incrusté dans l'image).
 */
export type FlowLogoVariant = 'dark' | 'light'

/** Sources des déclinaisons, résolues statiquement par Next.js. */
const LOGO_SOURCES: Record<FlowLogoVariant, string> = {
  dark: '/acx-flow-logo-transparent.png',
  light: '/acx-flow-logo-light.png',
}

export function FlowLogo({
  className = '',
  variant = 'dark',
  height = 40,
}: {
  className?: string
  /** `light` pour les fonds sombres (navy Flow), `dark` pour les fonds clairs. */
  variant?: FlowLogoVariant
  /** Hauteur affichée en px ; la largeur suit le ratio intrinsèque (6.62:1). */
  height?: number
}) {
  return (
    <img
      src={LOGO_SOURCES[variant]}
      alt="ACX Flow"
      className={`flow-logo ${className}`}
      style={{ '--flow-logo-height': `${height}px` } as React.CSSProperties}
    />
  )
}

export function FlowTag({
  className = '',
  variant = 'dark',
}: {
  className?: string
  variant?: FlowLogoVariant
}) {
  return (
    <a
      href="https://acx.ma/"
      target="_blank"
      rel="noopener noreferrer"
      className={`flow-tag ${variant === 'light' ? 'flow-tag-light' : ''} ${className}`}
    >
      By ACX Maroc
    </a>
  )
}

/** Logo + balise, alignés horizontalement. */
export function FlowBrand({
  className = '',
  variant = 'dark',
  height = 32,
}: {
  className?: string
  variant?: FlowLogoVariant
  height?: number
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <FlowLogo variant={variant} height={height} />
      <FlowTag variant={variant} />
    </div>
  )
}

/** Nom de produit affiché, à côté du logo dans les en-têtes. */
export function FlowName({ className = '' }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight text-[#18213b] dark:text-white ${className}`}>
      ACX Flow
    </span>
  )
}

/**
 * Bannière Flow.
 *
 * Bandeau d'en-tête reprenant la signature visuelle du portail
 * flow.acx.ma : fond navy, halos aurora violet/cyan, trame de grille
 * technique et titre en dégradé Flow (cyan → violet).
 *
 * Utilisation :
 *
 *   <FlowBanner title="Tableau de bord" subtitle="Bon retour, Marie">
 *     <Button>Action</Button>
 *   </FlowBanner>
 */
export function FlowBanner({
  title,
  subtitle,
  chip,
  icon,
  actions,
  children,
  className = '',
}: {
  /** Titre principal, affiché en dégradé Flow. */
  title: React.ReactNode
  /** Sous-titre en gris bleuté. */
  subtitle?: React.ReactNode
  /** Libellé de la pastille d'état (ex. « Espace VD »). */
  chip?: string
  /** Icône affichée à gauche du titre. */
  icon?: React.ReactNode
  /** Actions alignées à droite du bandeau. */
  actions?: React.ReactNode
  /** Contenu additionnel sous le titre (statistiques, filtres…). */
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={`flow-banner px-6 py-7 sm:px-8 sm:py-8 ${className}`}
    >
      {/* Halos Flow, identiques au portail flow.acx.ma */}
      <div className="flow-aurora flow-aurora-violet -top-40 -right-20 h-[420px] w-[420px]" />
      <div className="flow-aurora flow-aurora-cyan -bottom-44 -left-16 h-[360px] w-[360px]" />

      {/* Trame technique */}
      <div className="flow-banner-grid" />

      <div className="flow-banner-content flex flex-col gap-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {chip && (
              <span className="flow-banner-chip">
                <span className="h-[7px] w-[7px] rounded-full bg-[#26d4ea] shadow-[0_0_0_5px_rgba(38,212,234,0.14)]" />
                {chip}
              </span>
            )}
            <h1 className="mt-4 flex items-center gap-3 text-3xl font-extrabold tracking-tight sm:text-4xl flow-banner-title">
              {icon && (
                <span className="shrink-0 text-[#26d4ea]">{icon}</span>
              )}
              <span className="min-w-0">{title}</span>
            </h1>
            {subtitle && (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9eb0cc]">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              {actions}
            </div>
          )}
        </div>
        {children}
      </div>
    </header>
  )
}

export default FlowBrand

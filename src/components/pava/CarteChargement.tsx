'use client';

/**
 * Carte de progression animée — affichée pendant que les données
 * se chargent (état de la base, puis lignes de la commande consultée),
 * pour que la page ne reste jamais « bloquée » sans explication.
 */
export default function CarteChargement({
  titre = 'Chargement des données…',
  texte = 'Récupération depuis la base Supabase — cela peut prendre quelques secondes pour une facture mensuelle.',
}: {
  titre?: string;
  texte?: string;
}) {
  return (
    <section className="g-card g-glass g-rise" role="status" aria-live="polite">
      <div className="g-card-head">
        <div>
          <h3 className="g-card-title">{titre}</h3>
          <p className="g-card-sub">{texte}</p>
        </div>
        <span className="g-loadspin" aria-hidden="true" />
      </div>
      <div className="g-loadbar" aria-hidden="true">
        <i />
      </div>
    </section>
  );
}

'use client';

/**
 * Règles PAVA — Price Plan et exceptions (même logique que la démo).
 */

export default function ReglesPage() {
  return (
    <>
      <header className="g-top g-rise">
        <div>
          <div className="g-kicker"><i /> VL · PAVA Affaire</div>
          <h1>Règles</h1>
          <p className="g-lead">Price Plan et règles de facturation. Les règles sont dictées par l&apos;utilisateur dans la conversation.</p>
        </div>
      </header>

      <section className="g-grid-2">
        <article className="g-card g-glass g-rise">
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Price Plan — AJOUT</h3>
              <p className="g-card-sub">Prix unitaires par produit.</p>
            </div>
          </div>
          <ul className="g-list">
            <li><div className="g-list-item"><span className="g-list-main"><b>Internet 400 mb/s · Giga</b><span>300 $</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>Internet 200 mb/s</b><span>250 $</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>Internet 100 mb/s</b><span>200 $</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>Internet 15 mb/s</b><span>150 $</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>TPC 60 mois · TMO</b><span>150 $</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>TPC 36 mois · TV · TIPN</b><span>100 $</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>Renouvellement</b><span>65 $</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>Ajout Wifi-Pro</b><span>50 $</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>Ajout Redondance</b><span>40 $</span></span></div></li>
          </ul>
        </article>

        <article className="g-card g-glass g-rise">
          <div className="g-card-head">
            <div>
              <h3 className="g-card-title">Exceptions</h3>
              <p className="g-card-sub">Règles particulières validées.</p>
            </div>
          </div>
          <ul className="g-list">
            <li><div className="g-list-item"><span className="g-list-main"><b>Internet 500 au prix du 400</b><span>300 $</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>TPC sans engagement / 12 / 24 mois au prix du TPC 36 mois</b><span>100 $</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>Sources 45 et 41 incluses en plus de 43</b><span>Sources</span></span></div></li>
            <li><div className="g-list-item"><span className="g-list-main"><b>SACA = source 07 (ventes SAC Affaire)</b><span>Payé à la vente</span></span></div></li>
          </ul>
        </article>
      </section>
    </>
  );
}

export default function TermsContentFR() {
  return (
    <div className="prose dark:prose-invert max-w-none">
      <p className="text-xs text-white/60 mb-4 drop-shadow">
        Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
      </p>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          1. Acceptation des CGV
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          En utilisant FitMyCV.io et en effectuant un achat de crédits ou en souscrivant à un abonnement, vous acceptez sans réserve les présentes Conditions Générales de Vente (CGV).
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services payants.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          2. Description des services
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          FitMyCV.io propose deux types de services payants :
        </p>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          2.1. Crédits (paiements ponctuels)
        </h3>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Les crédits permettent d'utiliser les fonctionnalités premium de manière ponctuelle. Un crédit = une utilisation d'une fonctionnalité premium. Les crédits n'ont pas de date d'expiration et restent valables tant que votre compte est actif.
        </p>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          2.2. Abonnements (paiements récurrents)
        </h3>
        <p className="text-sm text-white/90 drop-shadow">
          Les abonnements donnent accès à un nombre défini d'utilisations mensuelles selon le plan choisi (Gratuit, Pro, Premium). Les limites d'utilisation sont réinitialisées à chaque période de facturation.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          3. Tarifs et paiements
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Tous les prix sont affichés en euros (<strong>TTC</strong>) et incluent toutes les taxes applicables en vigueur.
        </p>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Les paiements sont sécurisés par <strong>Stripe</strong> et acceptent les cartes bancaires, Apple Pay, Google Pay et d'autres moyens de paiement selon votre localisation.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          Les abonnements sont renouvelés automatiquement à la fin de chaque période (mensuelle ou annuelle) sauf annulation de votre part.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          4. Droit de rétractation (14 jours)
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Conformément à la législation française sur la protection des consommateurs, vous disposez d'un <strong>délai de rétractation de 14 jours</strong> à compter de votre achat ou souscription, <strong>à condition de ne pas avoir utilisé le service</strong>.
        </p>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Si vous avez utilisé des crédits ou généré des CV durant cette période, le droit de rétractation est <strong>caduc</strong> et aucun remboursement ne sera effectué.
        </p>
        <div className="mt-3 p-3 bg-orange-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            <strong>Important :</strong> Pour exercer votre droit de rétractation, contactez-nous à l'adresse email ci-dessous <strong>avant toute utilisation du service</strong>.
          </p>
        </div>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          5. Politique de remboursement
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          <strong>Aucun remboursement</strong> n'est effectué une fois le service utilisé (génération de CV, utilisation de crédits, etc.).
        </p>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          En cas de problème technique empêchant l'utilisation du service, contactez notre support. Nous étudierons votre cas au cas par cas.
        </p>
        <div className="mt-3 p-3 bg-red-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            <strong>Aucun remboursement :</strong> Tout achat est définitif après utilisation du service. En effectuant un achat, vous reconnaissez avoir pris connaissance de cette clause et l'accepter.
          </p>
        </div>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          6. Chargebacks et litiges bancaires
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          En cas de <strong>chargeback</strong> (contestation de paiement auprès de votre banque) après utilisation du service :
        </p>
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow">
          <li><strong>Pour les crédits :</strong> Le montant des crédits contestés sera retiré de votre balance, qui peut devenir négative. Vous devrez recharger votre compte pour continuer à utiliser le service.</li>
          <li><strong>Pour les abonnements :</strong> Votre abonnement sera immédiatement annulé et vous serez rétrogradé vers le plan Gratuit.</li>
        </ul>
        <div className="mt-3 p-3 bg-orange-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            <strong>Attention :</strong> Les chargebacks abusifs peuvent entraîner la suspension définitive de votre compte.
          </p>
        </div>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          7. Modification et annulation d'abonnement
        </h2>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          7.1. Upgrade d'abonnement
        </h3>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Vous pouvez upgrader votre abonnement à tout moment (Ex: Gratuit → Pro, Mensuel → Annuel). Le montant sera calculé au prorata du temps restant sur votre période actuelle. Le nouveau cycle de facturation commence immédiatement.
        </p>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          7.2. Downgrade d'abonnement
        </h3>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Vous pouvez downgrader votre abonnement (Ex: Premium → Pro). Le changement prendra effet à la <strong>prochaine date de facturation</strong> sans remboursement du prorata pour la période en cours.
        </p>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          <strong>Restriction :</strong> Le downgrade d'un abonnement annuel vers un abonnement mensuel n'est pas autorisé. Vous devez annuler votre abonnement annuel puis souscrire un nouvel abonnement mensuel après expiration.
        </p>

        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          7.3. Annulation d'abonnement
        </h3>
        <p className="text-sm text-white/90 drop-shadow">
          Vous pouvez annuler votre abonnement à tout moment depuis votre compte. L'annulation prend effet à la <strong>fin de la période de facturation en cours</strong>. Vous conservez l'accès aux fonctionnalités premium jusqu'à cette date.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          8. Propriété intellectuelle
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Les CV que vous créez via FitMyCV.io vous appartiennent. Vous conservez tous les droits sur le contenu que vous fournissez.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          L'interface, le code source, les algorithmes et tous les éléments de FitMyCV.io sont la propriété exclusive de l'éditeur et sont protégés par le droit d'auteur.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          9. Limitation de responsabilité
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          FitMyCV.io s'efforce de fournir un service de qualité mais ne garantit pas :
        </p>
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow">
          <li>L'absence d'interruptions ou d'erreurs techniques</li>
          <li>La compatibilité des CV générés avec tous les systèmes ATS (Applicant Tracking Systems)</li>
          <li>L'obtention d'un entretien ou d'un emploi suite à l'utilisation du service</li>
        </ul>
        <p className="text-sm text-white/90 mt-2 drop-shadow">
          Notre responsabilité est limitée au montant que vous avez payé pour le service au cours des 12 derniers mois.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          10. Modification des CGV
        </h2>
        <p className="text-sm text-white/90 drop-shadow">
          Nous nous réservons le droit de modifier ces CGV à tout moment. Les modifications seront publiées sur cette page avec la date de mise à jour. La poursuite de l'utilisation du service après modification vaut acceptation des nouvelles conditions.
        </p>
      </section>

      <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          11. Droit applicable et juridiction
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Les présentes CGV sont régies par le <strong>droit français</strong>.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          En cas de litige, et après tentative de résolution amiable, les tribunaux de <strong>Paris</strong> seront seuls compétents.
        </p>
      </section>

      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          12. Informations légales
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Éditeur du service FitMyCV.io :
        </p>
        <div className="mt-3 p-3 bg-sky-500/20 backdrop-blur-sm rounded">
          <p className="text-white drop-shadow space-y-1">
            <strong>Nom :</strong> [À compléter]<br />
            <strong>Statut :</strong> Micro-entreprise<br />
            <strong>SIRET :</strong> [À compléter]<br />
            <strong>Adresse :</strong> [À compléter]<br />
            <strong>Email :</strong> [À compléter]
          </p>
        </div>
        <div className="mt-3 p-3 bg-emerald-500/20 backdrop-blur-sm rounded">
          <p className="text-sm text-white drop-shadow">
            Pour toute question concernant ces CGV, contactez-nous à l'adresse email ci-dessus.
          </p>
        </div>
      </section>
    </div>
  );
}

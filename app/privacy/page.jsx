export const metadata = {
  title: 'Politique de confidentialité - CV Builder',
  description: 'Politique de confidentialité et protection des données personnelles',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">
        Politique de confidentialité
      </h1>

      <div className="prose dark:prose-invert max-w-none">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            1. Introduction
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            La présente politique de confidentialité décrit comment CV Builder collecte, utilise, stocke et protège vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD) et à la législation française en vigueur.
          </p>
          <p className="text-gray-700 dark:text-gray-300">
            Nous nous engageons à protéger votre vie privée et à traiter vos données personnelles de manière transparente, sécurisée et conforme aux réglementations applicables.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            2. Responsable du traitement
          </h2>
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-700 dark:text-gray-300">
              <strong>Responsable du traitement :</strong> CV Builder<br />
              <strong>Contact :</strong> [À compléter avec votre adresse email]
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            3. Données collectées
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Nous collectons les données suivantes :
          </p>

          <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
            3.1. Données d'identification
          </h3>
          <ul className="list-disc list-inside mb-4 text-gray-700 dark:text-gray-300 space-y-2">
            <li>Nom complet</li>
            <li>Adresse email</li>
            <li>Mot de passe (chiffré)</li>
            <li>Photo de profil (si fournie via OAuth)</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
            3.2. Données de CV
          </h3>
          <ul className="list-disc list-inside mb-4 text-gray-700 dark:text-gray-300 space-y-2">
            <li>Informations professionnelles (expériences, formations, compétences)</li>
            <li>Coordonnées de contact (téléphone, adresse, liens professionnels)</li>
            <li>Documents uploadés (CV PDF, offres d'emploi)</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
            3.3. Données de connexion
          </h3>
          <ul className="list-disc list-inside mb-4 text-gray-700 dark:text-gray-300 space-y-2">
            <li>Adresse IP</li>
            <li>Type de navigateur</li>
            <li>Pages visitées et temps passé</li>
            <li>Données de session</li>
          </ul>

          <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">
            3.4. Cookies
          </h3>
          <p className="text-gray-700 dark:text-gray-300">
            Consultez notre <a href="/cookies" className="text-blue-600 dark:text-blue-400 underline">page de gestion des cookies</a> pour plus de détails.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            4. Finalités du traitement
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Vos données sont utilisées pour les finalités suivantes :
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li><strong>Gestion du compte utilisateur</strong> : création, authentification, gestion de votre profil</li>
            <li><strong>Fourniture du service</strong> : création, stockage et génération de CV personnalisés</li>
            <li><strong>Amélioration du service</strong> : analyse d'utilisation, correction de bugs, développement de nouvelles fonctionnalités</li>
            <li><strong>Communication</strong> : notifications de service, support utilisateur, réponse aux retours</li>
            <li><strong>Sécurité</strong> : prévention de la fraude, détection d'abus, protection des données</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            5. Base légale du traitement
          </h2>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li><strong>Exécution du contrat</strong> : fourniture du service de création de CV</li>
            <li><strong>Consentement</strong> : cookies non nécessaires, newsletters (si applicable)</li>
            <li><strong>Intérêt légitime</strong> : amélioration du service, sécurité</li>
            <li><strong>Obligation légale</strong> : conservation des données pour obligations fiscales</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            6. Durée de conservation
          </h2>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li><strong>Compte actif</strong> : tant que le compte existe</li>
            <li><strong>Compte supprimé</strong> : 30 jours après suppression (délai de rétractation)</li>
            <li><strong>Cookies de consentement</strong> : 6 mois</li>
            <li><strong>Cookies de session</strong> : 30 jours</li>
            <li><strong>Logs de connexion</strong> : 12 mois maximum</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            7. Partage des données
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Vos données personnelles ne sont <strong>jamais vendues</strong>. Elles peuvent être partagées uniquement avec :
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li><strong>Fournisseurs de services</strong> : hébergement (infrastructure cloud), authentification (NextAuth, OAuth providers), IA (OpenAI pour génération de CV)</li>
            <li><strong>Autorités légales</strong> : si requis par la loi ou pour protéger nos droits</li>
          </ul>

          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>⚠️ Important :</strong> Les données de vos CV sont envoyées à OpenAI (modèle GPT) pour génération et adaptation. OpenAI affirme ne pas utiliser les données des API pour entraîner ses modèles. Pour plus d'informations : <a href="https://openai.com/enterprise-privacy" target="_blank" rel="noopener noreferrer" className="underline">Politique de confidentialité OpenAI</a>
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            8. Sécurité des données
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Nous mettons en œuvre les mesures de sécurité suivantes :
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li><strong>Chiffrement</strong> : AES-256-GCM pour tous les CV stockés</li>
            <li><strong>HTTPS</strong> : communication sécurisée (SSL/TLS)</li>
            <li><strong>Hashage des mots de passe</strong> : bcrypt avec salt</li>
            <li><strong>Protection CSRF</strong> : tokens anti-falsification</li>
            <li><strong>Cookies sécurisés</strong> : HttpOnly, Secure, SameSite</li>
            <li><strong>Authentification sécurisée</strong> : JWT, session tokens</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            9. Vos droits (RGPD)
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Conformément au RGPD, vous disposez des droits suivants :
          </p>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li><strong>Droit d'accès</strong> : consulter vos données personnelles</li>
            <li><strong>Droit de rectification</strong> : corriger vos données inexactes</li>
            <li><strong>Droit à l'effacement</strong> : supprimer vos données ("droit à l'oubli")</li>
            <li><strong>Droit à la limitation</strong> : restreindre le traitement de vos données</li>
            <li><strong>Droit à la portabilité</strong> : récupérer vos données dans un format structuré</li>
            <li><strong>Droit d'opposition</strong> : vous opposer au traitement pour motif légitime</li>
            <li><strong>Droit de retirer votre consentement</strong> : à tout moment</li>
          </ul>

          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
            <p className="text-sm text-green-800 dark:text-green-300">
              Pour exercer vos droits, contactez-nous à : <strong>[email à compléter]</strong>
            </p>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            10. Transferts internationaux
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            Vos données peuvent être transférées et stockées en dehors de l'Union Européenne (notamment via OpenAI basé aux États-Unis). Ces transferts sont encadrés par des garanties appropriées (clauses contractuelles types, certifications).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            11. Modifications de la politique
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            Nous nous réservons le droit de modifier cette politique de confidentialité à tout moment. Les modifications seront publiées sur cette page avec la date de mise à jour. Nous vous encourageons à consulter régulièrement cette page.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            12. Réclamations
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés) :
          </p>
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <p className="text-gray-700 dark:text-gray-300">
              <strong>CNIL</strong><br />
              3 Place de Fontenoy - TSA 80715<br />
              75334 PARIS CEDEX 07<br />
              Téléphone : 01 53 73 22 22<br />
              Site web : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">www.cnil.fr</a>
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">
            13. Contact
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            Pour toute question concernant cette politique de confidentialité ou vos données personnelles, contactez-nous à :
          </p>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
            <p className="text-blue-800 dark:text-blue-300">
              <strong>📧 Email :</strong> [À compléter]<br />
              <strong>📍 Adresse :</strong> [À compléter]
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AboutContentFR() {
  return (
    <div className="prose dark:prose-invert max-w-none space-y-4">
      {/* Introduction */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Notre histoire
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          FitMyCV est n&eacute; d&apos;une frustration que beaucoup connaissent : passer des heures &agrave; adapter son CV pour chaque candidature. Reformuler, r&eacute;organiser, esp&eacute;rer que cette fois-ci, &ccedil;a passera les filtres des recruteurs...
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          On s&apos;est dit qu&apos;il devait y avoir une meilleure fa&ccedil;on de faire. Et si l&apos;IA pouvait nous aider &agrave; cr&eacute;er des CV vraiment adapt&eacute;s &agrave; chaque offre ?
        </p>
      </section>

      {/* Mission */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Notre mission
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Vous faire gagner du temps et vous donner les meilleures chances de d&eacute;crocher l&apos;entretien. Pas de CV g&eacute;n&eacute;rique envoy&eacute; &agrave; la cha&icirc;ne, mais un CV taill&eacute; sur mesure pour chaque opportunit&eacute;.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          Parce que chaque offre d&apos;emploi est unique, votre CV devrait l&apos;&ecirc;tre aussi.
        </p>
      </section>

      {/* Features */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Ce que FitMyCV peut faire pour vous
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#10024;</span>
              <h3 className="font-semibold text-white drop-shadow">G&eacute;n&eacute;ration intelligente</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              L&apos;IA analyse l&apos;offre d&apos;emploi et adapte votre CV pour mettre en avant les comp&eacute;tences recherch&eacute;es.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#127919;</span>
              <h3 className="font-semibold text-white drop-shadow">Score de compatibilit&eacute;</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Sachez instantan&eacute;ment si votre profil correspond &agrave; l&apos;offre avec un score d&eacute;taill&eacute;.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#127758;</span>
              <h3 className="font-semibold text-white drop-shadow">Multi-langues</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Traduisez votre CV en un clic. Fran&ccedil;ais, anglais, espagnol, allemand... &agrave; vous de choisir.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#9889;</span>
              <h3 className="font-semibold text-white drop-shadow">Optimis&eacute; ATS</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Passez les filtres automatiques des recruteurs gr&acirc;ce &agrave; un formatage adapt&eacute;.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#128202;</span>
              <h3 className="font-semibold text-white drop-shadow">Plusieurs niveaux d&apos;analyse</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Du rapide &agrave; l&apos;approfondi, choisissez le niveau d&apos;analyse qui vous convient selon vos besoins.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Comment &ccedil;a marche ?
        </h2>
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">Importez votre CV</h3>
              <p className="text-xs text-white/80 drop-shadow">
                Uploadez votre CV existant en PDF ou cr&eacute;ez-en un nouveau directement sur la plateforme.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              2
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">Collez l&apos;offre d&apos;emploi</h3>
              <p className="text-xs text-white/80 drop-shadow">
                Copiez-collez le texte de l&apos;offre qui vous int&eacute;resse. L&apos;IA va l&apos;analyser en d&eacute;tail.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              3
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">G&eacute;n&eacute;rez votre CV optimis&eacute;</h3>
              <p className="text-xs text-white/80 drop-shadow">
                En quelques secondes, obtenez un CV adapt&eacute; &agrave; l&apos;offre, pr&ecirc;t &agrave; &ecirc;tre t&eacute;l&eacute;charg&eacute; et envoy&eacute;.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Une question ?
        </h2>
        <p className="text-sm text-white/90 mb-3 drop-shadow">
          Notre &eacute;quipe est l&agrave; pour vous aider. N&apos;h&eacute;sitez pas &agrave; nous contacter !
        </p>
        <a
          href="mailto:contact@fitmycv.io"
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <span>&#9993;</span>
          contact@fitmycv.io
        </a>
        <div className="mt-4 pt-3 border-t border-white/20">
          <p className="text-xs text-white/60 drop-shadow">
            Consultez aussi nos{' '}
            <a href="/terms" className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              conditions d&apos;utilisation
            </a>
            {' '}et notre{' '}
            <a href="/privacy" className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              politique de confidentialit&eacute;
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

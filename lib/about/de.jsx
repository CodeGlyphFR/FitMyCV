export default function AboutContentDE() {
  return (
    <div className="prose dark:prose-invert max-w-none space-y-4">
      {/* Introduction */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Unsere Geschichte
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          FitMyCV entstand aus einer Frustration, die viele kennen: Stunden damit zu verbringen, den Lebenslauf f&uuml;r jede Bewerbung anzupassen. Umformulieren, neu organisieren, hoffen, dass es diesmal die Filter der Recruiter passiert...
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          Wir dachten, es muss einen besseren Weg geben. Was w&auml;re, wenn KI uns helfen k&ouml;nnte, Lebensl&auml;ufe zu erstellen, die wirklich auf jedes Stellenangebot zugeschnitten sind?
        </p>
      </section>

      {/* Mission */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Unsere Mission
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Zeit sparen und die besten Chancen auf das Vorstellungsgespr&auml;ch bieten. Kein generischer Lebenslauf, der massenhaft verschickt wird, sondern ein ma&szlig;geschneiderter CV f&uuml;r jede Gelegenheit.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          Denn jedes Stellenangebot ist einzigartig &ndash; dein Lebenslauf sollte es auch sein.
        </p>
      </section>

      {/* Features */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Was FitMyCV f&uuml;r dich tun kann
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#10024;</span>
              <h3 className="font-semibold text-white drop-shadow">Intelligente Generierung</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Die KI analysiert das Stellenangebot und passt deinen Lebenslauf an, um die gesuchten F&auml;higkeiten hervorzuheben.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#127919;</span>
              <h3 className="font-semibold text-white drop-shadow">Kompatibilit&auml;tsbewertung</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Erfahre sofort, ob dein Profil zur Stelle passt, mit einer detaillierten Bewertung.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#127758;</span>
              <h3 className="font-semibold text-white drop-shadow">Mehrsprachig</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              &Uuml;bersetze deinen Lebenslauf mit einem Klick. Franz&ouml;sisch, Englisch, Spanisch, Deutsch... du entscheidest.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#9889;</span>
              <h3 className="font-semibold text-white drop-shadow">ATS-optimiert</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Passiere automatische Recruiter-Filter dank angepasster Formatierung.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#128202;</span>
              <h3 className="font-semibold text-white drop-shadow">Mehrere Analyseebenen</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Von schnell bis tiefgehend &ndash; w&auml;hle die Analyseebene, die deinen Bed&uuml;rfnissen entspricht.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Wie funktioniert es?
        </h2>
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">Importiere deinen Lebenslauf</h3>
              <p className="text-xs text-white/80 drop-shadow">
                Lade deinen bestehenden Lebenslauf als PDF hoch oder erstelle einen neuen direkt auf der Plattform.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              2
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">F&uuml;ge das Stellenangebot ein</h3>
              <p className="text-xs text-white/80 drop-shadow">
                Kopiere den Text des Angebots, das dich interessiert. Die KI wird es im Detail analysieren.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              3
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">Generiere deinen optimierten Lebenslauf</h3>
              <p className="text-xs text-white/80 drop-shadow">
                In Sekunden erh&auml;ltst du einen auf die Stelle zugeschnittenen Lebenslauf, bereit zum Download und Versenden.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Fragen?
        </h2>
        <p className="text-sm text-white/90 mb-3 drop-shadow">
          Unser Team ist f&uuml;r dich da. Z&ouml;gere nicht, uns zu kontaktieren!
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
            Schau dir auch unsere{' '}
            <a href="/terms" className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              Nutzungsbedingungen
            </a>
            {' '}und unsere{' '}
            <a href="/privacy" className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              Datenschutzrichtlinie
            </a>
            {' '}an.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function AboutContentES() {
  return (
    <div className="prose dark:prose-invert max-w-none space-y-4">
      {/* Introduction */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Nuestra historia
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          FitMyCV naci&oacute; de una frustraci&oacute;n que muchos conocen: pasar horas adaptando el curr&iacute;culum para cada candidatura. Reformular, reorganizar, esperando que esta vez pase los filtros de los reclutadores...
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          Pensamos que deb&iacute;a haber una mejor manera. &iquest;Y si la IA pudiera ayudarnos a crear curr&iacute;culums realmente adaptados a cada oferta?
        </p>
      </section>

      {/* Mission */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Nuestra misi&oacute;n
        </h2>
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          Ahorrarte tiempo y darte las mejores oportunidades de conseguir esa entrevista. Nada de curr&iacute;culums gen&eacute;ricos enviados en masa, sino un CV a medida para cada oportunidad.
        </p>
        <p className="text-sm text-white/90 drop-shadow">
          Porque cada oferta de trabajo es &uacute;nica, tu curr&iacute;culum tambi&eacute;n deber&iacute;a serlo.
        </p>
      </section>

      {/* Features */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          Lo que FitMyCV puede hacer por ti
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#10024;</span>
              <h3 className="font-semibold text-white drop-shadow">Generaci&oacute;n inteligente</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              La IA analiza la oferta de empleo y adapta tu CV para destacar las habilidades buscadas.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#127919;</span>
              <h3 className="font-semibold text-white drop-shadow">Puntuaci&oacute;n de compatibilidad</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Sabe instant&aacute;neamente si tu perfil coincide con la oferta con una puntuaci&oacute;n detallada.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#127758;</span>
              <h3 className="font-semibold text-white drop-shadow">Multi-idioma</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Traduce tu CV en un clic. Franc&eacute;s, ingl&eacute;s, espa&ntilde;ol, alem&aacute;n... t&uacute; eliges.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#9889;</span>
              <h3 className="font-semibold text-white drop-shadow">Optimizado para ATS</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              Pasa los filtros autom&aacute;ticos de los reclutadores con un formato adecuado.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">&#128202;</span>
              <h3 className="font-semibold text-white drop-shadow">Varios niveles de an&aacute;lisis</h3>
            </div>
            <p className="text-xs text-white/80 drop-shadow">
              De r&aacute;pido a profundo, elige el nivel de an&aacute;lisis que se adapte a tus necesidades.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          &iquest;C&oacute;mo funciona?
        </h2>
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              1
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">Importa tu CV</h3>
              <p className="text-xs text-white/80 drop-shadow">
                Sube tu CV existente en PDF o crea uno nuevo directamente en la plataforma.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              2
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">Pega la oferta de empleo</h3>
              <p className="text-xs text-white/80 drop-shadow">
                Copia y pega el texto de la oferta que te interesa. La IA la analizar&aacute; en detalle.
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
              3
            </div>
            <div>
              <h3 className="font-semibold text-white drop-shadow">Genera tu CV optimizado</h3>
              <p className="text-xs text-white/80 drop-shadow">
                En segundos, obt&eacute;n un CV adaptado a la oferta, listo para descargar y enviar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          &iquest;Alguna pregunta?
        </h2>
        <p className="text-sm text-white/90 mb-3 drop-shadow">
          Nuestro equipo est&aacute; aqu&iacute; para ayudarte. &iexcl;No dudes en contactarnos!
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
            Consulta tambi&eacute;n nuestros{' '}
            <a href="/terms" className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              t&eacute;rminos de servicio
            </a>
            {' '}y nuestra{' '}
            <a href="/privacy" className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              pol&iacute;tica de privacidad
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

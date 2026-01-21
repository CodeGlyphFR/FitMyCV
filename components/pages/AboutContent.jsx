'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';

const ICONS = {
  sparkles: '\u2728',
  target: '\uD83C\uDFAF',
  globe: '\uD83C\uDF0E',
  bolt: '\u26A1',
  chart: '\uD83D\uDCCA',
};

export default function AboutContent() {
  const { t, language } = useLanguage();
  const about = t('about');

  if (!about || typeof about === 'string') {
    return null;
  }

  return (
    <div className="prose dark:prose-invert max-w-none space-y-4">
      {/* Story Section */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          {about.story?.title}
        </h2>
        {about.story?.paragraphs?.map((p, i) => (
          <p key={i} className={`text-sm text-white/90 drop-shadow ${i < about.story.paragraphs.length - 1 ? 'mb-2' : ''}`}>
            {p}
          </p>
        ))}
      </section>

      {/* Mission Section */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          {about.mission?.title}
        </h2>
        {about.mission?.paragraphs?.map((p, i) => (
          <p key={i} className={`text-sm text-white/90 drop-shadow ${i < about.mission.paragraphs.length - 1 ? 'mb-2' : ''}`}>
            {p}
          </p>
        ))}
      </section>

      {/* Features Section */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          {about.features?.title}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {about.features?.items?.map((feature, i) => (
            <div
              key={i}
              className={`bg-white/10 backdrop-blur-sm p-3 rounded-lg ${feature.fullWidth ? 'md:col-span-2' : ''}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{ICONS[feature.icon] || feature.icon}</span>
                <h3 className="font-semibold text-white drop-shadow">{feature.title}</h3>
              </div>
              <p className="text-xs text-white/80 drop-shadow">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works Section */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          {about.howItWorks?.title}
        </h2>
        <div className="space-y-3">
          {about.howItWorks?.steps?.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 bg-emerald-500/30 rounded-full flex items-center justify-center text-emerald-300 font-bold text-sm">
                {step.step}
              </div>
              <div>
                <h3 className="font-semibold text-white drop-shadow">{step.title}</h3>
                <p className="text-xs text-white/80 drop-shadow">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Section */}
      <section className="bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
        <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
          {about.contact?.title}
        </h2>
        <p className="text-sm text-white/90 mb-3 drop-shadow">
          {about.contact?.description}
        </p>
        <a
          href={`mailto:${about.contact?.email}`}
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <span>&#9993;</span>
          {about.contact?.email}
        </a>
        <div className="mt-4 pt-3 border-t border-white/20">
          <p className="text-xs text-white/60 drop-shadow">
            {about.contact?.linksPrefix}{' '}
            <a href="/terms" className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              {about.contact?.linksTerms}
            </a>
            {' '}{about.contact?.linksAnd}{' '}
            <a href="/privacy" className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              {about.contact?.linksPrivacy}
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}

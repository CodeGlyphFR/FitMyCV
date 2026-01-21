'use client';

import { useLanguage } from '@/lib/i18n/LanguageContext';

const HIGHLIGHT_VARIANTS = {
  warning: 'bg-orange-500/20',
  danger: 'bg-red-500/20',
  info: 'bg-sky-500/20',
  success: 'bg-emerald-500/20',
};

function ContentBlock({ item }) {
  switch (item.type) {
    case 'paragraph':
      return (
        <p className="text-sm text-white/90 mb-2 drop-shadow">
          {item.link ? (
            <a href={item.link} className="text-emerald-300 hover:text-emerald-200 underline transition-colors">
              {item.text}
            </a>
          ) : (
            item.text
          )}
        </p>
      );

    case 'subtitle':
      return (
        <h3 className="text-lg font-semibold mb-2 text-white drop-shadow">
          {item.text}
        </h3>
      );

    case 'list':
      return (
        <ul className="list-disc list-inside text-sm text-white/90 space-y-1 drop-shadow mb-2">
          {item.items?.map((listItem, i) => (
            <li key={i}>{listItem}</li>
          ))}
        </ul>
      );

    case 'highlight':
      return (
        <div className={`mt-3 p-3 ${HIGHLIGHT_VARIANTS[item.variant] || HIGHLIGHT_VARIANTS.info} backdrop-blur-sm rounded`}>
          <p className="text-sm text-white drop-shadow">
            {item.title && <strong>{item.title} </strong>}
            {item.text?.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < item.text.split('\n').length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>
      );

    case 'infobox':
      return (
        <div className="mt-3 p-3 bg-sky-500/20 backdrop-blur-sm rounded">
          <p className="text-white drop-shadow space-y-1">
            {item.text?.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < item.text.split('\n').length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>
      );

    default:
      return null;
  }
}

function LegalSection({ section }) {
  return (
    <section className="mb-4 bg-white/15 backdrop-blur-xl p-4 rounded-lg shadow-2xl">
      <h2 className="text-xl font-semibold mb-3 text-emerald-300 drop-shadow">
        {section.title}
      </h2>
      {section.content?.map((item, i) => (
        <ContentBlock key={i} item={item} />
      ))}
    </section>
  );
}

export default function LegalContent({ type }) {
  const { t, language } = useLanguage();
  const content = t(type);

  if (!content || typeof content === 'string' || !content.sections) {
    return null;
  }

  const isUntranslated = content._untranslated && language !== 'fr' && language !== 'en';

  return (
    <div className="prose dark:prose-invert max-w-none">
      {isUntranslated && (
        <div className="mb-4 p-3 bg-yellow-500/20 backdrop-blur-sm rounded-lg">
          <p className="text-sm text-yellow-200 drop-shadow">
            {language === 'es'
              ? 'Este contenido aún no está disponible en español. Se muestra en francés.'
              : 'Dieser Inhalt ist noch nicht auf Deutsch verfügbar. Er wird auf Französisch angezeigt.'}
          </p>
        </div>
      )}

      <p className="text-xs text-white/60 mb-4 drop-shadow">
        {t('legal.lastUpdated')} {new Date().toLocaleDateString(language === 'en' ? 'en-US' : language === 'de' ? 'de-DE' : language === 'es' ? 'es-ES' : 'fr-FR')}
      </p>

      {content.sections.map((section, i) => (
        <LegalSection key={section.id || i} section={section} />
      ))}
    </div>
  );
}

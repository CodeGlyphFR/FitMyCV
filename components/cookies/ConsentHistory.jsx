'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function ConsentHistory() {
  const { t } = useLanguage();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/consent/history');
      const data = await response.json();

      if (data.success) {
        setHistory(data.history);
      } else {
        setError(data.error || 'Erreur de chargement');
      }
    } catch (err) {
      setError('Impossible de charger l\'historique');
      console.error('[ConsentHistory] Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const locale = t('common.locale');
    return new Date(dateString).toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionLabel = (action) => {
    const labels = {
      created: 'Créé',
      updated: 'Modifié',
      revoked: 'Révoqué',
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    const colors = {
      created: 'bg-emerald-500/20 text-white',
      updated: 'bg-sky-500/20 text-white',
      revoked: 'bg-red-500/20 text-white',
    };
    return colors[action] || 'bg-white/20 text-white';
  };

  const getCategoryLabel = (key) => {
    const labels = {
      necessary: 'Nécessaires',
      functional: 'Fonctionnels',
      analytics: 'Analytiques',
      marketing: 'Marketing',
    };
    return labels[key] || key;
  };

  if (loading) {
    return (
      <div className="mt-8 p-6 bg-white/15 backdrop-blur-xl rounded-lg shadow-2xl">
        <div className="animate-pulse">
          <div className="h-6 bg-white/20 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-white/20 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 p-6 bg-red-500/20 backdrop-blur-xl rounded-lg">
        <p className="text-sm text-white drop-shadow">
          ⚠️ {error}
        </p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mt-8 p-6 bg-white/15 backdrop-blur-xl rounded-lg">
        <p className="text-sm text-white/90 drop-shadow">
          📝 Aucun historique de consentement disponible. Vos préférences futures seront enregistrées ici.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-white/15 backdrop-blur-xl rounded-lg shadow-2xl">
      <button
        onClick={() => {
          scrollPositionRef.current = window.scrollY;
          setExpanded(!expanded);
          // Restaurer la position après le re-render
          requestAnimationFrame(() => {
            window.scrollTo({ top: scrollPositionRef.current, behavior: 'instant' });
          });
        }}
        className="w-full flex items-center justify-between p-6 hover:bg-white/10 transition-all duration-200"
      >
        <div className="text-left">
          <h2 className="text-xl font-semibold text-emerald-300 mb-1 drop-shadow">
            📜 Historique de vos consentements
          </h2>
          <p className="text-sm text-white/70 drop-shadow">
            {history.length} enregistrement{history.length > 1 ? 's' : ''} • Conforme RGPD
          </p>
        </div>
        <svg
          className={`w-6 h-6 text-white/70 transition-transform drop-shadow ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          <div className="mt-4 space-y-3">
            {history.map((log, index) => (
              <div
                key={log.id}
                className="p-4 bg-white/10 backdrop-blur-sm rounded-lg"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={`inline-block text-xs px-2 py-1 rounded font-semibold drop-shadow ${getActionColor(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </div>
                  <span className="text-xs text-white/60 drop-shadow">
                    {formatDate(log.createdAt)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(log.preferences).filter(([key]) => key !== 'timestamp' && key !== 'version').map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`text-xs drop-shadow ${value ? 'text-emerald-300' : 'text-white/40'}`}>
                        {value ? '✓' : '✗'}
                      </span>
                      <span className="text-xs text-white/90 drop-shadow">
                        {getCategoryLabel(key)}
                      </span>
                    </div>
                  ))}
                </div>

                {log.userAgent && (
                  <div className="mt-2 pt-2">
                    <p className="text-xs text-white/60 truncate drop-shadow">
                      <span className="font-semibold">Navigateur :</span> {log.userAgent}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-emerald-500/20 backdrop-blur-sm rounded text-xs">
            <p className="text-white drop-shadow">
              <strong>ℹ️ Conformité RGPD :</strong> Cet historique prouve que vous avez donné (ou refusé) votre consentement de manière éclairée. Ces données sont conservées pour audit et peuvent être supprimées en supprimant votre compte.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

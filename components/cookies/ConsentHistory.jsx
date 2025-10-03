'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function ConsentHistory() {
  const { t } = useLanguage();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

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
      created: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      updated: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      revoked: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    };
    return colors[action] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
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
      <div className="mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-8 p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <p className="text-sm text-red-800 dark:text-red-300">
          ⚠️ {error}
        </p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          📝 Aucun historique de consentement disponible. Vos préférences futures seront enregistrées ici.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="text-left">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
            📜 Historique de vos consentements
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {history.length} enregistrement{history.length > 1 ? 's' : ''} • Conforme RGPD
          </p>
        </div>
        <svg
          className={`w-6 h-6 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
          <div className="mt-4 space-y-3">
            {history.map((log, index) => (
              <div
                key={log.id}
                className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className={`inline-block text-xs px-2 py-1 rounded font-semibold ${getActionColor(log.action)}`}>
                      {getActionLabel(log.action)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(log.createdAt)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(log.preferences).filter(([key]) => key !== 'timestamp' && key !== 'version').map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`text-xs ${value ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {value ? '✓' : '✗'}
                      </span>
                      <span className="text-xs text-gray-700 dark:text-gray-300">
                        {getCategoryLabel(key)}
                      </span>
                    </div>
                  ))}
                </div>

                {log.userAgent && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      <span className="font-semibold">Navigateur :</span> {log.userAgent}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
            <p className="text-blue-800 dark:text-blue-300">
              <strong>ℹ️ Conformité RGPD :</strong> Cet historique prouve que vous avez donné (ou refusé) votre consentement de manière éclairée. Ces données sont conservées pour audit et peuvent être supprimées en supprimant votre compte.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

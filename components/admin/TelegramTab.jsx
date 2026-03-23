'use client';

import { useState, useEffect } from 'react';
import { ToggleSwitch } from './ToggleSwitch';
import { Toast } from './Toast';

export function TelegramTab({ refreshKey }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState(null);

  // Form state
  const [enabled, setEnabled] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [notifySessionEnd, setNotifySessionEnd] = useState(false);
  const [notifyPayment, setNotifyPayment] = useState(false);

  // Visibility toggles for sensitive fields
  const [showToken, setShowToken] = useState(false);
  const [showChatId, setShowChatId] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [refreshKey]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/telegram');
      if (!res.ok) throw new Error('Erreur lors du chargement');
      const data = await res.json();
      setEnabled(data.telegram_enabled === '1' || data.telegram_enabled === 'true' || data.telegram_enabled === true);
      setBotToken(data.telegram_bot_token ?? '');
      setChatId(data.telegram_chat_id ?? '');
      setNotifySessionEnd(data.telegram_notify_session_end === '1' || data.telegram_notify_session_end === 'true' || data.telegram_notify_session_end === true);
      setNotifyPayment(data.telegram_notify_payment === '1' || data.telegram_notify_payment === 'true' || data.telegram_notify_payment === true);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_enabled: enabled ? '1' : '0',
          telegram_bot_token: botToken,
          telegram_chat_id: chatId,
          telegram_notify_session_end: notifySessionEnd ? '1' : '0',
          telegram_notify_payment: notifyPayment ? '1' : '0',
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }
      setToast({ type: 'success', message: 'Configuration Telegram enregistrée' });
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const res = await fetch('/api/admin/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_bot_token: botToken,
          telegram_chat_id: chatId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec du test');
      setToast({ type: 'success', message: 'Message de test envoyé avec succès !' });
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const canTest = botToken.trim() !== '' && chatId.trim() !== '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white/40"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-2xl">🤖</span>
              Configuration Telegram Bot
            </h2>
            <p className="text-white/50 text-sm mt-1">
              Recevez des notifications en temps réel sur Telegram pour les événements importants.
            </p>
          </div>
          <ToggleSwitch enabled={enabled} onChange={setEnabled} />
        </div>
      </div>

      {/* Bot Configuration */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 space-y-5">
        <h3 className="text-white font-medium text-sm uppercase tracking-wider">
          Identifiants du Bot
        </h3>

        {/* Helper text */}
        <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4">
          <p className="text-blue-300/80 text-sm">
            Pour créer un bot Telegram, ouvrez{' '}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline hover:text-blue-300 transition-colors"
            >
              @BotFather
            </a>{' '}
            sur Telegram et envoyez <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">/newbot</code>.
            Vous recevrez un token API. Pour obtenir votre Chat ID, envoyez un message à votre bot
            puis consultez{' '}
            <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs">
              https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
            </code>.
          </p>
        </div>

        {/* Bot Token */}
        <div>
          <label className="block text-white/70 text-sm font-medium mb-2">
            Token du Bot
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-colors text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              title={showToken ? 'Masquer' : 'Afficher'}
            >
              {showToken ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Chat ID */}
        <div>
          <label className="block text-white/70 text-sm font-medium mb-2">
            Chat ID
          </label>
          <div className="relative">
            <input
              type={showChatId ? 'text' : 'password'}
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-1001234567890"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-colors text-sm font-mono"
            />
            <button
              type="button"
              onClick={() => setShowChatId(!showChatId)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              title={showChatId ? 'Masquer' : 'Afficher'}
            >
              {showChatId ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Test Button */}
        <div>
          <button
            onClick={handleTest}
            disabled={!canTest || testing}
            className={`
              px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${canTest && !testing
                ? 'bg-blue-500/20 text-blue-400 border border-blue-400/30 hover:bg-blue-500/30 hover:border-blue-400/50 cursor-pointer'
                : 'bg-white/5 text-white/30 border border-white/10 cursor-not-allowed'
              }
            `}
          >
            {testing ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Envoi en cours...
              </span>
            ) : (
              'Tester la connexion'
            )}
          </button>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 space-y-5">
        <h3 className="text-white font-medium text-sm uppercase tracking-wider">
          Notifications
        </h3>

        <div className="space-y-4">
          {/* Session End Notification */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white text-sm font-medium">Fin de session de review</p>
              <p className="text-white/40 text-xs mt-0.5">
                Notification lorsqu'un utilisateur termine une session de review CV.
              </p>
            </div>
            <ToggleSwitch enabled={notifySessionEnd} onChange={setNotifySessionEnd} />
          </div>

          <div className="border-t border-white/5"></div>

          {/* Payment Notification */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white text-sm font-medium">Achat de credits</p>
              <p className="text-white/40 text-xs mt-0.5">
                Notification lorsqu'un utilisateur achete des credits.
              </p>
            </div>
            <ToggleSwitch enabled={notifyPayment} onChange={setNotifyPayment} />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`
            px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200
            ${saving
              ? 'bg-emerald-500/20 text-emerald-300/50 border border-emerald-400/20 cursor-not-allowed'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 hover:bg-emerald-500/30 hover:border-emerald-400/50 cursor-pointer'
            }
          `}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Enregistrement...
            </span>
          ) : (
            'Enregistrer'
          )}
        </button>
      </div>
    </div>
  );
}

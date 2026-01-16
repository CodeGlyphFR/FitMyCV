'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Test data for variable substitution
const TEST_DATA = {
  userName: 'Jean Dupont',
  verificationUrl: 'https://FitMyCV.io/auth/verify-email?token=test-token-123',
  resetUrl: 'https://FitMyCV.io/auth/reset-password?token=test-token-456',
  newEmail: 'nouveau.email@test.com',
};

/**
 * Substitute variables in HTML content
 */
function substituteVariables(html, variables) {
  if (!html) return '';
  let result = html;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
  }
  return result;
}

/**
 * EmailPreviewModal - Modal pour preview et test d'email
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Est-ce que le modal est ouvert
 * @param {Function} props.onClose - Callback pour fermer le modal
 * @param {string} props.htmlContent - Contenu HTML de l'email
 * @param {string} props.subject - Sujet de l'email
 * @param {string} props.templateId - ID du template pour l'envoi test
 * @param {Function} props.onTestSent - Callback apres envoi test reussi
 */
export function EmailPreviewModal({ isOpen, onClose, htmlContent, subject, templateId, onTestSent }) {
  const [viewMode, setViewMode] = useState('desktop'); // desktop | mobile
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Track mount state for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Substitute test variables
  const previewHtml = substituteVariables(htmlContent, TEST_DATA);
  const previewSubject = substituteVariables(subject, TEST_DATA);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMessage(null);
      setSending(false);
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleSendTest = async () => {
    if (!testEmail || !templateId) return;

    setSending(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/email-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, testEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Erreur lors de l\'envoi' });
        return;
      }

      setMessage({ type: 'success', text: `Email de test envoye a ${testEmail}` });
      if (onTestSent) onTestSent();
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur de connexion' });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-gray-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">Apercu de l'email</h2>
            <p className="text-sm text-white/60 mt-1">Sujet: {previewSubject}</p>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('desktop')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'desktop'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Desktop
            </button>
            <button
              onClick={() => setViewMode('mobile')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'mobile'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Mobile
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="ml-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 overflow-auto p-6 bg-gray-800/50 custom-scrollbar">
          <div
            className={`mx-auto rounded-lg shadow-lg transition-all duration-300 bg-white ${
              viewMode === 'mobile' ? 'w-[320px]' : 'max-w-[600px]'
            }`}
          >
            <iframe
              srcDoc={previewHtml}
              title="Email Preview"
              className="w-full h-[500px] border-0"
              sandbox="allow-same-origin"
              style={{ display: 'block' }}
            />
          </div>
        </div>

        {/* Test email section */}
        <div className="px-6 py-4 border-t border-white/10 bg-gray-900/80">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm text-white/60 mb-1">Envoyer un email de test</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-hidden focus:border-emerald-500/50"
              />
            </div>
            <button
              onClick={handleSendTest}
              disabled={!testEmail || !templateId || sending}
              className="mt-6 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Envoyer test
                </>
              )}
            </button>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mt-3 px-4 py-2 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Test data info */}
          <div className="mt-3 text-xs text-white/40">
            Variables de test: userName = "{TEST_DATA.userName}", verificationUrl, resetUrl, newEmail
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default EmailPreviewModal;

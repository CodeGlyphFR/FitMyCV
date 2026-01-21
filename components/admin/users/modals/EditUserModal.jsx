'use client';

import { useState, useEffect } from 'react';

/**
 * Modal for editing an existing user
 */
export function EditUserModal({ isOpen, onClose, onSubmit, user, updating }) {
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleClose = () => {
    setEmail('');
    onClose();
  };

  const handleSubmit = async () => {
    const success = await onSubmit(user.id, {
      email,
      hasOAuth: user.hasOAuth,
      currentEmail: user.email,
    });
    if (success) {
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-white mb-4">Éditer l'utilisateur</h3>

        <div className="space-y-4">
          <div>
            <label className="text-white/60 text-sm mb-2 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={user.hasOAuth}
              className={`w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition ${user.hasOAuth ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            {user.hasOAuth && (
              <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                <span>🔒</span>
                L'email ne peut pas être modifié pour un compte OAuth (géré par {user.oauthProviders?.join('/')})
              </p>
            )}
          </div>
        </div>

        <div className="text-xs text-white/40 bg-white/5 p-3 rounded-sm border border-white/10 mt-4 mb-4">
          <div>⚠️ La modification de l'email réinitialisera le statut de vérification.</div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={updating}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={updating}
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updating ? 'Modification...' : 'Modifier'}
          </button>
        </div>
      </div>
    </div>
  );
}

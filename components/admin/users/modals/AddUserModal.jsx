'use client';

import { useState } from 'react';
import { CustomSelect } from '../../CustomSelect';

/**
 * Modal for adding a new user
 */
export function AddUserModal({ isOpen, onClose, onSubmit, updating }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('USER');

  if (!isOpen) return null;

  const handleClose = () => {
    setEmail('');
    setName('');
    setPassword('');
    setRole('USER');
    onClose();
  };

  const handleSubmit = async () => {
    const success = await onSubmit({ email, name, password, role });
    if (success) {
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-white mb-4">Ajouter un utilisateur</h3>

        <div className="space-y-4">
          <div>
            <label className="text-white/60 text-sm mb-2 block">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
              placeholder="utilisateur@exemple.com"
            />
          </div>

          <div>
            <label className="text-white/60 text-sm mb-2 block">Nom complet *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="text-white/60 text-sm mb-2 block">Mot de passe *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-sm focus:outline-hidden focus:border-blue-400/50 transition"
              placeholder="Minimum 8 caractères"
            />
          </div>

          <div>
            <label className="text-white/60 text-sm mb-2 block">Rôle</label>
            <CustomSelect
              value={role}
              onChange={setRole}
              options={[
                { value: 'USER', label: 'USER' },
                { value: 'ADMIN', label: 'ADMIN' },
              ]}
            />
          </div>

          <div className="text-xs text-white/40 bg-white/5 p-3 rounded-sm border border-white/10">
            ℹ️ L'email sera automatiquement marqué comme vérifié.
          </div>
        </div>

        <div className="flex gap-3 mt-6">
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
            {updating ? 'Création...' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

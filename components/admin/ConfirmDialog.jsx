'use client';

import { createPortal } from 'react-dom';
import { useEffect } from 'react';

/**
 * Confirmation dialog component
 * Usage:
 * const [confirmDialog, setConfirmDialog] = useState(null);
 *
 * setConfirmDialog({
 *   title: 'Confirmer la suppression ?',
 *   message: 'Cette action est irréversible.',
 *   onConfirm: () => { ... },
 *   confirmText: 'Supprimer',
 *   cancelText: 'Annuler',
 *   type: 'danger' // or 'warning' or 'info'
 * });
 *
 * <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
 */
export function ConfirmDialog({ dialog, onClose }) {
  useEffect(() => {
    if (dialog) {
      // Prevent body scroll when dialog is open
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [dialog]);

  if (!dialog) return null;

  const handleConfirm = () => {
    dialog.onConfirm();
    onClose();
  };

  const styles = {
    danger: {
      icon: '⚠️',
      confirmBg: 'bg-red-500 hover:bg-red-600',
      confirmText: 'text-white',
    },
    warning: {
      icon: '⚠️',
      confirmBg: 'bg-orange-500 hover:bg-orange-600',
      confirmText: 'text-white',
    },
    info: {
      icon: 'ℹ️',
      confirmBg: 'bg-blue-500 hover:bg-blue-600',
      confirmText: 'text-white',
    },
  };

  const style = styles[dialog.type] || styles.info;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-gray-900/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl max-w-md w-full p-6 animate-scale-in">
        {/* Icon */}
        <div className="text-4xl mb-4 text-center">{style.icon}</div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-2 text-center">
          {dialog.title}
        </h3>

        {/* Message */}
        {dialog.message && (
          <p className="text-white/80 text-sm mb-6 text-center">
            {dialog.message}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition"
          >
            {dialog.cancelText || 'Annuler'}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 ${style.confirmBg} ${style.confirmText} rounded-lg text-sm font-medium transition`}
          >
            {dialog.confirmText || 'Confirmer'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

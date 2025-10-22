'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Toast notification component
 * Usage:
 * const [toast, setToast] = useState(null);
 *
 * setToast({ type: 'success', message: 'Success!' });
 * setToast({ type: 'error', message: 'Error!' });
 *
 * <Toast toast={toast} onClose={() => setToast(null)} />
 */
export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  const styles = {
    success: {
      bg: 'bg-green-500/20',
      border: 'border-green-500/50',
      text: 'text-green-400',
      icon: '✓',
    },
    error: {
      bg: 'bg-red-500/20',
      border: 'border-red-500/50',
      text: 'text-red-400',
      icon: '✕',
    },
    info: {
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/50',
      text: 'text-blue-400',
      icon: 'ℹ',
    },
  };

  const style = styles[toast.type] || styles.info;

  return createPortal(
    <div className="fixed top-4 right-4 z-[9999] animate-slide-in">
      <div
        className={`${style.bg} ${style.border} ${style.text} backdrop-blur-xl rounded-lg border px-4 py-3 shadow-lg max-w-md`}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">{style.icon}</span>
          <p className="text-sm font-medium flex-1">{toast.message}</p>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition ml-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

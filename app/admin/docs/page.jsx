'use client';

import { useEffect } from 'react';

export default function AdminDocsPage() {
  useEffect(() => {
    // Ouvrir la documentation dans un nouvel onglet et retourner au dashboard
    window.open('/api/admin/docs/index.html', '_blank');
    window.location.href = '/admin/analytics';
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-white/60 text-sm">Ouverture de la documentation...</span>
      </div>
    </div>
  );
}

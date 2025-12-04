'use client';

import dynamic from 'next/dynamic';

/**
 * Loading skeleton for the email editor
 */
function EmailEditorSkeleton() {
  return (
    <div className="w-full h-[600px] bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-white/60">Chargement de l'editeur...</p>
      </div>
    </div>
  );
}

/**
 * EmailEditor - Dynamic import of react-email-editor
 *
 * Note: refs don't work with dynamic imports in Next.js.
 * Use the onReady callback to capture the editor instance instead.
 * See: https://stackoverflow.com/questions/77020572
 */
const EmailEditor = dynamic(() => import('react-email-editor'), {
  ssr: false,
  loading: () => <EmailEditorSkeleton />,
});

export default EmailEditor;

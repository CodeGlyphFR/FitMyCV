'use client';

import { useRouter } from 'next/navigation';

export default function EmailVerificationError({ message }) {
  const router = useRouter();

  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full overflow-y-auto bg-[rgb(2,6,23)] flex items-start justify-center p-6 pt-12 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] ios-auth-container">
      <div className="relative z-10 w-full max-w-lg rounded-3xl border-2 border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl p-8 mt-12">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white drop-shadow-lg mb-2">
            Erreur de vérification
          </h1>
          <p className="text-sm text-slate-100 drop-shadow mb-6">
            {message}
          </p>
          <button
            onClick={() => router.push('/auth')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-6 rounded-lg transition-colors border border-emerald-500 shadow-md"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

/**
 * Page de connexion automatique après validation d'email
 * Reçoit un token en paramètre et se connecte automatiquement
 */
export default function CompleteSignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setError('Token manquant');
      return;
    }

    // Connexion automatique avec NextAuth
    const autoSignIn = async () => {
      try {
        setStatus('loading');

        // Utiliser NextAuth avec le token auto-signin
        const result = await signIn('credentials', {
          autoSignInToken: token,
          redirect: false,
        });

        if (result?.error) {
          console.error('[complete-signin] Erreur:', result.error);
          setStatus('error');
          setError('Token invalide ou expiré');
          return;
        }

        // Succès - rediriger vers la page principale
        setStatus('success');
        setTimeout(() => {
          router.replace('/');
          router.refresh();
        }, 1000);
      } catch (err) {
        console.error('[complete-signin] Exception:', err);
        setStatus('error');
        setError('Erreur lors de la connexion');
      }
    };

    autoSignIn();
  }, [searchParams, router]);

  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full overflow-hidden bg-slate-950 flex items-start justify-center p-6 pt-12 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Animated background blobs - same as AuthScreen */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-40 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-400/90 via-sky-500/70 to-transparent blur-2xl animate-auth-blob-fast"/>
        <div className="absolute top-[20%] right-[-140px] h-96 w-96 rounded-full bg-gradient-to-br from-sky-500/70 via-emerald-400/50 to-transparent blur-3xl animate-auth-blob animation-delay-1500"/>
        <div className="absolute bottom-[-180px] left-[10%] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-emerald-500/55 via-sky-400/35 to-transparent blur-[150px] animate-auth-blob-slow animation-delay-6000"/>
        <div className="absolute top-[55%] right-[15%] h-56 w-56 rounded-full bg-gradient-to-br from-sky-400/50 via-emerald-300/40 to-transparent blur-2xl animate-auth-blob-fast animation-delay-3000"/>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(126,207,244,0.25),_transparent_65%)]"/>
      </div>

      <div className="relative z-10 w-full max-w-lg rounded-3xl border-2 border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl p-8 mt-12">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600"></div>
              </div>
              <h1 className="text-2xl font-semibold text-white drop-shadow-lg mb-2">
                Connexion en cours...
              </h1>
              <p className="text-sm text-slate-100 drop-shadow">
                Veuillez patienter pendant que nous vous connectons.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-semibold text-white drop-shadow-lg mb-2">
                Email vérifié !
              </h1>
              <p className="text-sm text-slate-100 drop-shadow">
                Redirection en cours vers votre compte...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
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
                Erreur de connexion
              </h1>
              <p className="text-sm text-slate-100 drop-shadow mb-6">
                {error}
              </p>
              <button
                onClick={() => router.push('/auth')}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-6 rounded-lg transition-colors border border-emerald-500 shadow-md"
              >
                Retour à la connexion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

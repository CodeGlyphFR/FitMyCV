'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import AuthBackground from '@/components/auth/AuthBackground';

export default function VerifyEmailRequiredPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const isNewUser = searchParams.get('new') === 'true';

  const handleResendEmail = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Email envoyé ! Vérifiez votre boîte de réception.');
      } else {
        setError(data.error || 'Erreur lors de l\'envoi de l\'email');
      }
    } catch (err) {
      setError('Erreur de connexion');
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/auth' });
  };

  return (
    <>
      <AuthBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-lg">
          <div className="rounded-3xl border-2 border-white/30 bg-white/15 backdrop-blur-xl shadow-2xl p-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-white drop-shadow-lg">
            {isNewUser ? 'Bienvenue !' : 'Vérifiez votre email'}
          </h1>

          <p className="text-sm text-slate-100 drop-shadow">
            {isNewUser
              ? 'Votre compte a été créé avec succès ! Pour accéder à la plateforme, vérifiez votre adresse email.'
              : 'Pour accéder à votre compte, vous devez d\'abord vérifier votre adresse email.'
            }
          </p>
        </div>

        {session?.user?.email && (
          <div className="bg-emerald-500/20 border border-emerald-400/50 rounded-lg p-4 backdrop-blur-sm">
            <p className="text-sm text-white drop-shadow">
              <strong>Email :</strong> {session.user.email}
            </p>
          </div>
        )}

        <div className="space-y-4">
          <p className="text-sm text-slate-100 drop-shadow">
            Un email de vérification a été envoyé à votre adresse. Cliquez sur le lien dans l'email pour activer votre compte.
          </p>

          {message && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">{message}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <button
            onClick={handleResendEmail}
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-500 shadow-md"
          >
            {loading ? 'Envoi en cours...' : 'Renvoyer l\'email'}
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-white/20 hover:bg-white/30 text-white font-medium py-3 px-4 rounded-lg transition-colors border border-white/30 backdrop-blur-sm"
          >
            Se déconnecter
          </button>
        </div>

        <div className="pt-4 border-t border-white/30">
          <p className="text-xs text-slate-200 text-center drop-shadow">
            Si vous ne recevez pas l'email, vérifiez votre dossier spam ou cliquez sur "Renvoyer l'email".
          </p>
        </div>
        </div>
        </div>
      </div>
    </>
  );
}

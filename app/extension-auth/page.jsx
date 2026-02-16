'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ExtensionAuthPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [state, setState] = useState('loading'); // loading | success | error

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/auth?callbackUrl=/extension-auth');
      return;
    }

    // Authenticated — fetch extension token
    async function fetchToken() {
      try {
        const res = await fetch('/api/auth/extension-token/from-session');
        const data = await res.json();

        if (!data.success) {
          setState('error');
          return;
        }

        // Send token to the extension content script via postMessage
        window.postMessage({
          type: 'FITMYCV_EXTENSION_AUTH',
          token: data.token,
          user: data.user,
        }, window.location.origin);

        setState('success');
      } catch {
        setState('error');
      }
    }

    fetchToken();
  }, [status, router]);

  if (status === 'loading' || state === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.text}>Connexion en cours...</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={{ ...styles.text, color: '#f87171' }}>
            Erreur lors de la connexion. Veuillez réessayer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.checkmark}>&#10003;</div>
        <h2 style={styles.title}>Connexion réussie !</h2>
        <p style={styles.text}>
          Votre extension FitMyCV est maintenant connectée.
          Vous pouvez fermer cet onglet.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'rgb(2, 6, 23)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    textAlign: 'center',
    padding: '40px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    maxWidth: '400px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(255, 255, 255, 0.15)',
    borderTopColor: '#10b981',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px',
  },
  checkmark: {
    fontSize: '48px',
    color: '#10b981',
    marginBottom: '16px',
  },
  title: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: '20px',
    marginBottom: '8px',
  },
  text: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '14px',
  },
};

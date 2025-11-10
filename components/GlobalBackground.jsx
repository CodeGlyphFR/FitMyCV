'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Composant qui applique un background animé sur toutes les pages SAUF /auth
 * Utilise le même style que AuthBackground mais conditionnel
 */
export default function GlobalBackground() {
  const pathname = usePathname();
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);
  }, []);

  // Ne pas afficher sur les pages d'auth
  if (pathname?.startsWith('/auth')) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[rgb(2,6,23)]">
      {/* Blobs animés - Version desktop (plus d'opacité) */}
      {!isIOS && (
        <>
          <div className="absolute -top-32 -left-40 h-80 w-80 rounded-full bg-gradient-to-br from-emerald-400/90 via-sky-500/70 to-transparent blur-2xl animate-auth-blob-fast" />
          <div className="absolute top-[20%] right-[-140px] h-96 w-96 rounded-full bg-gradient-to-br from-sky-500/70 via-emerald-400/50 to-transparent blur-3xl animate-auth-blob animation-delay-1500" />
          <div className="absolute bottom-[-180px] left-[10%] h-[420px] w-[420px] rounded-full bg-gradient-to-br from-emerald-500/55 via-sky-400/35 to-transparent blur-[150px] animate-auth-blob-slow animation-delay-6000" />
          <div className="absolute top-[55%] right-[15%] h-56 w-56 rounded-full bg-gradient-to-br from-sky-400/50 via-emerald-300/40 to-transparent blur-2xl animate-auth-blob-fast animation-delay-3000" />
        </>
      )}

      {/* Blobs animés - Version iOS (opacité réduite pour performance) */}
      {isIOS && (
        <>
          <div className="absolute -top-20 -left-32 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-400/25 via-sky-500/15 to-transparent blur-2xl animate-auth-blob-fast" />
          <div className="absolute top-[10%] right-[-100px] h-[22rem] w-[22rem] rounded-full bg-gradient-to-br from-sky-500/20 via-emerald-400/12 to-transparent blur-2xl animate-auth-blob animation-delay-1500" />
          <div className="absolute bottom-[-8rem] left-[8%] h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-emerald-500/18 via-sky-400/10 to-transparent blur-[150px] animate-auth-blob-slow animation-delay-6000" />
          <div className="absolute top-[45%] right-[12%] h-64 w-64 rounded-full bg-gradient-to-br from-sky-400/15 via-emerald-300/8 to-transparent blur-2xl animate-auth-blob-fast animation-delay-3000" />
          <div className="absolute bottom-[15%] right-[-4rem] h-[22rem] w-[22rem] rounded-full bg-gradient-to-br from-sky-500/20 via-emerald-400/12 to-transparent blur-2xl animate-auth-blob animation-delay-1500" />
          <div className="absolute top-[25%] left-[-5rem] h-72 w-72 rounded-full bg-gradient-to-br from-emerald-400/18 via-sky-500/10 to-transparent blur-2xl animate-auth-blob-fast animation-delay-3000" />
        </>
      )}

      {/* Overlay radial */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(126,207,244,0.25),_transparent_65%)]" />
    </div>
  );
}

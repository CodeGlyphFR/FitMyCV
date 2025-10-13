'use client';

import { useEffect } from 'react';

/**
 * Composant qui applique un background animé sur le body pour les pages d'auth
 * Utilise le body pour contourner les limitations iOS Safari avec overflow-hidden
 */
export default function AuthBackground() {
  useEffect(() => {
    // Sauvegarder les styles originaux
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;

    // Créer le conteneur de background
    const bgContainer = document.createElement('div');
    bgContainer.id = 'auth-background-overlay';
    bgContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      min-height: -webkit-fill-available;
      background-color: rgb(2, 6, 23);
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    `;

    // Créer les blobs animés
    const blobs = [
      { top: '-8rem', left: '-10rem', width: '20rem', height: '20rem', colors: 'from-emerald-400/90 via-sky-500/70 to-transparent', animation: 'animate-auth-blob-fast', delay: '' },
      { top: '20%', right: '-140px', width: '24rem', height: '24rem', colors: 'from-sky-500/70 via-emerald-400/50 to-transparent', animation: 'animate-auth-blob', delay: 'animation-delay-1500' },
      { bottom: '-180px', left: '10%', width: '420px', height: '420px', colors: 'from-emerald-500/55 via-sky-400/35 to-transparent', animation: 'animate-auth-blob-slow', delay: 'animation-delay-6000' },
      { top: '55%', right: '15%', width: '14rem', height: '14rem', colors: 'from-sky-400/50 via-emerald-300/40 to-transparent', animation: 'animate-auth-blob-fast', delay: 'animation-delay-3000' },
    ];

    blobs.forEach((blob, index) => {
      const blobDiv = document.createElement('div');
      blobDiv.style.cssText = `
        position: absolute;
        ${blob.top ? `top: ${blob.top};` : ''}
        ${blob.bottom ? `bottom: ${blob.bottom};` : ''}
        ${blob.left ? `left: ${blob.left};` : ''}
        ${blob.right ? `right: ${blob.right};` : ''}
        width: ${blob.width};
        height: ${blob.height};
        border-radius: 9999px;
        background: linear-gradient(to bottom right, var(--tw-gradient-stops));
        filter: blur(${index === 2 ? '150px' : index === 1 ? '3rem' : '2rem'});
        will-change: transform, opacity;
      `;
      blobDiv.className = `bg-gradient-to-br ${blob.colors} ${blob.animation} ${blob.delay}`;
      bgContainer.appendChild(blobDiv);
    });

    // Ajouter l'overlay radial
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: radial-gradient(circle at top, rgba(126, 207, 244, 0.25), transparent 65%);
    `;
    bgContainer.appendChild(overlay);

    // Appliquer les styles pour iOS
    document.documentElement.style.height = '100%';
    document.documentElement.style.minHeight = '-webkit-fill-available';
    document.body.style.minHeight = '100vh';
    document.body.style.minHeight = '-webkit-fill-available';
    document.body.style.backgroundColor = 'rgb(2, 6, 23)';

    // Insérer en premier dans le body
    document.body.insertBefore(bgContainer, document.body.firstChild);

    // Cleanup au démontage
    return () => {
      document.body.style.cssText = originalBodyStyle;
      document.documentElement.style.cssText = originalHtmlStyle;
      const container = document.getElementById('auth-background-overlay');
      if (container) {
        container.remove();
      }
    };
  }, []);

  return null;
}

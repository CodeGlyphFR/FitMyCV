'use client';

import { useEffect } from 'react';

/**
 * Composant qui applique un background animé sur le body pour les pages d'auth
 * Approche spéciale pour iOS Safari qui gère correctement les barres UI
 */
export default function AuthBackground() {
  useEffect(() => {
    // Sauvegarder les styles originaux
    const originalBodyStyle = document.body.style.cssText;
    const originalHtmlStyle = document.documentElement.style.cssText;

    // Détecter iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Appliquer les styles de base sur html et body
    document.documentElement.style.cssText = `
      height: 100%;
      min-height: 100vh;
      min-height: -webkit-fill-available;
      background-color: rgb(2, 6, 23);
    `;

    document.body.style.cssText = `
      min-height: 100vh;
      min-height: -webkit-fill-available;
      background-color: rgb(2, 6, 23);
      position: relative;
      overflow-x: hidden;
    `;

    // Créer le conteneur de background - absolute au lieu de fixed pour iOS
    const bgContainer = document.createElement('div');
    bgContainer.id = 'auth-background-overlay';
    bgContainer.style.cssText = `
      position: absolute;
      top: -130px;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      min-height: calc(100vh + 130px);
      min-height: calc(100dvh + 130px);
      background-color: rgb(2, 6, 23);
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
    `;

    // Créer les blobs animés - Version optimisée pour iOS (moins de blobs, blur réduit, opacités basses)
    const blobs = isIOS ? [
      { top: '-5rem', left: '-8rem', width: '24rem', height: '24rem', colors: 'from-emerald-400/20 via-sky-500/12 to-transparent', animation: 'animate-auth-blob-fast', delay: '', blur: '40px' },
      { bottom: '-8rem', left: '8%', width: '28rem', height: '28rem', colors: 'from-emerald-500/15 via-sky-400/8 to-transparent', animation: 'animate-auth-blob-slow', delay: 'animation-delay-6000', blur: '50px' },
      { top: '45%', right: '12%', width: '16rem', height: '16rem', colors: 'from-sky-400/12 via-emerald-300/6 to-transparent', animation: 'animate-auth-blob-fast', delay: 'animation-delay-3000', blur: '35px' },
      { bottom: '15%', right: '-4rem', width: '22rem', height: '22rem', colors: 'from-sky-500/18 via-emerald-400/10 to-transparent', animation: 'animate-auth-blob', delay: 'animation-delay-1500', blur: '40px' },
    ] : [
      { top: '-8rem', left: '-10rem', width: '20rem', height: '20rem', colors: 'from-emerald-400/90 via-sky-500/70 to-transparent', animation: 'animate-auth-blob-fast', delay: '', blur: '48px' },
      { top: '20%', right: '-140px', width: '24rem', height: '24rem', colors: 'from-sky-500/70 via-emerald-400/50 to-transparent', animation: 'animate-auth-blob', delay: 'animation-delay-1500', blur: '48px' },
      { bottom: '-180px', left: '10%', width: '420px', height: '420px', colors: 'from-emerald-500/55 via-sky-400/35 to-transparent', animation: 'animate-auth-blob-slow', delay: 'animation-delay-6000', blur: '60px' },
      { top: '55%', right: '15%', width: '14rem', height: '14rem', colors: 'from-sky-400/50 via-emerald-300/40 to-transparent', animation: 'animate-auth-blob-fast', delay: 'animation-delay-3000', blur: '40px' },
    ];

    blobs.forEach((blob) => {
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
        filter: blur(${blob.blur});
        transform: translateZ(0);
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

    // Insérer en premier dans le body
    document.body.insertBefore(bgContainer, document.body.firstChild);

    // Sur iOS, modifier le positionnement des conteneurs auth
    if (isIOS) {
      // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
      requestAnimationFrame(() => {
        const authContainers = document.querySelectorAll('.ios-auth-container');
        authContainers.forEach(container => {
          container.style.alignItems = 'flex-start';
          container.style.paddingTop = '2rem';
          container.style.paddingBottom = '1rem';
          console.log('iOS: Formulaire repositionné en haut');
        });
      });
    }

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

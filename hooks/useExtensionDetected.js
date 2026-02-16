'use client';

import { useState, useEffect } from 'react';

/**
 * Détecte si l'extension navigateur FitMyCV est installée.
 *
 * Le content script (detector.js) pose un marqueur DOM
 * `document.documentElement.dataset.fitmycvExtension = 'true'`
 * et dispatch un CustomEvent 'fitmycv:extension-ready' sur les domaines FitMyCV.
 *
 * Ce hook vérifie l'attribut au mount, écoute l'event,
 * et fait 3 polls de sécurité (500ms, 1.5s, 3s) pour couvrir
 * le timing `document_idle` du content script.
 */
export function useExtensionDetected() {
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    // Vérification immédiate
    if (document.documentElement.dataset.fitmycvExtension === 'true') {
      setDetected(true);
      return;
    }

    // Écouter l'event dispatché par le content script
    function handleReady() {
      setDetected(true);
    }
    window.addEventListener('fitmycv:extension-ready', handleReady);

    // Polls de sécurité (content script chargé en document_idle)
    const delays = [500, 1500, 3000];
    const timers = delays.map((delay) =>
      setTimeout(() => {
        if (document.documentElement.dataset.fitmycvExtension === 'true') {
          setDetected(true);
        }
      }, delay)
    );

    return () => {
      window.removeEventListener('fitmycv:extension-ready', handleReady);
      timers.forEach(clearTimeout);
    };
  }, []);

  return detected;
}

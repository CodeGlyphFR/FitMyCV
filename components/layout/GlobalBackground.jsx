'use client';

/**
 * Background statique - Taille originale, SANS animation, SANS blur
 */
export default function GlobalBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* Base background */}
      <div className="absolute inset-0 bg-app-bg" />

      {/* Blob 1 - haut gauche (plus vers le centre) */}
      <div
        className="absolute rounded-full"
        style={{
          top: '-10%',
          left: '5%',
          width: '650px',
          height: '650px',
          background: 'radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%)',
        }}
      />

      {/* Blob 2 - droite (plus vers le centre et plus bas) */}
      <div
        className="absolute rounded-full"
        style={{
          top: '25%',
          right: '5%',
          width: '550px',
          height: '550px',
          background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)',
        }}
      />

      {/* Blob 3 - bas centre */}
      <div
        className="absolute rounded-full"
        style={{
          bottom: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
        }}
      />
    </div>
  );
}

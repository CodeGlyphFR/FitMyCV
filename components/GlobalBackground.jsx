'use client';

/**
 * Background animé optimisé pour les performances
 * - Desktop : animations CSS fluides (~6-8% CPU)
 * - Mobile : statique pour économiser la batterie (~0.4% CPU)
 * - Respecte prefers-reduced-motion
 */
export default function GlobalBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {/* Keyframes et media queries */}
      <style jsx>{`
        @keyframes float1 {
          0% { transform: translate(0, 0); }
          25% { transform: translate(10vw, 10vh); }
          50% { transform: translate(5vw, 20vh); }
          75% { transform: translate(15vw, 5vh); }
          100% { transform: translate(0, 0); }
        }
        @keyframes float2 {
          0% { transform: translate(0, 0); }
          25% { transform: translate(-10vw, 10vh); }
          50% { transform: translate(-5vw, 20vh); }
          75% { transform: translate(-15vw, 5vh); }
          100% { transform: translate(0, 0); }
        }
        @keyframes float3 {
          0% { transform: translate(0, 0); }
          25% { transform: translate(10vw, -10vh); }
          50% { transform: translate(-10vw, -5vh); }
          75% { transform: translate(5vw, -15vh); }
          100% { transform: translate(0, 0); }
        }

        .blob {
          will-change: transform;
        }

        .blob-1 { animation: float1 40s ease-in-out infinite; }
        .blob-2 { animation: float2 50s ease-in-out infinite; }
        .blob-3 { animation: float3 44s ease-in-out infinite; }

        /* Désactiver animations sur mobile et tablette */
        @media (max-width: 768px) {
          .blob-1, .blob-2, .blob-3 {
            animation: none;
          }
        }

        /* Respecter les préférences utilisateur */
        @media (prefers-reduced-motion: reduce) {
          .blob-1, .blob-2, .blob-3 {
            animation: none;
          }
        }
      `}</style>

      {/* Base background */}
      <div className="absolute inset-0 bg-app-bg" />

      {/* Blob 1 - haut gauche */}
      <div
        className="blob blob-1 absolute rounded-full"
        style={{
          top: '-10%',
          left: '-10%',
          width: '650px',
          height: '650px',
          background: 'radial-gradient(circle, rgba(14,165,233,0.35) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Blob 2 - haut droite */}
      <div
        className="blob blob-2 absolute rounded-full"
        style={{
          top: '-5%',
          right: '-10%',
          width: '550px',
          height: '550px',
          background: 'radial-gradient(circle, rgba(56,189,248,0.3) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Blob 3 - bas centre */}
      <div
        className="blob blob-3 absolute rounded-full"
        style={{
          bottom: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  );
}

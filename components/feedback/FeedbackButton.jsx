"use client";
import React from "react";
import { usePathname } from "next/navigation";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const pathname = usePathname();

  // Masquer sur la page d'authentification
  if (pathname === "/auth") {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="
          no-print fixed bottom-6 left-[76px] z-50
          w-10 h-10 rounded-full
          bg-yellow-500/20 backdrop-blur-xl text-white
          shadow-2xl hover:shadow-xl
          flex items-center justify-center
          transition-all duration-300
          hover:scale-110 hover:bg-yellow-500/30
          focus:outline-none focus:ring-4 focus:ring-yellow-400/40
          pointer-events-auto
          border-2 border-yellow-400/30
          cursor-pointer
        "
        style={{
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitTransform: 'translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'transform'
        }}
        title="Donner votre avis"
        aria-label="Donner votre avis"
      >
        <span className="text-xl drop-shadow-lg">💬</span>
      </button>

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}

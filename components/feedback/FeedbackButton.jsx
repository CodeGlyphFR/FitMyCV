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
          no-print fixed bottom-6 left-1/2 z-50
          px-6 py-2 rounded-full
          bg-gold-gradient text-white
          shadow-lg hover:shadow-xl
          flex items-center gap-2
          transition-all duration-200
          hover:scale-105
          focus:outline-none focus:ring-4 focus:ring-yellow-300
          animate-gold-shimmer
          bg-[length:200%_100%]
          pointer-events-auto
        "
        style={{
          transform: 'translateX(-50%) translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitTransform: 'translateX(-50%) translateZ(0)',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'transform'
        }}
        title="Donner votre avis"
        aria-label="Donner votre avis"
      >
        <span className="text-xl">💬</span>
        <span className="text-sm font-medium">Feedback</span>
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

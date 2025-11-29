"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { Lightbulb } from "lucide-react";
import FeedbackModal from "./FeedbackModal";
import { useSettings } from "@/lib/settings/SettingsContext";

export default function FeedbackButton() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const pathname = usePathname();
  const { settings } = useSettings();

  // Masquer sur les pages d'authentification et admin
  if (pathname === "/auth" || pathname?.startsWith("/admin")) {
    return null;
  }

  // Ne pas afficher si la feature est désactivée
  if (!settings.feature_feedback) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="
          no-print fixed bottom-6 left-[76px] z-50
          w-10 h-10 rounded-full
          bg-amber-500/20 backdrop-blur-xl text-white
          shadow-2xl hover:shadow-xl
          flex items-center justify-center
          transition-all duration-300
          hover:scale-110 hover:bg-amber-500/30
          focus:outline-none focus:ring-4 focus:ring-amber-400/40
          pointer-events-auto
          border-2 border-amber-500/30
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
        <Lightbulb className="w-5 h-5 text-amber-400 drop-shadow-lg" />
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

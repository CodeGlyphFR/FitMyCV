"use client";
import React from "react";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="
          no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-10
          px-6 py-3 rounded-full
          bg-blue-600 text-white
          shadow-lg hover:shadow-xl
          flex items-center gap-2
          transition-all duration-200
          hover:scale-105
          focus:outline-none focus:ring-4 focus:ring-blue-300
        "
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

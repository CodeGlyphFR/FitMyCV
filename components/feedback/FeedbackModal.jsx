"use client";
import React from "react";
import Modal from "../ui/Modal";
import StarRating from "./StarRating";
import { useNotifications } from "../notifications/NotificationProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function FeedbackModal({ isOpen, onClose }) {
  const { t } = useLanguage();
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [isBugReport, setIsBugReport] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { addNotification } = useNotifications();

  const handleSubmit = async () => {
    // Validation
    if (rating === 0) {
      addNotification({
        type: "error",
        message: t("feedback.errors.ratingRequired"),
        duration: 3000,
      });
      return;
    }

    if (comment.length > 500) {
      addNotification({
        type: "error",
        message: t("feedback.errors.commentTooLong"),
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Récupérer le CV actuel depuis le cookie
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      const currentCvFile = cvFileCookie ? decodeURIComponent(cvFileCookie.split('=')[1]) : null;

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim(),
          isBugReport,
          currentCvFile,
          userAgent: navigator.userAgent,
          pageUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi du feedback");
      }

      addNotification({
        type: "success",
        message: t("feedback.success"),
        duration: 4000,
      });

      // Réinitialiser le formulaire
      setRating(0);
      setComment("");
      setIsBugReport(false);
      onClose();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      addNotification({
        type: "error",
        message: error.message,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRating(0);
      setComment("");
      setIsBugReport(false);
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose} title={t("feedback.title")}>
      <div className="space-y-6">
        {/* Section notation */}
        <div className="flex flex-col items-center gap-2">
          <label className="text-sm font-medium text-gray-700">
            {t("feedback.ratingLabel")}
          </label>
          <StarRating rating={rating} setRating={setRating} />
        </div>

        {/* Section commentaire avec bouton bug */}
        <div className="relative">
          <label className="text-sm font-medium text-gray-700 block mb-2">
            {t("feedback.commentLabel")}
          </label>
          <div className="relative">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("feedback.commentPlaceholder")}
              className="w-full h-32 px-3 py-2 pr-14 pb-12 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={500}
            />

            {/* Bouton bug en bas à droite du textarea */}
            <button
              type="button"
              onClick={() => setIsBugReport(!isBugReport)}
              className={`
                absolute right-2 bottom-3
                w-9 h-9 rounded-full
                flex items-center justify-center
                transition-all duration-200
                hover:scale-110
                ${isBugReport
                  ? 'bg-red-100 shadow-md'
                  : 'bg-gray-100'
                }
              `}
              title={isBugReport ? t("feedback.markedAsBug") : t("feedback.markAsBug")}
            >
              <span className={`text-lg ${isBugReport ? '' : 'grayscale opacity-50'}`}>
                🐛
              </span>
            </button>
          </div>

          {/* Compteur de caractères */}
          <div className="flex justify-between items-center mt-1">
            <span className={`text-xs ${comment.length > 500 ? 'text-red-500' : 'text-gray-500'}`}>
              {t("feedback.charactersCount", { count: comment.length })}
            </span>
            {isBugReport && (
              <span className="text-xs text-red-600 font-medium">
                🐛 {t("feedback.bugReportLabel")}
              </span>
            )}
          </div>
        </div>

        {/* Boutons d'action */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {t("feedback.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t("feedback.submitting") : t("feedback.submit")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

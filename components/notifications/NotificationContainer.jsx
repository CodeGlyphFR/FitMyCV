"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "./NotificationProvider";
import { useLanguage } from "@/lib/i18n/LanguageContext";

function NotificationItem({ notification, onRemove, t }) {
  const { id, type, message, isRemoving, redirectUrl, linkText } = notification;
  const router = useRouter();

  // Debug: vérifier si redirectUrl est présent
  console.log('[NotificationItem] notification:', { id, type, message, redirectUrl, linkText });

  const styles = {
    success: {
      bg: "bg-emerald-500/20 backdrop-blur-xl",
      border: "border-2 border-emerald-400/50",
      text: "text-white drop-shadow",
      icon: "text-emerald-300",
      button: "text-emerald-200 hover:text-white hover:bg-emerald-500/30",
      actionButton: "bg-emerald-500/40 hover:bg-emerald-500/60 border-emerald-400/70"
    },
    error: {
      bg: "bg-red-500/20 backdrop-blur-xl",
      border: "border-2 border-red-400/50",
      text: "text-white drop-shadow",
      icon: "text-red-300",
      button: "text-red-200 hover:text-white hover:bg-red-500/30",
      actionButton: "bg-red-500/40 hover:bg-red-500/60 border-red-400/70"
    },
    info: {
      bg: "bg-white/15 backdrop-blur-xl",
      border: "border-2 border-white/40",
      text: "text-white drop-shadow",
      icon: "text-white/80",
      button: "text-white/70 hover:text-white hover:bg-white/30",
      actionButton: "bg-white/30 hover:bg-white/40 border-white/60"
    }
  }[type] || {
    bg: "bg-white/15 backdrop-blur-xl",
    border: "border-2 border-white/40",
    text: "text-white drop-shadow",
    icon: "text-white/80",
    button: "text-white/70 hover:text-white hover:bg-white/30",
    actionButton: "bg-white/30 hover:bg-white/40 border-white/60"
  };

  const animationClass = isRemoving ? "animate-notification-out" : "animate-notification-in";

  const handleActionClick = (e) => {
    e.stopPropagation();
    if (redirectUrl) {
      router.push(redirectUrl);
      onRemove(id);
    }
  };

  return (
    <div
      className={`${styles.bg} ${styles.border} ${styles.text} p-4 rounded-xl shadow-2xl mb-2 min-w-80 max-w-96 ${animationClass} ${!redirectUrl ? 'cursor-pointer hover:scale-[1.02]' : ''} transition-all duration-200`}
      onClick={!redirectUrl ? () => onRemove(id) : undefined}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium mb-2">{message}</div>
          {redirectUrl && (
            <button
              onClick={handleActionClick}
              className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold ${styles.actionButton} border-2 transition-all duration-200 inline-flex items-center gap-1 shadow-xs hover:shadow-sm-md`}
            >
              {linkText || t('notifications.viewOptions')}
              <span className="text-base">→</span>
            </button>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          className={`ml-2 ${styles.button} text-lg leading-none px-1.5 rounded-sm transition-all duration-200`}
          aria-label={t('notifications.closeNotification')}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();
  const { t } = useLanguage();

  if (notifications.length === 0) {
    return null;
  }

  // Sort notifications by timestamp, most recent first
  const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="fixed top-32 md:top-20 right-4 z-[10003] space-y-2">
      {sortedNotifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={removeNotification}
          t={t}
        />
      ))}
    </div>
  );
}
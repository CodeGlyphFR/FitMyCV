"use client";

import React from "react";
import { useNotifications } from "./NotificationProvider";

function NotificationItem({ notification, onRemove }) {
  const { id, type, message, isRemoving } = notification;

  const styles = {
    success: {
      bg: "bg-emerald-500/20 backdrop-blur-xl",
      border: "border-2 border-emerald-400/50",
      text: "text-white drop-shadow",
      icon: "text-emerald-300",
      button: "text-emerald-200 hover:text-white hover:bg-emerald-500/30"
    },
    error: {
      bg: "bg-red-500/20 backdrop-blur-xl",
      border: "border-2 border-red-400/50",
      text: "text-white drop-shadow",
      icon: "text-red-300",
      button: "text-red-200 hover:text-white hover:bg-red-500/30"
    },
    info: {
      bg: "bg-white/15 backdrop-blur-xl",
      border: "border-2 border-white/40",
      text: "text-white drop-shadow",
      icon: "text-white/80",
      button: "text-white/70 hover:text-white hover:bg-white/30"
    }
  }[type] || {
    bg: "bg-white/15 backdrop-blur-xl",
    border: "border-2 border-white/40",
    text: "text-white drop-shadow",
    icon: "text-white/80",
    button: "text-white/70 hover:text-white hover:bg-white/30"
  };

  const animationClass = isRemoving ? "animate-notification-out" : "animate-notification-in";

  return (
    <div
      className={`${styles.bg} ${styles.border} ${styles.text} p-4 rounded-xl shadow-2xl mb-2 min-w-80 max-w-96 ${animationClass} cursor-pointer hover:scale-[1.02] transition-all duration-200`}
      onClick={() => onRemove(id)}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <div className="text-sm font-medium">{message}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          className={`ml-2 ${styles.button} text-lg leading-none px-1.5 rounded transition-all duration-200`}
          aria-label="Fermer la notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  // Sort notifications by timestamp, most recent first
  const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="fixed top-4 right-4 z-[10003] space-y-2">
      {sortedNotifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={removeNotification}
        />
      ))}
    </div>
  );
}
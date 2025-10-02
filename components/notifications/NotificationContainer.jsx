"use client";

import React from "react";
import { useNotifications } from "./NotificationProvider";

function NotificationItem({ notification, onRemove }) {
  const { id, type, message, isRemoving } = notification;

  const bgColor = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-white border border-gray-200",
  }[type] || "bg-blue-500";

  const textColor = {
    success: "text-white",
    error: "text-white",
    info: "text-gray-900",
  }[type] || "text-white";
  const animationClass = isRemoving ? "animate-notification-out" : "animate-notification-in";

  return (
    <div
      className={`${bgColor} ${textColor} p-4 rounded-lg shadow-lg mb-2 min-w-80 max-w-96 ${animationClass} cursor-pointer hover:opacity-90 transition-opacity`}
      onClick={() => onRemove(id)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="text-sm italic">{message}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          className={`ml-2 ${type === 'info' ? 'text-gray-400 hover:text-gray-600' : 'text-white hover:text-gray-200'} text-lg leading-none`}
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
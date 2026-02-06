"use client";

import React from "react";

/**
 * Composant contenant les styles globaux du TopBar
 */
export default function TopBarStyles() {
  return (
    <style jsx global>{`
      .cv-selector-trigger:active {
        opacity: 1 !important;
        transform: none !important;
      }

      .cv-dropdown-no-animation {
        animation: none !important;
        transition: none !important;
        transform: none !important;
        will-change: auto !important;
      }

      .cv-ticker {
        max-width: 100%;
        position: relative;
        display: block;
        overflow: hidden;
      }

      .cv-ticker__inner {
        --cv-ticker-duration: 12s;
        --cv-ticker-shift: -50%;
        display: inline-flex;
        align-items: center;
        gap: 1.5rem;
        transform: translate3d(0, 0, 0);
      }

      .cv-ticker__chunk {
        display: inline-block;
        white-space: nowrap;
      }

      .cv-ticker--active .cv-ticker__inner {
        animation: cv-ticker-scroll var(--cv-ticker-duration) linear infinite;
      }

      @keyframes cv-ticker-scroll {
        0% {
          transform: translate3d(0, 0, 0);
        }
        100% {
          transform: translate3d(var(--cv-ticker-shift), 0, 0);
        }
      }

      .animated-underline {
        animation: gradient-shift 3s ease infinite;
        background-size: 200% 100%;
      }

      @keyframes gradient-shift {
        0% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }

      .sparkle-effect {
        animation: sparkle-rotate 2s linear infinite;
      }

      @keyframes sparkle-rotate {
        0%, 100% {
          transform: rotate(0deg) scale(1);
        }
        25% {
          transform: rotate(10deg) scale(1.1);
        }
        50% {
          transform: rotate(0deg) scale(1);
        }
        75% {
          transform: rotate(-10deg) scale(1.1);
        }
      }

      input[type="text"]::placeholder {
        opacity: 1;
      }

      .job-title-input-wrapper:focus-within {
        animation: none;
      }

      .job-title-input-wrapper:focus-within .search-icon-pulse {
        animation: none;
        transform: scale(1.1);
        color: #3B82F6;
      }

      /* Task progress button - animatable CSS property */
      @property --task-progress {
        syntax: '<percentage>';
        initial-value: 0%;
        inherits: false;
      }

      .task-progress-button {
        --task-progress: 0%;
        background: conic-gradient(from 0deg, rgba(52, 211, 153, 0.7) 0% var(--task-progress), rgba(255, 255, 255, 0.2) var(--task-progress) 100%);
        animation: task-button-pulse 2s ease-in-out infinite;
        transition: --task-progress 0.5s ease-out;
      }

      @keyframes task-button-pulse {
        0%, 100% {
          opacity: 1;
          box-shadow: 0 0 0 0 rgba(52, 211, 153, 0);
        }
        50% {
          opacity: 0.85;
          box-shadow: 0 0 8px 2px rgba(52, 211, 153, 0.4);
        }
      }
    `}</style>
  );
}

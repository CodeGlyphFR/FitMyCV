"use client";
import React from "react";

export default function DefaultCvIcon({ className = "", size = 16 }){
  const style = {
    width: `${size}px`,
    height: `${size}px`,
    verticalAlign: "middle",
  };

  return (
    <svg
      role="img"
      aria-label="CV manuel"
      viewBox="0 0 24 24"
      className={`inline-block ${className}`.trim()}
      style={style}
      focusable="false"
    >
      <path
        d="M7 3h6.5L18 7.5V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        fill="currentColor"
        fillOpacity="0.08"
      />
      <path
        d="M7 3h6.5L18 7.5V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 3v3.5A2.5 2.5 0 0 0 16 9h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8.5 12h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 15.5h7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8.5 19h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

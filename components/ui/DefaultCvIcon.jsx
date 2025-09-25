"use client";
import React from "react";

export default function DefaultCvIcon({ className = "", size = 16 }){
  const style = {
    fontSize: `${size}px`,
    lineHeight: 1,
  };

  return (
    <span
      role="img"
      aria-label="CV manuel"
      className={`inline-flex items-center justify-center ${className}`.trim()}
      style={style}
    >
      🖐️
    </span>
  );
}

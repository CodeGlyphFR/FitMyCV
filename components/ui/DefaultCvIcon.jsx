"use client";
import React from "react";

export default function DefaultCvIcon({ className = "", size = 16 }){
  return (
    <img
      src="/images/manual-hand.svg"
      alt="CV manuel"
      width={size}
      height={size}
      className={className}
      loading="lazy"
    />
  );
}

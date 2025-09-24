"use client";
import React from "react";

export default function GptLogo({ className = "", size = 16 }){
  return (
    <img
      src="/images/openai-symbol.png"
      alt="OpenAI"
      width={size}
      height={size}
      className={className}
      loading="lazy"
    />
  );
}

"use client";
import React from "react";

export default function GptLogo({ className = "", size = 16 }){
  return (
    <img
      src="/icons/openai-symbol.svg"
      alt="OpenAI"
      width={size}
      height={size}
      className={className}
      loading="eager"
    />
  );
}

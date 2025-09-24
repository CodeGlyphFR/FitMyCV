"use client";
import React from "react";

export default function DefaultCvIcon({ className = "", size = 16 }){
  return (
    <img
      src="https://cdn-icons-png.flaticon.com/512/2165/2165920.png"
      alt="CV"
      width={size}
      height={size}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

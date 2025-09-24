"use client";
import React from "react";
export default function FormRow({ label, children }){
  return (
    <label className="text-sm grid gap-1">
      <span className="opacity-80">{label}</span>
      {children}
    </label>
  );
}

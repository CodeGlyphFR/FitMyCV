"use client";
import React from "react";
export default function FormRow({ label, children }){
  return (
    <label className="text-xs font-medium grid gap-2">
      <span className="uppercase tracking-wide text-white drop-shadow">{label}</span>
      {children}
    </label>
  );
}

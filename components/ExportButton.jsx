"use client";
import React from "react";
export default function ExportButton(){ return (<button onClick={()=>window.print()} className="no-print inline-flex items-center gap-2 rounded-xl px-4 py-2 shadow-sm border hover:shadow transition text-sm" title="Exporter en PDF"><span>🖨️</span></button>); }

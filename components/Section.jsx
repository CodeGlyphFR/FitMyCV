import React from "react";
export default function Section(props){
  const bgClass = props.noBackground ? "" : "bg-white/10 backdrop-blur-sm";
  return (<section className={`page mb-6 ${bgClass} rounded-xl p-4`}><h2 className="text-lg font-semibold tracking-tight mb-3 text-white drop-shadow-lg">{props.title}</h2><div className="space-y-3 text-white/90">{props.children}</div></section>);
}

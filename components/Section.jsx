import React from "react";
export default function Section(props){
  return (<section className="page mb-6"><h2 className="text-lg font-semibold tracking-tight mb-3">{props.title}</h2><div className="space-y-3">{props.children}</div></section>);
}

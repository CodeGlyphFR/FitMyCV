function ym(d){ if(!d) return ""; var s=String(d).toLowerCase(); if(s==="present") return "présent"; var parts=String(d).split("-"); var y=parts[0]; if(!parts[1]) return y; var m=parts[1]; var mm=String(Number(m)).padStart(2,"0"); return mm+"/"+y; }
module.exports = { ym };

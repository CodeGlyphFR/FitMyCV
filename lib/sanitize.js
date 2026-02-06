const DROP_KEYS = new Set(["methodologies_detailed","keywords_global","notes","frameworks","alias_titles"]);


function pickLabel(x){
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  if (typeof x === "object"){
    return x.name || x.label || x.title || x.value || "";
  }
  try { return String(x); } catch { return ""; }
}
// Keep proficiency as a number (0-5), don't convert to string
// This is used for backward compatibility with level_0to5 field
function normalizeLevel(n){
  var v = Number(n);
  if (isNaN(v)) return undefined;
  // Clamp to 0-5 range
  if (v < 0) return 0;
  if (v > 5) return 5;
  return Math.round(v);
}
function normalizeSkills(skills){
  if (!skills || typeof skills !== "object") return skills;
  var out = { hard_skills: [], soft_skills: [], tools: [], methodologies: [] };
  // hard_skills -> array of {name, proficiency?}
  // proficiency is now a number (0-5)
  if (Array.isArray(skills.hard_skills)){
    out.hard_skills = skills.hard_skills.map(function(it){
      if (it && typeof it === "object"){
        // Prefer proficiency as number, fallback to level_0to5
        var p = typeof it.proficiency === "number" ? it.proficiency : normalizeLevel(it.level_0to5);
        var name = pickLabel(it);
        return { name: name, proficiency: p };
      }
      return { name: pickLabel(it) };
    }).filter(function(it){ return it && it.name; });
  }
  // tools -> array of {name, proficiency?}
  // proficiency is now a number (0-5)
  if (Array.isArray(skills.tools)){
    out.tools = skills.tools.map(function(it){
      if (it && typeof it === "object"){
        // Prefer proficiency as number, fallback to level_0to5
        var p = typeof it.proficiency === "number" ? it.proficiency : normalizeLevel(it.level_0to5);
        var name = pickLabel(it);
        return { name: name, proficiency: p };
      }
      return { name: pickLabel(it) };
    }).filter(function(it){ return it && it.name; });
  }
  // methodologies -> array of strings
  if (Array.isArray(skills.methodologies)){
    out.methodologies = skills.methodologies.map(pickLabel).filter(Boolean);
  }
  // soft_skills -> array of strings
  if (Array.isArray(skills.soft_skills)){
    out.soft_skills = skills.soft_skills.map(pickLabel).filter(Boolean);
  }
  // keep unknown keys as-is but prefer normalized arrays
  var rest = {};
  for (var k in skills){
    if (!Object.prototype.hasOwnProperty.call(skills, k)) continue;
    if (["hard_skills","soft_skills","tools","methodologies"].indexOf(k) >= 0) continue;
    rest[k] = skills[k];
  }
  return Object.assign({}, rest, out);
}

function deepSanitize(obj){
  if (Array.isArray(obj)){
    for (let i=0;i<obj.length;i++) obj[i] = deepSanitize(obj[i]);
    return obj;
  } else if (obj && typeof obj === "object"){
    const out = {};
    for (const k of Object.keys(obj)){
      if (DROP_KEYS.has(k)) continue;
      if (k === 'skills' && obj[k] && typeof obj[k] === 'object') { out[k] = normalizeSkills(obj[k]); } else { out[k] = deepSanitize(obj[k]); }
    }
    return out;
  }
  return obj;
}

export function sanitizeInMemory(json){
  return deepSanitize(json);
}

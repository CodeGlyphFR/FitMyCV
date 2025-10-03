"use client";
import React from "react";
import Section from "./Section";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getSkillLevelLabel, getSectionTitle } from "@/lib/i18n/cvLabels";
import { useHighlight } from "./HighlightProvider";

function Row({children}){ return <div className="flex gap-2">{children}</div>; }

function normalizeProficiency(value){
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && !Number.isNaN(value)){
    if (value >= 4.5) return "expert";
    if (value >= 3.5) return "advanced";
    if (value >= 2.5) return "proficient";
    if (value >= 1.5) return "intermediate";
    if (value > 0) return "beginner";
    return "";
  }
  const raw = String(value).trim();
  if (!raw) return "";
  const key = raw.toLowerCase();
  if (["awareness", "notion", "notions", "connaissance", "connaissances", "bases", "basic", "basics", "familiar", "exposure"].includes(key)) return "awareness";
  if (["beginner", "debutant", "débutant", "junior", "novice"].includes(key)) return "beginner";
  if (["intermediate", "intermediaire", "intermédiaire", "standard", "moyen"].includes(key)) return "intermediate";
  if (["proficient", "confirme", "confirmé", "confirmee", "experienced", "experience", "solid"].includes(key)) return "proficient";
  if (["advanced", "avance", "avancé"].includes(key)) return "advanced";
  if (["expert", "maitre", "maître", "maitrise", "maîtrise", "senior"].includes(key)) return "expert";
  return key;
}

function formatProficiency(value, t){
  const normalized = normalizeProficiency(value);
  if (!normalized) return "";
  return getSkillLevelLabel(normalized, t) || normalized;
}

function toEditableSkill(entry){
  if (entry && typeof entry === "object"){
    const name = entry.name || entry.label || entry.title || entry.value || "";
    const proficiency = normalizeProficiency(
      entry.proficiency ?? entry.level ?? entry.rating ?? entry.level_label ?? entry.level_name ?? entry.level_0to5
    );
    return { name, proficiency };
  }
  return { name: entry ? String(entry) : "", proficiency: "" };
}

function displaySkillLevel(skill, t){
  if (!skill || typeof skill !== "object") return "";
  const source = skill.proficiency ?? skill.level ?? skill.rating ?? skill.level_label ?? skill.level_name ?? skill.level_0to5;
  return formatProficiency(source, t);
}

export default function Skills(props){
  const { t } = useLanguage();
  const skills = props.skills || {};
  const sectionTitles = props.sectionTitles || {};
  const title = getSectionTitle('skills', sectionTitles.skills, t);

  const hard = Array.isArray(skills.hard_skills)? skills.hard_skills:[];
  const soft = Array.isArray(skills.soft_skills)? skills.soft_skills:[];
  const tools = Array.isArray(skills.tools)? skills.tools:[];
  const methods = Array.isArray(skills.methodologies)? skills.methodologies:[];

  const skillsKeyRef = React.useRef("");
  const currentSkillsKey = JSON.stringify(skills);

  const [openHard, setOpenHard] = React.useState(false);
  const [hardLocal, setHardLocal] = React.useState(() => (hard || []).map(toEditableSkill));

  const [openSoft, setOpenSoft] = React.useState(false);
  const [softLocal, setSoftLocal] = React.useState((soft||[]).map(it=> (typeof it==='object'? (it.name||it.label||it.title||it.value||'') : String(it))));

  const [openTools, setOpenTools] = React.useState(false);
  const [toolsLocal, setToolsLocal] = React.useState(() => (tools || []).map(toEditableSkill));

  const [openMeth, setOpenMeth] = React.useState(false);
  const [methLocal, setMethLocal] = React.useState((methods||[]).map(it=> (typeof it==='object'? (it.name||it.label||it.title||it.value||'') : String(it))));

  React.useEffect(() => {
    if (skillsKeyRef.current === currentSkillsKey) return;
    skillsKeyRef.current = currentSkillsKey;

    setHardLocal((hard || []).map(toEditableSkill));
    setSoftLocal((soft||[]).map(it=> (typeof it==='object'? (it.name||it.label||it.title||it.value||'') : String(it))));
    setToolsLocal((tools || []).map(toEditableSkill));
    setMethLocal((methods||[]).map(it=> (typeof it==='object'? (it.name||it.label||it.title||it.value||'') : String(it))));
  });

  const { editing } = useAdmin();
  const { mutate } = useMutate();

  const hasHard = hard?.length > 0;
  const hasTools = tools?.length > 0;
  const hasMethods = methods?.length > 0;
  const hasSoft = soft?.length > 0;
  const hideSection = !editing && !hasHard && !hasTools && !hasMethods && !hasSoft;
  if (hideSection) return null;

  const LEVEL_OPTIONS = [
    { value: "awareness", label: getSkillLevelLabel("awareness", t) },
    { value: "beginner", label: getSkillLevelLabel("beginner", t) },
    { value: "intermediate", label: getSkillLevelLabel("intermediate", t) },
    { value: "proficient", label: getSkillLevelLabel("proficient", t) },
    { value: "advanced", label: getSkillLevelLabel("advanced", t) },
    { value: "expert", label: getSkillLevelLabel("expert", t) },
  ];

  async function saveHard(){ await mutate({ op:"set", path:"skills.hard_skills", value: hardLocal }); setOpenHard(false); }
  async function saveSoft(){ await mutate({ op:"set", path:"skills.soft_skills", value: softLocal }); setOpenSoft(false); }
  async function saveTools(){ await mutate({ op:"set", path:"skills.tools", value: toolsLocal }); setOpenTools(false); }
  async function saveMeth(){ await mutate({ op:"set", path:"skills.methodologies", value: methLocal }); setOpenMeth(false); }

  return (
    <Section title={title}>
      <div className="space-y-4">
        {(() => {
          const showHard = hasHard || editing; // en édition, on montre le bloc même vide
          const hideHardBecauseOthersFull = !hasHard && hasTools && hasMethods && !editing;
          const twoColsToolsMethods = hasTools && hasMethods;

          return (
            <>
              {/* Compétences techniques */}
              {!hideHardBecauseOthersFull && showHard && (
                <div className="w-full rounded-2xl border p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold mb-2">{t("cvSections.hardSkills")}</h3>
                    {editing && (
                      <button onClick={() => setOpenHard(true)} className="text-[11px] px-2 py-0.5">🖊️</button>
                    )}
                  </div>

                  {hasHard ? (
                    <div className={`grid gap-3 ${hard.length > 5 ? "md:grid-cols-2" : "grid-cols-1"}`}>
                      {hard.map((s, i) => {
                        const levelLabel = displaySkillLevel(s, t);
                        return (
                          <div key={i} className="text-sm">
                            <span className="font-medium">
                              {s && (s.name || s.label || s.title || s.value || (typeof s === "string" ? s : ""))}
                            </span>
                            {levelLabel ? <span className="opacity-70"> • {levelLabel}</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    editing && <div className="text-sm opacity-60">{t("cvSections.noSkills")}</div>
                  )}
                </div>
              )}

              {/* Outils + Méthodologies */}
              <div className={twoColsToolsMethods ? "grid md:grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
                {/* Outils */}
                {(hasTools || editing) && (
                  <div className="w-full rounded-2xl border p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold mb-2">{t("cvSections.tools")}</h3>
                      {editing && (
                        <button onClick={() => setOpenTools(true)} className="text-[11px] px-2 py-0.5">🖊️</button>
                      )}
                    </div>

                    {hasTools ? (
                      <ul className="space-y-1">
                        {tools.map((tool, i) => {
                          const levelLabel = displaySkillLevel(tool, t);
                          return (
                            <li key={i} className="text-sm">
                              <span className="font-medium">
                                {tool && (tool.name || tool.label || tool.title || tool.value || (typeof tool === "string" ? tool : ""))}
                              </span>
                              {levelLabel ? <span className="opacity-70"> • {levelLabel}</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      editing && <div className="text-sm opacity-60">{t("cvSections.noTools")}</div>
                    )}
                  </div>
                )}

                {/* Méthodologies */}
                {(hasMethods || editing) && (
                  <div className="w-full rounded-2xl border p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold mb-2">{t("cvSections.methodologies")}</h3>
                      {editing && (
                        <button onClick={() => setOpenMeth(true)} className="text-[11px] px-2 py-0.5">🖊️</button>
                      )}
                    </div>

                    {hasMethods ? (
                      <div className="flex flex-wrap gap-1">
                        {methods.map((m, i) => {
                          const lab = typeof m === "string" ? m : (m?.name || m?.label || m?.title || m?.value || "");
                          return (
                            <span key={i} className="inline-block rounded border px-1.5 py-0.5 text-[11px] opacity-90">
                              {lab}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      editing && <div className="text-sm opacity-60">{t("cvSections.noMethodologies")}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Soft skills */}
              {hasSoft ? (
                <div>
                  <div className="flex flex-wrap gap-1">
                    {soft.map((m, i) => {
                      const lab = typeof m === "string" ? m : (m?.name || m?.label || m?.title || m?.value || "");
                      return (
                        <span key={i} className="inline-block rounded border px-1.5 py-0.5 text-[11px] opacity-90">
                          {lab}
                        </span>
                      );
                    })}
                    {editing && (
                      <button onClick={() => setOpenSoft(true)} className="text-[11px] px-2 py-0.5">🖊️</button>
                    )}
                  </div>
                </div>
              ) : (
                editing && (
                  <div className="rounded-2xl border p-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold mb-2">{t("cvSections.softSkills")}</h3>
                      <button onClick={() => setOpenSoft(true)} className="text-[11px] px-2 py-0.5">🖊️</button>
                    </div>
                    <div className="text-sm opacity-60">{t("cvSections.noSoftSkills")}</div>
                  </div>
                )
              )}
            </>
          );
        })()}
      </div>

      {/* Modals */}
      <Modal open={openHard} onClose={()=>setOpenHard(false)} title={t("cvSections.editSkills")}>
        <div className="space-y-2">
          {hardLocal.map((row,idx)=>(
            <div key={idx} className="grid grid-cols-7 gap-2 items-center">
              <input className="col-span-3 rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.skillName")} value={row.name||""} onChange={e=>{ const arr=[...hardLocal]; arr[idx]={...arr[idx], name:e.target.value}; setHardLocal(arr); }} />
              <select
                className="col-span-3 rounded border px-2 py-1 text-sm"
                value={row.proficiency ?? ""}
                onChange={e => { const arr=[...hardLocal]; arr[idx]={ ...arr[idx], proficiency:e.target.value }; setHardLocal(arr); }}
              >
                <option value="" disabled>{t("cvSections.placeholders.chooseLevel")}</option>
                {LEVEL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button onClick={()=>{ const arr=[...hardLocal]; arr.splice(idx,1); setHardLocal(arr); }} className="text-xs rounded border px-2 py-1">❌</button>
            </div>
          ))}
          <div className="flex justify-end gap-2"><button onClick={()=>setHardLocal([...(hardLocal||[]),{name:"",proficiency:""}])} className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t("common.add")}</button></div>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setOpenHard(false)} className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t("common.cancel")}</button>
            <button onClick={saveHard} className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">{t("common.save")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={openTools} onClose={()=>setOpenTools(false)} title={t("cvSections.editTools")}>
        <div className="space-y-2">
          {toolsLocal.map((row,idx)=>(
            <div key={idx} className="grid grid-cols-7 gap-2 items-center">
              <input className="col-span-3 rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.skillName")} value={row.name||""} onChange={e=>{ const arr=[...toolsLocal]; arr[idx]={...arr[idx], name:e.target.value}; setToolsLocal(arr); }} />
              <select
                className="col-span-3 rounded border px-2 py-1 text-sm"
                value={row.proficiency ?? ""}
                onChange={e => { const arr=[...toolsLocal]; arr[idx]={ ...arr[idx], proficiency:e.target.value }; setToolsLocal(arr); }}
              >
                <option value="" disabled>{t("cvSections.placeholders.chooseLevel")}</option>
                {LEVEL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button onClick={()=>{ const arr=[...toolsLocal]; arr.splice(idx,1); setToolsLocal(arr); }} className="text-xs rounded border px-2 py-1">❌</button>
            </div>
          ))}
          <div className="flex justify-end gap-2"><button onClick={()=>setToolsLocal([...(toolsLocal||[]),{name:"",proficiency:""}])} className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t("common.add")}</button></div>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setOpenTools(false)} className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t("common.cancel")}</button>
            <button onClick={saveTools} className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">{t("common.save")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={openMeth} onClose={()=>setOpenMeth(false)} title={t("cvSections.editMethodologies")}>
        <div className="space-y-2">
          {methLocal.map((row,idx)=>(
            <div key={idx} className="grid grid-cols-6 gap-2 items-center">
              <input className="col-span-5 rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.skillLabel")} value={row||""} onChange={e=>{ const arr=[...methLocal]; arr[idx]=e.target.value; setMethLocal(arr); }} />
              <button onClick={()=>{ const arr=[...methLocal]; arr.splice(idx,1); setMethLocal(arr); }} className="text-xs rounded border px-2 py-1">❌</button>
            </div>
          ))}
          <div className="flex justify-end gap-2"><button onClick={()=>setMethLocal([...(methLocal||[]), ""])} className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t("common.add")}</button></div>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setOpenMeth(false)} className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t("common.cancel")}</button>
            <button onClick={saveMeth} className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">{t("common.save")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={openSoft} onClose={()=>setOpenSoft(false)} title={t("cvSections.editSoftSkills")}>
        <div className="space-y-2">
          {softLocal.map((row,idx)=>(
            <div key={idx} className="grid grid-cols-6 gap-2 items-center">
              <input className="col-span-5 rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.skillLabel")} value={row||""} onChange={e=>{ const arr=[...softLocal]; arr[idx]=e.target.value; setSoftLocal(arr); }} />
              <button onClick={()=>{ const arr=[...softLocal]; arr.splice(idx,1); setSoftLocal(arr); }} className="text-xs rounded border px-2 py-1">❌</button>
            </div>
          ))}
          <div className="flex justify-end gap-2"><button onClick={()=>setSoftLocal([...(softLocal||[]), ""])} className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t("common.add")}</button></div>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setOpenSoft(false)} className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{t("common.cancel")}</button>
            <button onClick={saveSoft} className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">{t("common.save")}</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

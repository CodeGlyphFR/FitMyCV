"use client";
import React from "react";
import Section from "@/components/layout/Section";
import { useAdmin } from "@/components/admin/AdminProvider";
import useMutate from "@/components/admin/useMutate";
import Modal from "@/components/ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getSkillLevelLabel } from "@/lib/i18n/cvLabels";
import { getCvSectionTitleInCvLanguage, getTranslatorForCvLanguage } from "@/lib/i18n/cvLanguageHelper";
import { capitalizeSkillName } from "@/lib/utils/textFormatting";
import SkillItemHighlight, { RemovedSkillsDisplay, RemovedSkillsDisplayBlock, RemovedSkillsBadges, RemovedSkillsBadgesBlock, useRemovedItems, useFilterRemovedItems } from "@/components/cv-review/SkillItemHighlight";
import SectionReviewActions from "@/components/cv-review/SectionReviewActions";
import SkillsReviewActions from "@/components/cv-review/SkillsReviewActions";
import { normalizeToNumber, VALID_SKILL_LEVELS, SKILL_LEVEL_KEYS } from "@/lib/constants/skillLevels";
import { Code, Wrench, Workflow, Heart, Plus, Trash2, Pencil } from "lucide-react";
import ContextMenu from "@/components/ui/ContextMenu";
import {
  ModalSection,
  FormField,
  Input,
  Select,
  Grid,
  ModalFooter,
} from "@/components/ui/ModalForm";

function Row({children}){ return <div className="flex gap-2">{children}</div>; }

// Normalize proficiency to a number (0-5)
// Returns the numeric level or null if invalid
function normalizeProficiency(value){
  return normalizeToNumber(value);
}

function formatProficiency(value, t){
  const normalized = normalizeProficiency(value);
  if (normalized === null) return "";
  // Get the i18n key from the number, then get the translated label
  const key = SKILL_LEVEL_KEYS[normalized];
  if (!key) return "";
  return getSkillLevelLabel(key, t) || key;
}

function toEditableSkill(entry){
  if (entry && typeof entry === "object"){
    const name = entry.name || entry.label || entry.title || entry.value || "";
    const raw = entry.proficiency ?? entry.level ?? entry.rating ?? entry.level_label ?? entry.level_name ?? entry.level_0to5;
    const proficiency = normalizeToNumber(raw);
    return { name, proficiency };
  }
  return { name: entry ? String(entry) : "", proficiency: null };
}

function displaySkillLevel(skill, t){
  if (!skill || typeof skill !== "object") return "";
  const source = skill.proficiency ?? skill.level ?? skill.rating ?? skill.level_label ?? skill.level_name ?? skill.level_0to5;
  return formatProficiency(source, t);
}

// Composant pour une ligne de compétence avec niveau
function SkillRow({ skill, index, onChange, onDelete, levelOptions, placeholderName, placeholderLevel }) {
  return (
    <div className="flex gap-2 items-center">
      <Input
        className="flex-1 min-w-0"
        placeholder={placeholderName}
        value={skill.name || ""}
        onChange={e => onChange(index, { ...skill, name: e.target.value })}
      />
      <Select
        className="flex-1 min-w-0"
        value={skill.proficiency ?? ""}
        onChange={e => {
          const val = e.target.value;
          onChange(index, { ...skill, proficiency: val === "" ? null : parseInt(val, 10) });
        }}
      >
        <option value="" disabled>{placeholderLevel}</option>
        {levelOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </Select>
      <button
        onClick={() => onDelete(index)}
        className="flex items-center justify-center rounded-md border border-red-500/50 bg-red-500/20 p-1.5 text-red-400 hover:bg-red-500/30 transition-colors shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Composant pour une ligne simple (sans niveau)
function SimpleSkillRow({ value, index, onChange, onDelete, placeholder }) {
  return (
    <div className="flex gap-2 items-center">
      <Input
        className="flex-1 min-w-0"
        placeholder={placeholder}
        value={value || ""}
        onChange={e => onChange(index, e.target.value)}
      />
      <button
        onClick={() => onDelete(index)}
        className="flex items-center justify-center rounded-md border border-red-500/50 bg-red-500/20 p-1.5 text-red-400 hover:bg-red-500/30 transition-colors shrink-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function Skills(props){
  const { t } = useLanguage();
  const skills = props.skills || {};
  const sectionTitles = props.sectionTitles || {};
  const cvLanguage = props.cvLanguage || 'fr';
  const cvT = getTranslatorForCvLanguage(cvLanguage);
  const title = getCvSectionTitleInCvLanguage('skills', sectionTitles.skills, cvLanguage);

  const hard = Array.isArray(skills.hard_skills)? skills.hard_skills:[];
  const soft = Array.isArray(skills.soft_skills)? skills.soft_skills:[];
  const tools = Array.isArray(skills.tools)? skills.tools:[];
  const methods = Array.isArray(skills.methodologies)? skills.methodologies:[];

  // Helper pour extraire le nom d'un skill (objet ou string)
  const getSkillName = (s) => s && (s.name || s.label || s.title || s.value || (typeof s === "string" ? s : ""));

  // Filtrer les skills qui ont un changement "removed" en attente
  // Ces skills ne doivent pas apparaître dans la liste principale (ils sont affichés dans RemovedSkillsDisplay)
  const filteredHard = useFilterRemovedItems(hard, "skills", "hard_skills", getSkillName);
  const filteredTools = useFilterRemovedItems(tools, "skills", "tools", getSkillName);
  const filteredMethods = useFilterRemovedItems(methods, "skills", "methodologies", getSkillName);
  const filteredSoft = useFilterRemovedItems(soft, "skills", "soft_skills", getSkillName);

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

  // Vérifier s'il y a des items supprimés à reviewer (hooks au top level)
  const removedTools = useRemovedItems("skills", "tools");
  const removedMethods = useRemovedItems("skills", "methodologies");

  const hasHard = hard?.length > 0;
  const hasTools = tools?.length > 0;
  const hasMethods = methods?.length > 0;
  const hasSoft = soft?.length > 0;
  const hideSection = !editing && !hasHard && !hasTools && !hasMethods && !hasSoft;
  if (hideSection) return null;

  // LEVEL_OPTIONS uses numeric values (0-5) as the source of truth
  const LEVEL_OPTIONS = [
    { value: 0, label: getSkillLevelLabel("awareness", t) },
    { value: 1, label: getSkillLevelLabel("beginner", t) },
    { value: 2, label: getSkillLevelLabel("intermediate", t) },
    { value: 3, label: getSkillLevelLabel("proficient", t) },
    { value: 4, label: getSkillLevelLabel("advanced", t) },
    { value: 5, label: getSkillLevelLabel("expert", t) },
  ];

  async function saveHard(){ await mutate({ op:"set", path:"skills.hard_skills", value: hardLocal }); setOpenHard(false); }
  async function saveSoft(){ await mutate({ op:"set", path:"skills.soft_skills", value: softLocal }); setOpenSoft(false); }
  async function saveTools(){ await mutate({ op:"set", path:"skills.tools", value: toolsLocal }); setOpenTools(false); }
  async function saveMeth(){ await mutate({ op:"set", path:"skills.methodologies", value: methLocal }); setOpenMeth(false); }

  // Handlers pour les listes
  const handleHardChange = (idx, value) => {
    const arr = [...hardLocal];
    arr[idx] = value;
    setHardLocal(arr);
  };
  const handleHardDelete = (idx) => {
    const arr = [...hardLocal];
    arr.splice(idx, 1);
    setHardLocal(arr);
  };
  const handleToolsChange = (idx, value) => {
    const arr = [...toolsLocal];
    arr[idx] = value;
    setToolsLocal(arr);
  };
  const handleToolsDelete = (idx) => {
    const arr = [...toolsLocal];
    arr.splice(idx, 1);
    setToolsLocal(arr);
  };
  const handleSoftChange = (idx, value) => {
    const arr = [...softLocal];
    arr[idx] = value;
    setSoftLocal(arr);
  };
  const handleSoftDelete = (idx) => {
    const arr = [...softLocal];
    arr.splice(idx, 1);
    setSoftLocal(arr);
  };
  const handleMethChange = (idx, value) => {
    const arr = [...methLocal];
    arr[idx] = value;
    setMethLocal(arr);
  };
  const handleMethDelete = (idx) => {
    const arr = [...methLocal];
    arr.splice(idx, 1);
    setMethLocal(arr);
  };

  return (
    <Section title={
      <div className="flex items-center justify-between gap-2">
        <span>{title}</span>
        <SectionReviewActions section="skills" />
      </div>
    }>
      <div className="space-y-4">
        {(() => {
          const showHard = hasHard || editing; // en édition, on montre le bloc même vide
          const hideHardBecauseOthersFull = !hasHard && hasTools && hasMethods && !editing;

          // Déterminer si on doit afficher chaque colonne
          const showToolsColumn = hasTools || editing || removedTools.length > 0;
          const showMethodsColumn = hasMethods || editing || removedMethods.length > 0;

          // Grille à 2 colonnes seulement si les deux colonnes ont du contenu
          const useTwoColumns = showToolsColumn && showMethodsColumn;

          return (
            <>
              {/* Compétences techniques */}
              {!hideHardBecauseOthersFull && showHard && (
                <div className="w-full rounded-2xl border border-white/15 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{cvT("cvSections.hardSkills")}</h3>
                    <div className="flex items-center gap-2">
                      <SkillsReviewActions field="hard_skills" />
                      {editing && (
                        <ContextMenu
                          items={[
                            { icon: Pencil, label: t("common.edit"), onClick: () => setOpenHard(true) },
                            { icon: Trash2, label: t("common.deleteAll"), onClick: () => mutate({ op:"set", path:"skills.hard_skills", value: [] }), danger: true }
                          ]}
                        />
                      )}
                    </div>
                  </div>

                  {hasHard ? (
                    <>
                      {filteredHard.length > 0 && (
                        <div className={`grid gap-1 ${filteredHard.length > 5 ? "md:grid-cols-2" : "grid-cols-1"}`}>
                          {filteredHard.map((s, i) => {
                            const skillName = getSkillName(s);
                            const levelLabel = displaySkillLevel(s, cvT);
                            return (
                              <div key={i} className="flex items-center text-sm">
                                <SkillItemHighlight section="skills" field="hard_skills" itemName={skillName} infoPosition="inline">
                                  <span className="font-medium">
                                    {capitalizeSkillName(skillName)}
                                  </span>
                                  {levelLabel ? <span className="opacity-70"> • {levelLabel}</span> : null}
                                </SkillItemHighlight>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    editing && <div className="text-sm opacity-60">{t("cvSections.noSkills")}</div>
                  )}
                  {/* Afficher les skills supprimés - en dehors de la grille pour être en bas */}
                  <RemovedSkillsDisplay section="skills" field="hard_skills" />
                </div>
              )}
              {/* Hard skills orphelins (tous supprimés) */}
              {!hasHard && !editing && (
                <RemovedSkillsDisplayBlock field="hard_skills" title={cvT("cvSections.hardSkills")} />
              )}

              {/* Outils + Méthodologies (grille) */}
              {(showToolsColumn || showMethodsColumn) && (
              <div className={`grid gap-4 ${useTwoColumns ? "md:grid-cols-2" : "grid-cols-1"}`}>
                {/* Outils - affiche soit le bloc normal, soit les orphelins */}
                {showToolsColumn && ((hasTools || editing) ? (
                  <div className="w-full rounded-2xl border border-white/15 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{cvT("cvSections.tools")}</h3>
                      <div className="flex items-center gap-2">
                        <SkillsReviewActions field="tools" />
                        {editing && (
                          <ContextMenu
                            items={[
                              { icon: Pencil, label: t("common.edit"), onClick: () => setOpenTools(true) },
                              { icon: Trash2, label: t("common.deleteAll"), onClick: () => mutate({ op:"set", path:"skills.tools", value: [] }), danger: true }
                            ]}
                          />
                        )}
                      </div>
                    </div>

                    {hasTools ? (
                      <ul className="space-y-1">
                        {filteredTools.map((tool, i) => {
                          const toolName = getSkillName(tool);
                          const levelLabel = displaySkillLevel(tool, cvT);
                          return (
                            <li key={i} className="text-sm">
                              <SkillItemHighlight section="skills" field="tools" itemName={toolName} infoPosition="inline">
                                <span className="font-medium">
                                  {capitalizeSkillName(toolName)}
                                </span>
                                {levelLabel ? <span className="opacity-70"> • {levelLabel}</span> : null}
                              </SkillItemHighlight>
                            </li>
                          );
                        })}
                        {/* Afficher les outils supprimés */}
                        <RemovedSkillsDisplay section="skills" field="tools" />
                      </ul>
                    ) : (
                      editing && <div className="text-sm opacity-60">{t("cvSections.noTools")}</div>
                    )}
                  </div>
                ) : (
                  <RemovedSkillsDisplayBlock field="tools" title={cvT("cvSections.tools")} />
                ))}

                {/* Méthodologies - affiche soit le bloc normal, soit les orphelins */}
                {showMethodsColumn && ((hasMethods || editing) ? (
                  <div className="w-full rounded-2xl border border-white/15 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{cvT("cvSections.methodologies")}</h3>
                      <div className="flex items-center gap-2">
                        <SkillsReviewActions field="methodologies" />
                        {editing && (
                          <ContextMenu
                            items={[
                              { icon: Pencil, label: t("common.edit"), onClick: () => setOpenMeth(true) },
                              { icon: Trash2, label: t("common.deleteAll"), onClick: () => mutate({ op:"set", path:"skills.methodologies", value: [] }), danger: true }
                            ]}
                          />
                        )}
                      </div>
                    </div>

                    {hasMethods ? (
                      <div className="flex flex-wrap gap-1">
                        {filteredMethods.map((m, i) => {
                          const methodName = getSkillName(m);
                          return (
                            <SkillItemHighlight key={i} section="skills" field="methodologies" itemName={methodName} infoPosition="corner">
                              <span className="inline-block rounded-sm border border-white/15 px-1.5 py-0.5 text-[11px] opacity-90">
                                {capitalizeSkillName(methodName)}
                              </span>
                            </SkillItemHighlight>
                          );
                        })}
                        {/* Afficher les méthodologies supprimées */}
                        <RemovedSkillsDisplay section="skills" field="methodologies" />
                      </div>
                    ) : (
                      editing && <div className="text-sm opacity-60">{t("cvSections.noMethodologies")}</div>
                    )}
                  </div>
                ) : (
                  <RemovedSkillsDisplayBlock field="methodologies" title={cvT("cvSections.methodologies")} />
                ))}
              </div>
              )}

              {/* Soft skills - affiche soit le bloc normal, soit les orphelins */}
              {hasSoft ? (
                <div>
                  <div className="flex flex-wrap gap-1">
                    {filteredSoft.map((m, i) => {
                      const softName = getSkillName(m);
                      return (
                        <SkillItemHighlight key={i} section="skills" field="soft_skills" itemName={softName} infoPosition="corner">
                          <span className="inline-block rounded-sm border border-white/15 px-1.5 py-0.5 text-[11px] opacity-90">
                            {capitalizeSkillName(softName)}
                          </span>
                        </SkillItemHighlight>
                      );
                    })}
                    <RemovedSkillsBadges
                      section="skills"
                      field="soft_skills"
                      badgeClassName="inline-block rounded-sm border border-white/15 px-1.5 py-0.5 text-[11px] opacity-90"
                    />
                    {editing && (
                      <ContextMenu
                        items={[
                          { icon: Pencil, label: t("common.edit"), onClick: () => setOpenSoft(true) },
                          { icon: Trash2, label: t("common.deleteAll"), onClick: () => mutate({ op:"set", path:"skills.soft_skills", value: [] }), danger: true }
                        ]}
                      />
                    )}
                  </div>
                </div>
              ) : editing ? (
                <div className="rounded-2xl border border-white/15 p-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold mb-2">{cvT("cvSections.softSkills")}</h3>
                    <ContextMenu
                      items={[
                        { icon: Pencil, label: t("common.edit"), onClick: () => setOpenSoft(true) },
                      ]}
                    />
                  </div>
                  <div className="text-sm opacity-60">{t("cvSections.noSoftSkills")}</div>
                </div>
              ) : (
                <RemovedSkillsBadgesBlock
                  field="soft_skills"
                  title={cvT("cvSections.softSkills")}
                  badgeClassName="inline-block rounded-sm border border-white/15 px-1.5 py-0.5 text-[11px] opacity-90"
                />
              )}
            </>
          );
        })()}
      </div>

      {/* Modal Hard Skills */}
      <Modal open={openHard} onClose={()=>setOpenHard(false)} title={t("cvSections.editSkills")}>
        <div className="space-y-3">
          <ModalSection title={cvT("cvSections.hardSkills")} icon={Code}>
            <div className="space-y-2">
              {hardLocal.map((row, idx) => (
                <SkillRow
                  key={idx}
                  skill={row}
                  index={idx}
                  onChange={handleHardChange}
                  onDelete={handleHardDelete}
                  levelOptions={LEVEL_OPTIONS}
                  placeholderName={t("cvSections.placeholders.skillName")}
                  placeholderLevel={t("cvSections.placeholders.chooseLevel")}
                />
              ))}
              <button
                onClick={() => setHardLocal([...hardLocal, { name: "", proficiency: null }])}
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {t("common.add")}
              </button>
            </div>
          </ModalSection>

          <ModalFooter
            onCancel={() => setOpenHard(false)}
            onSave={saveHard}
            saveLabel={t("common.save")}
            cancelLabel={t("common.cancel")}
          />
        </div>
      </Modal>

      {/* Modal Tools */}
      <Modal open={openTools} onClose={()=>setOpenTools(false)} title={t("cvSections.editTools")}>
        <div className="space-y-3">
          <ModalSection title={cvT("cvSections.tools")} icon={Wrench}>
            <div className="space-y-2">
              {toolsLocal.map((row, idx) => (
                <SkillRow
                  key={idx}
                  skill={row}
                  index={idx}
                  onChange={handleToolsChange}
                  onDelete={handleToolsDelete}
                  levelOptions={LEVEL_OPTIONS}
                  placeholderName={t("cvSections.placeholders.skillName")}
                  placeholderLevel={t("cvSections.placeholders.chooseLevel")}
                />
              ))}
              <button
                onClick={() => setToolsLocal([...toolsLocal, { name: "", proficiency: null }])}
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {t("common.add")}
              </button>
            </div>
          </ModalSection>

          <ModalFooter
            onCancel={() => setOpenTools(false)}
            onSave={saveTools}
            saveLabel={t("common.save")}
            cancelLabel={t("common.cancel")}
          />
        </div>
      </Modal>

      {/* Modal Methodologies */}
      <Modal open={openMeth} onClose={()=>setOpenMeth(false)} title={t("cvSections.editMethodologies")}>
        <div className="space-y-3">
          <ModalSection title={cvT("cvSections.methodologies")} icon={Workflow}>
            <div className="space-y-2">
              {methLocal.map((row, idx) => (
                <SimpleSkillRow
                  key={idx}
                  value={row}
                  index={idx}
                  onChange={handleMethChange}
                  onDelete={handleMethDelete}
                  placeholder={t("cvSections.placeholders.skillLabel")}
                />
              ))}
              <button
                onClick={() => setMethLocal([...methLocal, ""])}
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {t("common.add")}
              </button>
            </div>
          </ModalSection>

          <ModalFooter
            onCancel={() => setOpenMeth(false)}
            onSave={saveMeth}
            saveLabel={t("common.save")}
            cancelLabel={t("common.cancel")}
          />
        </div>
      </Modal>

      {/* Modal Soft Skills */}
      <Modal open={openSoft} onClose={()=>setOpenSoft(false)} title={t("cvSections.editSoftSkills")}>
        <div className="space-y-3">
          <ModalSection title={cvT("cvSections.softSkills")} icon={Heart}>
            <div className="space-y-2">
              {softLocal.map((row, idx) => (
                <SimpleSkillRow
                  key={idx}
                  value={row}
                  index={idx}
                  onChange={handleSoftChange}
                  onDelete={handleSoftDelete}
                  placeholder={t("cvSections.placeholders.skillLabel")}
                />
              ))}
              <button
                onClick={() => setSoftLocal([...softLocal, ""])}
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {t("common.add")}
              </button>
            </div>
          </ModalSection>

          <ModalFooter
            onCancel={() => setOpenSoft(false)}
            onSave={saveSoft}
            saveLabel={t("common.save")}
            cancelLabel={t("common.cancel")}
          />
        </div>
      </Modal>
    </Section>
  );
}

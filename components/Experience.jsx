"use client";
import React from "react";
import Section from "./Section";
import { ym } from "@/lib/utils";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getCvSectionTitleInCvLanguage, getTranslatorForCvLanguage } from "@/lib/i18n/cvLanguageHelper";
import { capitalizeSkillName } from "@/lib/utils/textFormatting";
// BulletHighlight n'est plus utilisé - responsibilities/deliverables sont maintenant en field-level
import SkillItemHighlight, { RemovedSkillsDisplay } from "./SkillItemHighlight";
import SectionReviewActions from "./SectionReviewActions";
import ExperienceReviewActions from "./ExperienceReviewActions";
import ChangeHighlight from "./ChangeHighlight";
import { useHighlight } from "./HighlightProvider";
import CountrySelect from "./CountrySelect";


export default function Experience(props){
  const { t } = useLanguage();
  const rawExperience = Array.isArray(props.experience) ? props.experience : [];
  // Normalise une date vers le format YYYY-MM pour comparaison
  // Gère : YYYY-MM, YYYY, MM/YYYY, YYYY/MM
  const normalizeDate = React.useCallback((date) => {
    if (!date) return "";
    const d = date.trim().toLowerCase();
    if (d === "present") return "";

    // Format YYYY-MM ou YYYY
    if (/^\d{4}(-\d{2})?$/.test(d)) {
      return d.length === 4 ? `${d}-01` : d;
    }

    // Format avec slash : MM/YYYY ou YYYY/MM
    if (d.includes("/")) {
      const parts = d.split("/");
      if (parts.length === 2) {
        const [p1, p2] = parts;
        // Si p1 a 4 chiffres -> YYYY/MM
        if (/^\d{4}$/.test(p1) && /^\d{1,2}$/.test(p2)) {
          return `${p1}-${p2.padStart(2, "0")}`;
        }
        // Si p2 a 4 chiffres -> MM/YYYY
        if (/^\d{4}$/.test(p2) && /^\d{1,2}$/.test(p1)) {
          return `${p2}-${p1.padStart(2, "0")}`;
        }
      }
    }

    return d;
  }, []);

  // Tri par date décroissante (plus récent en premier)
  // 1. Expériences en cours en premier, triées par date de début (plus récent en premier)
  // 2. Expériences terminées ensuite, triées par date de fin (plus récent en premier)
  // On garde _originalIndex pour que les mutations utilisent le bon index
  const experience = React.useMemo(() => {
    return rawExperience
      .map((e, idx) => ({ ...e, _originalIndex: idx }))
      .sort((a, b) => {
        const aIsCurrent = !a.end_date || a.end_date === "present";
        const bIsCurrent = !b.end_date || b.end_date === "present";

        // Les expériences en cours en premier
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;

        // Si les deux sont en cours, trier par start_date (plus ancien en premier = plus d'expérience)
        if (aIsCurrent && bIsCurrent) {
          const startA = normalizeDate(a.start_date);
          const startB = normalizeDate(b.start_date);
          return startA.localeCompare(startB);
        }

        // Sinon, trier par end_date (plus récent en premier)
        const endA = normalizeDate(a.end_date) || normalizeDate(a.start_date);
        const endB = normalizeDate(b.end_date) || normalizeDate(b.start_date);
        return endB.localeCompare(endA);
      });
  }, [rawExperience, normalizeDate]);

  const sectionTitles = props.sectionTitles || {};
  const cvLanguage = props.cvLanguage || 'fr';
  const cvT = getTranslatorForCvLanguage(cvLanguage);
  const title = getCvSectionTitleInCvLanguage('experience', sectionTitles.experience, cvLanguage);
  const { editing } = useAdmin();
  const { mutate } = useMutate();
  const { batchProcessingExpIndex } = useHighlight();

  // ---- UI State ----
  const [editIndex, setEditIndex] = React.useState(null);
  const [delIndex, setDelIndex] = React.useState(null);
  const [addOpen, setAddOpen]   = React.useState(false);

  // ---- Forms ----
  const emptyForm = { title:"", company:"", department_or_client:"", start:"", end:"", inProgress:false, city:"", region:"", country_code:"", description:"", responsibilities:"", deliverables:"", skills_used:"" };
  const [nf, setNf] = React.useState(emptyForm);
  const [f,  setF]  = React.useState({});

  // ---- Helpers ----
  // Normalise une date saisie vers le format YYYY-MM
  // Gère : YYYY-MM, YYYY, MM/YYYY, YYYY/MM
  const norm = React.useCallback((s) => {
    const v = (s || "").trim();
    if (!v) return "";
    if (v.toLowerCase() === "present") return "present";

    // Format YYYY-MM ou YYYY
    if (/^\d{4}(-\d{2})?$/.test(v)) {
      return v.length === 4 ? `${v}-01` : v;
    }

    // Format avec slash : MM/YYYY ou YYYY/MM
    if (v.includes("/")) {
      const parts = v.split("/");
      if (parts.length === 2) {
        const [p1, p2] = parts;
        // Si p1 a 4 chiffres -> YYYY/MM
        if (/^\d{4}$/.test(p1) && /^\d{1,2}$/.test(p2)) {
          return `${p1}-${p2.padStart(2, "0")}`;
        }
        // Si p2 a 4 chiffres -> MM/YYYY
        if (/^\d{4}$/.test(p2) && /^\d{1,2}$/.test(p1)) {
          return `${p2}-${p1.padStart(2, "0")}`;
        }
      }
    }

    return v;
  }, []);

  const isEmpty = experience.length === 0;
  if (!editing && isEmpty) return null; // Masquer entièrement hors édition s'il n'y a aucune expérience

  // ---- Actions ----
  const openEdit = (i) => {
    const e = experience[i] || {};
    const isCurrentPosition = !e.end_date || e.end_date === "present";
    setF({
      title: e.title || "",
      company: e.company || "",
      department_or_client: e.department_or_client || "",
      start: e.start_date || "",
      end: isCurrentPosition ? "" : (e.end_date || ""),
      inProgress: isCurrentPosition,
      city: e.location?.city || "",
      region: e.location?.region || "",
      country_code: e.location?.country_code || "",
      description: e.description || "",
      responsibilities: Array.isArray(e.responsibilities) ? e.responsibilities.join("\n") : "",
      deliverables: Array.isArray(e.deliverables) ? e.deliverables.join("\n") : "",
      skills_used: Array.isArray(e.skills_used) ? e.skills_used.join(", ") : ""
    });
    // Utiliser l'index original pour la mutation
    setEditIndex(e._originalIndex ?? i);
  };

  const saveEdit = async () => {
    const p = { title: f.title?.trim() || "Nouvelle expérience" };
    if (f.company) p.company = f.company;
    if (f.department_or_client) p.department_or_client = f.department_or_client;
    if (f.start) p.start_date = norm(f.start);
    if (f.inProgress) p.end_date = "present"; else if (f.end) p.end_date = norm(f.end);

    const loc = {};
    if (f.city) loc.city = f.city;
    if (f.region) loc.region = f.region;
    if (f.country_code) loc.country_code = f.country_code;
    if (Object.keys(loc).length) p.location = loc;

    if (f.description) p.description = f.description;

    const resp = (f.responsibilities || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (resp.length) p.responsibilities = resp;

    const del = (f.deliverables || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (del.length) p.deliverables = del;

    const skills = (f.skills_used || "").split(",").map(s => s.trim()).filter(Boolean);
    if (skills.length) p.skills_used = skills;

    await mutate({ op:"set", path:`experience[${editIndex}]`, value:p });
    setEditIndex(null);
  };

  const saveAdd = async () => {
    const p = { title: (nf.title || "Nouvelle expérience").trim() || "Nouvelle expérience" };
    if (nf.company) p.company = nf.company;
    if (nf.department_or_client) p.department_or_client = nf.department_or_client;
    if (nf.start) p.start_date = norm(nf.start);
    if (nf.inProgress) p.end_date = "present"; else if (nf.end) p.end_date = norm(nf.end);

    const loc = {};
    if (nf.city) loc.city = nf.city;
    if (nf.region) loc.region = nf.region;
    if (nf.country_code) loc.country_code = nf.country_code;
    if (Object.keys(loc).length) p.location = loc;

    if (nf.description) p.description = nf.description;

    const resp = (nf.responsibilities || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (resp.length) p.responsibilities = resp;

    const del = (nf.deliverables || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (del.length) p.deliverables = del;

    const skills = (nf.skills_used || "").split(",").map(s => s.trim()).filter(Boolean);
    if (skills.length) p.skills_used = skills;

    await mutate({ op:"push", path:"experience", value:p });
    setAddOpen(false);
    setNf(emptyForm);
  };

  const confirmDelete = async () => {
    await mutate({ op:"remove", path:`experience[${delIndex}]` });
    setDelIndex(null);
  };

  return (
    <Section
      title={
        <div className="flex items-center justify-between gap-2">
          <span>{title}</span>
          <div className="flex items-center gap-3">
            <SectionReviewActions section="experience" />
            {editing && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="no-print rounded-lg border-2 border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-xs text-white hover:bg-white/30 transition-colors duration-200"
              >
                {t("common.add")}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {experience.length > 0 ? (
          experience.map((e, i) => {
            const isProcessing = batchProcessingExpIndex === i;
            return (
            <div key={i} className="rounded-2xl border border-white/15 p-3 relative overflow-hidden">
              {/* Overlay de chargement pendant le batch processing */}
              {isProcessing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-900/85">
                  <div className="flex items-center gap-3 text-white">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm font-medium">{t("review.processing") || "Traitement..."}</span>
                  </div>
                </div>
              )}
              {/* Contenu flouté pendant le traitement */}
              <div className={isProcessing ? 'blur-md pointer-events-none' : ''}>
              <div className="flex flex-wrap items-baseline gap-2">
                <div className="font-semibold flex-1 min-w-0">
                  <ChangeHighlight section="experience" field="title" expIndex={e._originalIndex ?? i} className="font-semibold">
                    <span>{e.title || ""}</span>
                  </ChangeHighlight>
                  {e.company ? " • " : ""}{e.company || ""}{e.department_or_client ? ` (${e.department_or_client})` : ""}
                </div>
                <div className="ml-3 text-sm opacity-80 whitespace-nowrap">
                  {ym(e.start_date)} — {(!e.end_date || e.end_date === "present") ? cvT("cvSections.present") : ym(e.end_date)}
                </div>
                <ExperienceReviewActions expIndex={e._originalIndex ?? i} />
                {editing && (
                  <div className="no-print flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(i)}
                      className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-xs text-white hover:bg-white/30 transition-colors duration-200"
                    >
                      <img src="/icons/edit.png" alt="Edit" className="h-3 w-3 " />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDelIndex(e._originalIndex ?? i)}
                      className="rounded-lg border border-red-400/50 bg-red-500/30 backdrop-blur-sm px-2 py-1 text-xs text-white hover:bg-red-500/40 transition-colors duration-200"
                    >
                      <img src="/icons/delete.png" alt="Delete" className="h-3 w-3 " />
                    </button>
                  </div>
                )}
              </div>

              {e.location && (e.location.city || e.location.region || e.location.country_code) && (
                <div className="text-xs opacity-70 mt-0.5">
                  {[
                    e.location.city,
                    e.location.region,
                    e.location.country_code ? (t(`countries.${e.location.country_code}`) || e.location.country_code) : null
                  ].filter(Boolean).join(", ")}
              </div>
              )}

              <div className="mt-3 space-y-3">
                {e.description ? (
                  <ChangeHighlight
                    section="experience"
                    field="description"
                    expIndex={e._originalIndex ?? i}
                    className="text-sm text-justify opacity-95 whitespace-pre-line"
                  >
                    <p className="text-sm text-justify opacity-95 whitespace-pre-line">{e.description}</p>
                  </ChangeHighlight>
                ) : null}

                <div className="grid gap-4 md:grid-cols-3">
                  {/* Responsibilities - UN SEUL changement pour tout le bloc */}
                  <div className="md:col-span-2">
                    {(Array.isArray(e.responsibilities) && e.responsibilities.length > 0) && (
                      <ChangeHighlight
                        section="experience"
                        field="responsibilities"
                        expIndex={e._originalIndex ?? i}
                      >
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {e.responsibilities.map((r, j) => (
                            <li key={j}>{r}</li>
                          ))}
                        </ul>
                      </ChangeHighlight>
                    )}
                  </div>

                  {/* Deliverables - UN SEUL changement pour tout le bloc */}
                  <div className="md:col-span-1">
                    {(Array.isArray(e.deliverables) && e.deliverables.length > 0) && (
                      <>
                        <div className="text-sm font-medium mb-1">{cvT("cvSections.deliverables")}</div>
                        <ChangeHighlight
                          section="experience"
                          field="deliverables"
                          expIndex={e._originalIndex ?? i}
                        >
                          <ul className="list-disc pl-5 text-sm space-y-1">
                            {e.deliverables.map((d, j) => (
                              <li key={j}>{d}</li>
                            ))}
                          </ul>
                        </ChangeHighlight>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Skills used */}
              <div className="flex flex-wrap gap-1 mt-4">
                {Array.isArray(e.skills_used) && e.skills_used.map((m, k) => (
                  <SkillItemHighlight
                    key={k}
                    section="experience"
                    field="skills_used"
                    itemName={m}
                    expIndex={e._originalIndex ?? i}
                  >
                    <span className="inline-block rounded-sm border border-white/15 px-1.5 py-0.5 text-[11px] opacity-90">{capitalizeSkillName(m)}</span>
                  </SkillItemHighlight>
                ))}
                {/* Toujours afficher les compétences supprimées (même si tableau vide) */}
                <RemovedSkillsDisplay section="experience" field="skills_used" expIndex={e._originalIndex ?? i} />
              </div>
              </div>
            </div>
          );
          })
        ) : (
          editing && (
            <div className="rounded-2xl border border-white/15 p-3 text-sm opacity-60">
              {t("cvSections.noExperience")}
            </div>
          )
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={editIndex !== null} onClose={() => setEditIndex(null)} title={t("cvSections.editExperience")}>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.experienceTitleShort")} value={f.title || ""} onChange={e => setF({ ...f, title: e.target.value })} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.experienceCompanyShort")} value={f.company || ""} onChange={e => setF({ ...f, company: e.target.value })} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.experienceDepartment")} value={f.department_or_client || ""} onChange={e => setF({ ...f, department_or_client: e.target.value })} />

          <div className="grid grid-cols-2 gap-2">
            <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.experienceStartShort")} value={f.start || ""} onChange={e => setF({ ...f, start: e.target.value })} />
            <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.experienceEndShort")} value={f.end || ""} onChange={e => setF({ ...f, end: e.target.value })} disabled={f.inProgress} />
            <label className="text-xs col-span-2 inline-flex items-center gap-2 text-white drop-shadow">
              <input type="checkbox" checked={!!f.inProgress} onChange={e => setF({ ...f, inProgress: e.target.checked })} /> {t("cvSections.inProgress")}
            </label>
          </div>

          <div className="md:col-span-2 grid grid-cols-3 gap-2">
            <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.city")} value={f.city || ""} onChange={e => setF({ ...f, city: e.target.value })} />
            <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.region")} value={f.region || ""} onChange={e => setF({ ...f, region: e.target.value })} />
            <CountrySelect
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden appearance-none [&>option]:bg-gray-800 [&>option]:text-white"
              placeholder={t("cvSections.placeholders.selectCountry")}
              value={f.country_code || ""}
              onChange={v => setF({ ...f, country_code: v })}
            />
          </div>

          <textarea className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden md:col-span-2" placeholder="Description" rows={3} value={f.description || ""} onChange={e => setF({ ...f, description: e.target.value })} />
          <textarea className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden md:col-span-2" placeholder={t("cvSections.responsibilities")} rows={3} value={f.responsibilities || ""} onChange={e => setF({ ...f, responsibilities: e.target.value })} />
          <textarea className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden md:col-span-2" placeholder={t("cvSections.deliverables")} rows={3} value={f.deliverables || ""} onChange={e => setF({ ...f, deliverables: e.target.value })} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden md:col-span-2" placeholder={t("cvSections.skillsUsed")} value={f.skills_used || ""} onChange={e => setF({ ...f, skills_used: e.target.value })} />

          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setEditIndex(null)} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">{t("common.cancel")}</button>
            <button type="button" onClick={saveEdit} className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">{t("common.save")}</button>
          </div>
        </div>
      </Modal>

      {/* Add Modal */}
      <Modal open={!!addOpen} onClose={() => setAddOpen(false)} title={t("cvSections.addExperience")}>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.experienceTitleShort")} value={nf.title || ""} onChange={e => setNf({ ...nf, title: e.target.value })} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.experienceCompanyShort")} value={nf.company || ""} onChange={e => setNf({ ...nf, company: e.target.value })} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.experienceDepartment")} value={nf.department_or_client || ""} onChange={e => setNf({ ...nf, department_or_client: e.target.value })} />

          <div className="grid grid-cols-2 gap-2">
            <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.experienceStartShort")} value={nf.start || ""} onChange={e => setNf({ ...nf, start: e.target.value })} />
            <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.experienceEndShortWithPresent")} value={nf.end || ""} onChange={e => setNf({ ...nf, end: e.target.value })} disabled={nf.inProgress} />
          </div>
          <label className="text-xs flex items-center gap-2 text-white drop-shadow">
            <input type="checkbox" checked={!!nf.inProgress} onChange={e => setNf({ ...nf, inProgress: e.target.checked })} /> {t("cvSections.inProgress")}
          </label>

          <div className="md:col-span-2 grid grid-cols-3 gap-2">
            <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.city")} value={nf.city || ""} onChange={e => setNf({ ...nf, city: e.target.value })} />
            <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.region")} value={nf.region || ""} onChange={e => setNf({ ...nf, region: e.target.value })} />
            <CountrySelect
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden appearance-none [&>option]:bg-gray-800 [&>option]:text-white"
              placeholder={t("cvSections.placeholders.selectCountry")}
              value={nf.country_code || ""}
              onChange={v => setNf({ ...nf, country_code: v })}
            />
          </div>

          <textarea className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden md:col-span-2" placeholder="Description" rows={3} value={nf.description || ""} onChange={e => setNf({ ...nf, description: e.target.value })} />
          <textarea className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.responsibilities")} rows={3} value={nf.responsibilities || ""} onChange={e => setNf({ ...nf, responsibilities: e.target.value })} />
          <textarea className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.deliverables")} rows={3} value={nf.deliverables || ""} onChange={e => setNf({ ...nf, deliverables: e.target.value })} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden md:col-span-2" placeholder={t("cvSections.skillsUsed")} value={nf.skills_used || ""} onChange={e => setNf({ ...nf, skills_used: e.target.value })} />

          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">{t("common.cancel")}</button>
            <button type="button" onClick={saveAdd} className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">{t("common.add")}</button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={delIndex !== null} onClose={() => setDelIndex(null)} title={t("common.confirmation")}>
        <div className="space-y-3">
          <p className="text-sm text-white drop-shadow">{t("cvSections.deleteExperience")}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDelIndex(null)} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">{t("common.cancel")}</button>
            <button type="button" onClick={confirmDelete} className="px-6 py-2.5 rounded-lg bg-red-500/30 hover:bg-red-500/40 border border-red-500/50 text-white text-sm font-semibold transition-colors">{t("common.delete")}</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

"use client";
import React from "react";
import Section from "./Section";
import { ym } from "@/lib/utils";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getCvSectionTitleInCvLanguage } from "@/lib/i18n/cvLanguageHelper";

export default function Education(props){
  const { t } = useLanguage();
  const rawEducation = Array.isArray(props.education)? props.education:[];

  // Normalise une date vers le format YYYY-MM pour comparaison et sauvegarde
  // Gère : YYYY-MM, YYYY, MM/YYYY, YYYY/MM
  const normalizeDate = React.useCallback((date) => {
    if (!date) return "";
    const d = (typeof date === "string" ? date : "").trim();
    if (!d) return "";
    if (d.toLowerCase() === "present") return "present";

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
  // 1. Formations en cours en premier, triées par date de début (plus récent en premier)
  // 2. Formations terminées ensuite, triées par date de fin (plus récent en premier)
  // On garde _originalIndex pour que les mutations utilisent le bon index
  const education = React.useMemo(() => {
    return rawEducation
      .map((e, idx) => ({ ...e, _originalIndex: idx }))
      .sort((a, b) => {
        const aIsCurrent = !a.end_date || a.end_date === "present";
        const bIsCurrent = !b.end_date || b.end_date === "present";

        // Les formations en cours en premier
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;

        // Si les deux sont en cours, trier par start_date (plus récent en premier)
        if (aIsCurrent && bIsCurrent) {
          const startA = normalizeDate(a.start_date);
          const startB = normalizeDate(b.start_date);
          return startB.localeCompare(startA);
        }

        // Sinon, trier par end_date (plus récent en premier)
        const endA = normalizeDate(a.end_date) || normalizeDate(a.start_date);
        const endB = normalizeDate(b.end_date) || normalizeDate(b.start_date);
        return endB.localeCompare(endA);
      });
  }, [rawEducation, normalizeDate]);

  const sectionTitles = props.sectionTitles || {};
  const cvLanguage = props.cvLanguage || 'fr';
  const title = getCvSectionTitleInCvLanguage('education', sectionTitles.education, cvLanguage);
  const { editing } = useAdmin();
  const { mutate } = useMutate();
  const [editIndex, setEditIndex] = React.useState(null);
  const [delIndex, setDelIndex] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [f, setF] = React.useState({});
  const [nf, setNf] = React.useState({ institution:"", degree:"", field_of_study:"", start_date:"" , end_date:""});

  function openEdit(i){
    const e = education[i] || {};
    setF({
      institution: e.institution || "",
      degree: e.degree || "",
      field_of_study: e.field_of_study || "",
      start_date: e.start_date || "",
      end_date: e.end_date || ""
    });
    // Utiliser l'index original pour la mutation
    setEditIndex(e._originalIndex ?? i);
  }
  async function edit(){
    const p = {};
    if(f.institution) p.institution = f.institution;
    if(f.degree) p.degree = f.degree;
    if(f.field_of_study) p.field_of_study = f.field_of_study;
    if(f.start_date) p.start_date = normalizeDate(f.start_date);
    if(f.end_date) p.end_date = normalizeDate(f.end_date);
    await mutate({ op:"set", path:`education[${editIndex}]`, value:p });
    setEditIndex(null);
  }
  async function add(){
    const p = {};
    if(nf.institution) p.institution = nf.institution;
    if(nf.degree) p.degree = nf.degree;
    if(nf.field_of_study) p.field_of_study = nf.field_of_study;
    if(nf.start_date) p.start_date = normalizeDate(nf.start_date);
    if(nf.end_date) p.end_date = normalizeDate(nf.end_date);
    await mutate({ op:"push", path:"education", value:p });
    setNf({ institution:"", degree:"", field_of_study:"", start_date:"", end_date:"" });
    setAddOpen(false);
  }
  async function confirmDelete(){
    await mutate({ op:"remove", path:"education", index: delIndex });
    setDelIndex(null);
  }

  if (education.length===0 && !editing) return null;

  return (
      <Section
        title={
          <div className="flex items-center justify-between gap-2">
            <span>{title}</span>
            {editing && (
              <button
                onClick={() => setAddOpen(true)}
                className="no-print text-xs rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-white hover:bg-white/30 transition-all duration-200"
              >
                {t("common.add")}
              </button>
            )}
          </div>
        }
      >
        {(!education || education.length === 0) ? (
          <div className="rounded-xl border border-white/15 p-3 text-sm opacity-60">
            {t("cvSections.noEducation")}
          </div>
        ) : (
          <div className={education.length > 1 ? "grid md:grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
            {education.map((e, i) => (
              <div key={i} className="rounded-xl border border-white/15 p-3 relative z-0 overflow-visible">
                <div className={"flex items-start gap-2" + (editing ? " pr-20" : "")}>
                  <div className="font-semibold flex-1 min-w-0 break-words">
                    {e.institution || ""}
                  </div>
                  <div className="text-sm opacity-80 whitespace-nowrap ml-auto mt-1">
                    {e.start_date && e.start_date !== e.end_date ? (
                      <span>{ym(e.start_date)} — {ym(e.end_date)}</span>
                    ) : (
                      <span>{ym(e.end_date)}</span>
                    )}
                  </div>
                </div>

                {editing && (
                  <div className="no-print absolute top-2 right-2 z-20 flex gap-2">
                    <button onClick={() => openEdit(i)} className="text-[11px] rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-0.5 text-white hover:bg-white/30 transition-all duration-200"><img src="/icons/edit.png" alt="Edit" className="h-3 w-3 " /></button>
                    <button onClick={() => setDelIndex(e._originalIndex ?? i)} className="text-[11px] rounded-lg border border-red-400/50 bg-red-500/30 backdrop-blur-sm px-2 py-0.5 text-white hover:bg-red-500/40 transition-all duration-200"><img src="/icons/delete.png" alt="Delete" className="h-3 w-3 " /></button>
                  </div>
                )}

                <div className="text-sm opacity-80">
                  {e.degree || ""}
                  {e.degree && e.field_of_study ? " • " : ""}
                  {e.field_of_study || ""}
                </div>
              </div>
            ))}
          </div>
        )}

      <Modal open={editIndex!==null} onClose={()=>setEditIndex(null)} title={t("cvSections.editEducation")}>
        <div className="grid gap-2">
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.institution")} value={f.institution} onChange={e=>setF({...f,institution:e.target.value})} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.degree")} value={f.degree} onChange={e=>setF({...f,degree:e.target.value})} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.fieldOfStudy")} value={f.field_of_study} onChange={e=>setF({...f,field_of_study:e.target.value})} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.startDate")} value={f.start_date} onChange={e=>setF({...f,start_date:e.target.value})} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.endDate")} value={f.end_date} onChange={e=>setF({...f,end_date:e.target.value})} />
          <div className="flex justify-end gap-2">
            <button onClick={()=>setEditIndex(null)} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">{t("common.cancel")}</button>
            <button onClick={edit} className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">{t("common.save")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title={t("cvSections.addEducation")}>
        <div className="grid gap-2">
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.institution")} value={nf.institution} onChange={e=>setNf({...nf,institution:e.target.value})} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.degreeOrCertification")} value={nf.degree} onChange={e=>setNf({...nf,degree:e.target.value})} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.fieldOfStudy")} value={nf.field_of_study} onChange={e=>setNf({...nf,field_of_study:e.target.value})} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.startDate")} value={nf.start_date} onChange={e=>setNf({...nf,start_date:e.target.value})} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden" placeholder={t("cvSections.placeholders.endDate")} value={nf.end_date} onChange={e=>setNf({...nf,end_date:e.target.value})} />
          <div className="flex justify-end gap-2">
            <button onClick={()=>setAddOpen(false)} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">{t("common.cancel")}</button>
            <button onClick={add} className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">{t("common.add")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={delIndex!==null} onClose={()=>setDelIndex(null)} title={t("common.confirmation")}>
        <div className="space-y-3">
          <p className="text-sm text-white drop-shadow">{t("cvSections.deleteEducation")}</p>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setDelIndex(null)} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">{t("common.cancel")}</button>
            <button onClick={confirmDelete} className="px-6 py-2.5 rounded-lg bg-red-500/30 hover:bg-red-500/40 border border-red-500/50 text-white text-sm font-semibold transition-colors">{t("common.delete")}</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

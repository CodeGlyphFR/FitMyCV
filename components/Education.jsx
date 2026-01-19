"use client";
import React from "react";
import Section from "./Section";
import { ym } from "@/lib/utils";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import {
  ModalSection,
  FormField,
  Input,
  Grid,
  ModalFooter,
  ModalFooterDelete,
  GraduationCap,
  Calendar,
  MapPin,
} from "./ui/ModalForm";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getCvSectionTitleInCvLanguage } from "@/lib/i18n/cvLanguageHelper";
import CountrySelect from "./CountrySelect";
import MonthPicker from "./ui/MonthPicker";

export default function Education(props){
  const { t } = useLanguage();
  const rawEducation = Array.isArray(props.education)? props.education:[];

  // Normalise une date vers le format YYYY-MM pour comparaison et sauvegarde
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
        if (/^\d{4}$/.test(p1) && /^\d{1,2}$/.test(p2)) {
          return `${p1}-${p2.padStart(2, "0")}`;
        }
        if (/^\d{4}$/.test(p2) && /^\d{1,2}$/.test(p1)) {
          return `${p2}-${p1.padStart(2, "0")}`;
        }
      }
    }

    return d;
  }, []);

  // Tri par date décroissante (plus récent en premier)
  const education = React.useMemo(() => {
    return rawEducation
      .map((e, idx) => ({ ...e, _originalIndex: idx }))
      .sort((a, b) => {
        const aIsCurrent = !a.end_date || a.end_date === "present";
        const bIsCurrent = !b.end_date || b.end_date === "present";

        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;

        if (aIsCurrent && bIsCurrent) {
          const startA = normalizeDate(a.start_date);
          const startB = normalizeDate(b.start_date);
          return startB.localeCompare(startA);
        }

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

  // ---- UI State ----
  const [editIndex, setEditIndex] = React.useState(null);
  const [delIndex, setDelIndex] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);

  // ---- Forms ----
  const emptyForm = { institution:"", degree:"", field_of_study:"", start_date:"", end_date:"", city:"", region:"", country_code:"" };
  const [f, setF] = React.useState({});
  const [nf, setNf] = React.useState(emptyForm);

  // ---- Actions ----
  function openEdit(i){
    const e = education[i] || {};
    const loc = e.location || {};
    setF({
      institution: e.institution || "",
      degree: e.degree || "",
      field_of_study: e.field_of_study || "",
      start_date: e.start_date || "",
      end_date: e.end_date || "",
      city: loc.city || "",
      region: loc.region || "",
      country_code: loc.country_code || ""
    });
    setEditIndex(e._originalIndex ?? i);
  }

  async function saveEdit(){
    const p = {};
    if(f.institution) p.institution = f.institution;
    if(f.degree) p.degree = f.degree;
    if(f.field_of_study) p.field_of_study = f.field_of_study;
    if(f.start_date) p.start_date = normalizeDate(f.start_date);
    // Si vide ou "present", c'est une formation en cours
    if(!f.end_date || f.end_date.toLowerCase() === "present") p.end_date = "present";
    else p.end_date = normalizeDate(f.end_date);
    if(f.city || f.region || f.country_code) {
      p.location = {
        city: f.city || "",
        region: f.region || "",
        country_code: f.country_code || ""
      };
    }
    await mutate({ op:"set", path:`education[${editIndex}]`, value:p });
    setEditIndex(null);
  }

  async function saveAdd(){
    const p = {};
    if(nf.institution) p.institution = nf.institution;
    if(nf.degree) p.degree = nf.degree;
    if(nf.field_of_study) p.field_of_study = nf.field_of_study;
    if(nf.start_date) p.start_date = normalizeDate(nf.start_date);
    // Si vide ou "present", c'est une formation en cours
    if(!nf.end_date || nf.end_date.toLowerCase() === "present") p.end_date = "present";
    else p.end_date = normalizeDate(nf.end_date);
    if(nf.city || nf.region || nf.country_code) {
      p.location = {
        city: nf.city || "",
        region: nf.region || "",
        country_code: nf.country_code || ""
      };
    }
    await mutate({ op:"push", path:"education", value:p });
    setNf(emptyForm);
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
              className="no-print text-xs rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-white hover:bg-white/30 transition-colors duration-200"
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
                  <button onClick={() => openEdit(i)} className="text-[11px] rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-0.5 text-white hover:bg-white/30 transition-colors duration-200"><img src="/icons/edit.png" alt="Edit" className="h-3 w-3 " /></button>
                  <button onClick={() => setDelIndex(e._originalIndex ?? i)} className="text-[11px] rounded-lg border border-red-400/50 bg-red-500/30 backdrop-blur-sm px-2 py-0.5 text-white hover:bg-red-500/40 transition-colors duration-200"><img src="/icons/delete.png" alt="Delete" className="h-3 w-3 " /></button>
                </div>
              )}

              {e.location && (e.location.city || e.location.region || e.location.country_code) && (
                <div className="text-xs opacity-70 mt-0.5">
                  {[
                    e.location.city,
                    e.location.region,
                    e.location.country_code ? (t(`countries.${e.location.country_code}`) || e.location.country_code) : null
                  ].filter(Boolean).join(", ")}
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

      {/* Edit Modal */}
      <Modal open={editIndex !== null} onClose={() => setEditIndex(null)} title={t("cvSections.editEducation")} size="medium">
        <div className="space-y-3">
          <ModalSection title={t("cvSections.education")} icon={GraduationCap}>
            <FormField label={t("cvSections.placeholders.institution")}>
              <Input
                placeholder={t("cvSections.placeholders.institution")}
                value={f.institution || ""}
                onChange={e => setF({ ...f, institution: e.target.value })}
              />
            </FormField>
            <Grid cols={2}>
              <FormField label={t("cvSections.placeholders.degree")}>
                <Input
                  placeholder={t("cvSections.placeholders.degree")}
                  value={f.degree || ""}
                  onChange={e => setF({ ...f, degree: e.target.value })}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.fieldOfStudy")}>
                <Input
                  placeholder={t("cvSections.placeholders.fieldOfStudy")}
                  value={f.field_of_study || ""}
                  onChange={e => setF({ ...f, field_of_study: e.target.value })}
                />
              </FormField>
            </Grid>
          </ModalSection>

          <ModalSection title={t("cvSections.period")} icon={Calendar}>
            <div className="flex flex-wrap items-end gap-2">
              <FormField label={t("cvSections.placeholders.experienceStartShort")} className="flex-1 min-w-[140px]">
                <MonthPicker
                  placeholder={t("cvSections.placeholders.dateFormat")}
                  value={f.start_date || ""}
                  onChange={v => setF({ ...f, start_date: v })}
                  todayLabel={t("common.today")}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.experienceEndShort")} className="flex-1 min-w-[140px]">
                <MonthPicker
                  placeholder={t("cvSections.placeholders.dateFormat")}
                  value={f.end_date || ""}
                  onChange={v => setF({ ...f, end_date: v })}
                  todayLabel={t("common.ongoing")}
                  presentLabel={t("common.ongoing")}
                  presentMode
                />
              </FormField>
            </div>
          </ModalSection>

          <ModalSection title={t("cvSections.location")} icon={MapPin}>
            <Grid cols={3}>
              <FormField label={t("cvSections.placeholders.city")}>
                <Input
                  placeholder={t("cvSections.placeholders.cityHint")}
                  value={f.city || ""}
                  onChange={e => setF({ ...f, city: e.target.value })}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.region")}>
                <Input
                  placeholder={t("cvSections.placeholders.regionHint")}
                  value={f.region || ""}
                  onChange={e => setF({ ...f, region: e.target.value })}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.selectCountry")}>
                <CountrySelect
                  className="w-full rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm text-white transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none appearance-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white"
                  placeholder={t("cvSections.placeholders.selectCountry")}
                  value={f.country_code || ""}
                  onChange={v => setF({ ...f, country_code: v })}
                />
              </FormField>
            </Grid>
          </ModalSection>

          <ModalFooter
            onCancel={() => setEditIndex(null)}
            onSave={saveEdit}
            cancelLabel={t("common.cancel")}
            saveLabel={t("common.save")}
          />
        </div>
      </Modal>

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t("cvSections.addEducation")} size="medium">
        <div className="space-y-3">
          <ModalSection title={t("cvSections.education")} icon={GraduationCap}>
            <FormField label={t("cvSections.placeholders.institution")}>
              <Input
                placeholder={t("cvSections.placeholders.institution")}
                value={nf.institution || ""}
                onChange={e => setNf({ ...nf, institution: e.target.value })}
              />
            </FormField>
            <Grid cols={2}>
              <FormField label={t("cvSections.placeholders.degreeOrCertification")}>
                <Input
                  placeholder={t("cvSections.placeholders.degreeOrCertification")}
                  value={nf.degree || ""}
                  onChange={e => setNf({ ...nf, degree: e.target.value })}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.fieldOfStudy")}>
                <Input
                  placeholder={t("cvSections.placeholders.fieldOfStudy")}
                  value={nf.field_of_study || ""}
                  onChange={e => setNf({ ...nf, field_of_study: e.target.value })}
                />
              </FormField>
            </Grid>
          </ModalSection>

          <ModalSection title={t("cvSections.period")} icon={Calendar}>
            <div className="flex flex-wrap items-end gap-2">
              <FormField label={t("cvSections.placeholders.experienceStartShort")} className="flex-1 min-w-[140px]">
                <MonthPicker
                  placeholder={t("cvSections.placeholders.dateFormat")}
                  value={nf.start_date || ""}
                  onChange={v => setNf({ ...nf, start_date: v })}
                  todayLabel={t("common.today")}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.experienceEndShort")} className="flex-1 min-w-[140px]">
                <MonthPicker
                  placeholder={t("cvSections.placeholders.dateFormat")}
                  value={nf.end_date || ""}
                  onChange={v => setNf({ ...nf, end_date: v })}
                  todayLabel={t("common.ongoing")}
                  presentLabel={t("common.ongoing")}
                  presentMode
                />
              </FormField>
            </div>
          </ModalSection>

          <ModalSection title={t("cvSections.location")} icon={MapPin}>
            <Grid cols={3}>
              <FormField label={t("cvSections.placeholders.city")}>
                <Input
                  placeholder={t("cvSections.placeholders.cityHint")}
                  value={nf.city || ""}
                  onChange={e => setNf({ ...nf, city: e.target.value })}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.region")}>
                <Input
                  placeholder={t("cvSections.placeholders.regionHint")}
                  value={nf.region || ""}
                  onChange={e => setNf({ ...nf, region: e.target.value })}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.selectCountry")}>
                <CountrySelect
                  className="w-full rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm text-white transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none appearance-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white"
                  placeholder={t("cvSections.placeholders.selectCountry")}
                  value={nf.country_code || ""}
                  onChange={v => setNf({ ...nf, country_code: v })}
                />
              </FormField>
            </Grid>
          </ModalSection>

          <ModalFooter
            onCancel={() => setAddOpen(false)}
            onSave={saveAdd}
            cancelLabel={t("common.cancel")}
            saveLabel={t("common.add")}
          />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={delIndex !== null} onClose={() => setDelIndex(null)} title={t("common.confirmation")}>
        <div className="space-y-3">
          <p className="text-sm text-white/80">
            {t("cvSections.deleteEducation")}
            {delIndex !== null && rawEducation[delIndex]?.institution && (
              <span className="font-medium text-white"> "{rawEducation[delIndex].institution}"</span>
            )}
          </p>
          <ModalFooterDelete
            onCancel={() => setDelIndex(null)}
            onDelete={confirmDelete}
            cancelLabel={t("common.cancel")}
            deleteLabel={t("common.delete")}
          />
        </div>
      </Modal>
    </Section>
  );
}

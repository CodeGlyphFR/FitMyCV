"use client";
import React from "react";
import Section from "./Section";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import FormRow from "./ui/FormRow";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getCvSectionTitleInCvLanguage } from "@/lib/i18n/cvLanguageHelper";
import VersionSelector from "./VersionSelector";
import ChangeHighlight, { ReviewProgressBar } from "./ChangeHighlight";

export default function Summary(props){
  const { t } = useLanguage();
  const summary = props.summary || {};
  const cvLanguage = props.cvLanguage || 'fr';
  const title = getCvSectionTitleInCvLanguage('summary', props.sectionTitles?.summary, cvLanguage);
  const { editing } = useAdmin();
  const { mutate } = useMutate();

  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(summary.description || "");
  React.useEffect(()=>{ setText(summary.description || ""); }, [summary]);

  const isEmpty = !((summary.description || "").trim());

  async function save(){
    await mutate({ op:"set", path:"summary.description", value: text });
    setOpen(false);
  }

  async function clear(){
    await mutate({ op:"set", path:"summary.description", value: "" });
    setText("");
  }

  // Masquer entièrement la section si vide et pas en édition
  if (!editing && isEmpty) return null;

  return (
    <Section
      noBackground={true}
      title={
        <div className="flex items-center justify-between gap-2 w-full">
          <span>{title}</span>
          <div className="flex items-center gap-2">
            {editing && (
              <div className="flex gap-2">
                <button
                  onClick={()=>setOpen(true)}
                  className="no-print text-xs rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-0.5 text-white hover:bg-white/30 transition-colors duration-200"
                >
                  <img src="/icons/edit.png" alt="Edit" className="h-3 w-3 " />
                </button>
                {!isEmpty && (
                  <button
                    onClick={clear}
                    className="no-print text-xs rounded-lg border border-red-400/50 bg-red-500/30 backdrop-blur-sm px-2 py-0.5 text-white hover:bg-red-500/40 transition-colors duration-200"
                  >
                    <img src="/icons/delete.png" alt="Delete" className="h-3 w-3 " />
                  </button>
                )}
              </div>
            )}
            {/* Barre de progression review */}
            <div className="no-print">
              <ReviewProgressBar />
            </div>
            {/* Sélecteur de version */}
            <div className="no-print">
              <VersionSelector />
            </div>
          </div>
        </div>
      }
    >
      {isEmpty ? (
        editing ? (
          <p className="text-sm opacity-60">{t("cvSections.noSummary")}</p>
        ) : null
      ) : (
        <p
          className="text-sm text-justify leading-relaxed opacity-95 whitespace-pre-line"
          suppressHydrationWarning
        >
          <ChangeHighlight
            section="summary"
            field="description"
            className="text-sm text-justify leading-relaxed opacity-95 whitespace-pre-line"
          >
            {summary.description}
          </ChangeHighlight>
        </p>
      )}

      <Modal open={open} onClose={()=>setOpen(false)} title={t("cvSections.editSummary")}>
        <div className="space-y-2">
          <FormRow label={t("cvSections.summary")}>
            <textarea
              className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-colors duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-hidden leading-relaxed"
              rows={8}
              value={text}
              onChange={e=>setText(e.target.value)}
            />
          </FormRow>
          <div className="flex justify-end gap-2">
            <button
              onClick={()=>setOpen(false)}
              className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={save}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

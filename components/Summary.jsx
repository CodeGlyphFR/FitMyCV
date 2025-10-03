"use client";
import React from "react";
import Section from "./Section";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import FormRow from "./ui/FormRow";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getSectionTitle } from "@/lib/i18n/cvLabels";
import { useHighlight } from "./HighlightProvider";

export default function Summary(props){
  const { t } = useLanguage();
  const summary = props.summary || {};
  const title = getSectionTitle('summary', props.sectionTitles?.summary, t);
  const { editing } = useAdmin();
  const { mutate } = useMutate();
  const { isModified, getChangeInfo, isHighlightEnabled } = useHighlight();

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

  // Vérifier si cette section a été modifiée
  const isSectionModified = isModified('summary', 'description');
  const changeInfo = getChangeInfo('summary', 'description');

  // Appliquer les styles de highlighting si activé et modifié
  const highlightStyles = isSectionModified && isHighlightEnabled
    ? 'bg-yellow-50 border-l-4 border-yellow-400 pl-3 -ml-3 transition-all duration-300 animate-pulse-once'
    : '';

  return (
    <Section
      title={
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            {title}
            {isSectionModified && isHighlightEnabled && (
              <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
                Modifié
              </span>
            )}
          </span>
          {editing && (
            <div className="flex gap-2">
              <button
                onClick={()=>setOpen(true)}
                className="no-print text-xs rounded border px-2 py-0.5"
              >
                🖊️
              </button>
              {!isEmpty && (
                <button
                  onClick={clear}
                  className="no-print text-xs rounded border px-2 py-0.5 text-red-600"
                >
                  ❌
                </button>
              )}
            </div>
          )}
        </div>
      }
    >
      {isEmpty ? (
        editing ? (
          <p className="text-sm opacity-60">{t("cvSections.noSummary")}</p>
        ) : null
      ) : (
        <div className={highlightStyles}>
          <p
            className="text-sm text-justify leading-relaxed opacity-95 whitespace-pre-line"
            suppressHydrationWarning
          >
            {summary.description}
          </p>
          {changeInfo && isHighlightEnabled && (
            <div className="mt-2 text-xs text-yellow-700 italic">
              💡 {changeInfo.change || "Section améliorée"}
            </div>
          )}
        </div>
      )}

      <Modal open={open} onClose={()=>setOpen(false)} title={t("cvSections.editSummary")}>
        <div className="space-y-2">
          <FormRow label={t("cvSections.summary")}>
            <textarea
              className="w-full rounded border p-2 text-sm"
              rows={6}
              value={text}
              onChange={e=>setText(e.target.value)}
            />
          </FormRow>
          <div className="flex justify-end gap-2">
            <button
              onClick={()=>setOpen(false)}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={save}
              className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

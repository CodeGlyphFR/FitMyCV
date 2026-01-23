"use client";
import React from "react";
import Section from "@/components/layout/Section";
import { useAdmin } from "@/components/admin/AdminProvider";
import useMutate from "@/components/admin/useMutate";
import Modal from "@/components/ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getCvSectionTitleInCvLanguage } from "@/lib/i18n/cvLanguageHelper";
import VersionSelector from "@/components/cv-improvement/VersionSelector";
import ChangeHighlight, { ReviewProgressBar } from "@/components/cv-review/ChangeHighlight";
import { FileText, Pencil, Trash2 } from "lucide-react";
import ContextMenu from "@/components/ui/ContextMenu";
import {
  ModalSection,
  FormField,
  Textarea,
  ModalFooter,
} from "@/components/ui/ModalForm";

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
              <ContextMenu
                items={[
                  { icon: Pencil, label: t("common.edit"), onClick: () => setOpen(true) },
                  ...(isEmpty ? [] : [{ icon: Trash2, label: t("common.delete"), onClick: clear, danger: true }])
                ]}
              />
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
        <div className="space-y-3">
          <ModalSection title={t("cvSections.summary")} icon={FileText}>
            <FormField label={t("cvSections.placeholders.summaryDescription")}>
              <Textarea
                rows={8}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={t("cvSections.placeholders.summaryDescription")}
                className="leading-relaxed"
              />
            </FormField>
          </ModalSection>

          <ModalFooter
            onCancel={() => setOpen(false)}
            onSave={save}
            saveLabel={t("common.save")}
            cancelLabel={t("common.cancel")}
          />
        </div>
      </Modal>
    </Section>
  );
}

"use client";
import React, { useState, useRef } from "react";
import Section from "@/components/layout/Section";
import { useAdmin } from "@/components/admin/AdminProvider";
import useMutate from "@/components/admin/useMutate";
import Modal from "@/components/ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getLanguageLevelLabel } from "@/lib/i18n/cvLabels";
import { getCvSectionTitleInCvLanguage, getTranslatorForCvLanguage } from "@/lib/i18n/cvLanguageHelper";
import { capitalizeSkillName, toTitleCase } from "@/lib/utils/textFormatting";
import SectionReviewActions from "@/components/cv-review/SectionReviewActions";
import { useLanguageHasChanges } from "@/components/cv-review/LanguageReviewActions";
import ChangeReviewPopover from "@/components/cv-review/ChangeReviewPopover";
import ReviewableItemCard from "@/components/cv-review/ReviewableItemCard";
import { useItemChanges } from "@/components/cv-review/useItemChanges";
import { useReview } from "@/components/providers/ReviewProvider";
import { Languages as LanguagesIcon } from "lucide-react";
import {
  ModalSection,
  FormField,
  Input,
  Grid,
  ModalFooter,
  ModalFooterDelete,
} from "@/components/ui/ModalForm";
import ContextMenu from "@/components/ui/ContextMenu";
import { Pencil, Trash2 } from "lucide-react";

/**
 * Composant pour une langue individuelle avec highlight review
 */
function LanguageItem({ language, index, isEditing, onEdit, onDelete, cvT, t }) {
  const { hasChanges, change } = useLanguageHasChanges(language.name);
  const { acceptChange, rejectChange } = useReview();
  const [showPopover, setShowPopover] = useState(false);
  const itemRef = useRef(null);

  // Classes conditionnelles pour le highlight (ambre pour modifications)
  const itemClasses = [
    "relative inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm",
    hasChanges
      ? "border-2 border-amber-500/50 bg-amber-500/10 cursor-pointer" // Modifié = ambre + clickable
      : "border border-white/15", // Normal
  ].join(" ");

  const handleClick = () => {
    if (hasChanges && !isEditing) {
      setShowPopover(true);
    }
  };

  const handleAccept = async () => {
    if (change) {
      await acceptChange(change.id);
      setShowPopover(false);
    }
  };

  const handleReject = async () => {
    if (change) {
      await rejectChange(change.id);
      setShowPopover(false);
    }
  };

  // Affichage du niveau : essayer la traduction, sinon afficher tel quel
  const displayLevel = getLanguageLevelLabel(language.level, cvT) || capitalizeSkillName(language.level) || "";

  return (
    <>
      <div ref={itemRef} className={itemClasses} onClick={handleClick}>
        <div>
          <span className="font-semibold">{toTitleCase(language.name) || ""}</span>
          <span className="text-sm opacity-80"> : {displayLevel}</span>
        </div>

        {isEditing && (
          <ContextMenu
            items={[
              { icon: Pencil, label: t("common.edit"), onClick: () => onEdit(index) },
              { icon: Trash2, label: t("common.delete"), onClick: () => onDelete(index), danger: true }
            ]}
          />
        )}
      </div>

      {/* Popover de review au clic */}
      {showPopover && change && (
        <ChangeReviewPopover
          change={change}
          onAccept={handleAccept}
          onReject={handleReject}
          onClose={() => setShowPopover(false)}
          anchorRef={itemRef}
          showBeforeText={true}
        />
      )}
    </>
  );
}

export default function Languages(props){
  const { t } = useLanguage();
  const languages = Array.isArray(props.languages)? props.languages:[];
  const sectionTitles = props.sectionTitles || {};
  const cvLanguage = props.cvLanguage || 'fr';
  const cvT = getTranslatorForCvLanguage(cvLanguage);
  const title = getCvSectionTitleInCvLanguage('languages', sectionTitles.languages, cvLanguage);
  const { editing } = useAdmin();
  const { mutate } = useMutate();

  // Récupérer les langues supprimées pour les afficher
  const { removedItems: removedLanguages } = useItemChanges("languages");

  const [editIndex, setEditIndex] = React.useState(null);
  const [delIndex, setDelIndex] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [f, setF] = React.useState({ name:"", level:"" });
  const [nf, setNf] = React.useState({ name:"", level:"" });

  function openEdit(i){
    const e = languages[i] || {};
    setF({ name: e.name || "", level: e.level || "" });
    setEditIndex(i);
  }
  async function save(){
    const p={};
    if(f.name) p.name=f.name;
    if(f.level) p.level=f.level;
    await mutate({ op:"set", path:`languages[${editIndex}]`, value:p });
    setEditIndex(null);
  }
  async function add(){
    const p={};
    if(nf.name) p.name=nf.name;
    if(nf.level) p.level=nf.level;
    await mutate({ op:"push", path:"languages", value:p });
    setNf({ name:"", level:"" });
    setAddOpen(false);
  }
  async function confirmDelete(){
    await mutate({ op:"remove", path:"languages", index: delIndex });
    setDelIndex(null);
  }

  // Nom de la langue à supprimer pour le modal de confirmation
  const languageToDelete = delIndex !== null ? languages[delIndex] : null;
  const languageNameToDelete = languageToDelete?.name || "";

  // Masquer entièrement la section si aucune langue, pas en édition et pas de langues supprimées
  const hasRemovedLanguages = removedLanguages.length > 0;
  if (languages.length===0 && !editing && !hasRemovedLanguages) return null;

  return (
    <Section title={
      <div className="flex items-center justify-between gap-2">
        <span>{title}</span>
        <div className="flex items-center gap-2">
          <SectionReviewActions section="languages" />
          {editing && (<button onClick={()=>setAddOpen(true)} className="no-print text-xs rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-white hover:bg-white/30 transition-colors duration-200">{t("common.add")}</button>)}
        </div>
      </div>
    }>
      {languages.length === 0 && !hasRemovedLanguages ? (
        // Édition vide : message bordé
        editing ? (
          <div className="rounded-2xl border border-white/15 p-3 text-sm opacity-60">
            {t("cvSections.noLanguages")}
          </div>
        ) : null
      ) : (
        <div className="flex flex-wrap gap-2">
          {/* Langues existantes */}
          {languages.map((l, i) => (
            <LanguageItem
              key={i}
              language={l}
              index={i}
              isEditing={editing}
              onEdit={openEdit}
              onDelete={setDelIndex}
              cvT={cvT}
              t={t}
            />
          ))}

          {/* Langues supprimées par l'IA (badges rouges) */}
          {removedLanguages.map((change) => (
            <ReviewableItemCard
              key={change.id}
              change={change}
              variant="badge"
              className="no-print"
            >
              <span className="font-semibold">{toTitleCase(change.itemName) || change.change}</span>
              {change.beforeValue?.level && (
                <span className="text-sm opacity-80"> : {getLanguageLevelLabel(change.beforeValue.level, cvT) || change.beforeValue.level}</span>
              )}
            </ReviewableItemCard>
          ))}
        </div>
      )}

      {/* Modal Édition */}
      <Modal open={editIndex!==null} onClose={()=>setEditIndex(null)} title={t("cvSections.editLanguages")}>
        <div className="space-y-3">
          <ModalSection title={t("cvSections.languages")} icon={LanguagesIcon}>
            <Grid cols={2}>
              <FormField label={t("cvSections.placeholders.languageName")}>
                <Input
                  placeholder={t("cvSections.placeholders.languageName")}
                  value={f.name}
                  onChange={e => setF({...f, name: e.target.value})}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.languageLevel")}>
                <Input
                  placeholder={t("cvSections.placeholders.languageLevel")}
                  value={f.level}
                  onChange={e => setF({...f, level: e.target.value})}
                />
              </FormField>
            </Grid>
          </ModalSection>

          <ModalFooter
            onCancel={() => setEditIndex(null)}
            onSave={save}
            saveLabel={t("common.save")}
            cancelLabel={t("common.cancel")}
          />
        </div>
      </Modal>

      {/* Modal Ajout */}
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title={t("cvSections.addLanguage")}>
        <div className="space-y-3">
          <ModalSection title={t("cvSections.languages")} icon={LanguagesIcon}>
            <Grid cols={2}>
              <FormField label={t("cvSections.placeholders.languageName")}>
                <Input
                  placeholder={t("cvSections.placeholders.languageName")}
                  value={nf.name}
                  onChange={e => setNf({...nf, name: e.target.value})}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.languageLevel")}>
                <Input
                  placeholder={t("cvSections.placeholders.languageLevel")}
                  value={nf.level}
                  onChange={e => setNf({...nf, level: e.target.value})}
                />
              </FormField>
            </Grid>
          </ModalSection>

          <ModalFooter
            onCancel={() => setAddOpen(false)}
            onSave={add}
            saveLabel={t("common.add")}
            cancelLabel={t("common.cancel")}
          />
        </div>
      </Modal>

      {/* Modal Suppression */}
      <Modal open={delIndex!==null} onClose={()=>setDelIndex(null)} title={t("common.confirmation")}>
        <div className="space-y-3">
          <p className="text-sm text-white/80">
            {t("cvSections.deleteLanguage")}
            {languageNameToDelete && (
              <span className="font-semibold text-white"> "{languageNameToDelete}"</span>
            )}
            {" ?"}
          </p>
          <ModalFooterDelete
            onCancel={() => setDelIndex(null)}
            onDelete={confirmDelete}
            deleteLabel={t("common.delete")}
            cancelLabel={t("common.cancel")}
          />
        </div>
      </Modal>
    </Section>
  );
}

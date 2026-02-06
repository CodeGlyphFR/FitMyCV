"use client";
import React from "react";
import Section from "@/components/layout/Section";
import { useAdmin } from "@/components/admin/AdminProvider";
import useMutate from "@/components/admin/useMutate";
import Modal from "@/components/ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getCvSectionTitleInCvLanguage } from "@/lib/i18n/cvLanguageHelper";
import { capitalizeSkillName, toTitleCase } from "@/lib/utils/textFormatting";
import ReviewableItemCard from "@/components/cv-review/ReviewableItemCard";
import SectionReviewActions from "@/components/cv-review/SectionReviewActions";
import { useItemChanges } from "@/components/cv-review/useItemChanges";
import { Info } from "lucide-react";
import {
  ModalSection,
  FormField,
  Input,
  Textarea,
  ModalFooter,
  ModalFooterDelete,
} from "@/components/ui/ModalForm";
import ContextMenu from "@/components/ui/ContextMenu";
import { useReview } from "@/components/providers/ReviewProvider";
import { Pencil, Trash2, Plus } from "lucide-react";

export default function Extras(props){
  const { t } = useLanguage();
  const extras = Array.isArray(props.extras)? props.extras:[];
  const sectionTitles = props.sectionTitles || {};
  const cvLanguage = props.cvLanguage || 'fr';
  const title = getCvSectionTitleInCvLanguage('extras', sectionTitles.extras, cvLanguage);
  const { editing } = useAdmin();
  const { mutate } = useMutate();
  const { pendingChanges, isLatestVersion } = useReview();
  const sectionHasChanges = isLatestVersion && pendingChanges.some(c => c.section === "extras" && c.status === "pending");
  const canAdd = editing && !sectionHasChanges;
  const itemHasChanges = (name) => isLatestVersion && pendingChanges.some(c => c.section === "extras" && c.status === "pending" && c.itemName?.toLowerCase() === (name || "").toLowerCase());
  const canEditItem = (name) => editing && !itemHasChanges(name);

  // Récupérer les extras ajoutés, supprimés et modifiés pour les afficher
  const { removedItems: removedExtras, addedItems: addedExtras, modifiedItems: modifiedExtras } = useItemChanges("extras");
  const hasRemovedExtras = removedExtras.length > 0;

  // Helper pour trouver si un extra a un changement "added" pending
  const findAddedChange = (extra) => {
    return addedExtras.find(c =>
      c.itemName?.toLowerCase() === (extra.name || "").toLowerCase()
    );
  };

  // Helper pour trouver si un extra a un changement "modified" pending
  const findModifiedChange = (extra) => {
    return modifiedExtras.find(c =>
      c.afterValue?.name?.toLowerCase() === (extra.name || "").toLowerCase()
    );
  };

  const [editIndex, setEditIndex] = React.useState(null);
  const [delIndex, setDelIndex] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [f, setF] = React.useState({ name:"", summary:"" });
  const [nf, setNf] = React.useState({ name:"", summary:"" });

  function openEdit(i){
    const e = extras[i] || {};
    setF({ name: e.name || "", summary: e.summary || "" });
    setEditIndex(i);
  }
  async function save(){
    const p={};
    if(f.name) p.name=f.name;
    if(f.summary) p.summary=f.summary;
    await mutate({ op:"set", path:`extras[${editIndex}]`, value:p });
    setEditIndex(null);
  }
  async function add(){
    const p={};
    if(nf.name) p.name=nf.name;
    if(nf.summary) p.summary=nf.summary;
    await mutate({ op:"push", path:"extras", value:p });
    setNf({ name:"", summary:"" });
    setAddOpen(false);
  }
  async function confirmDelete(){
    await mutate({ op:"remove", path:"extras", index: delIndex });
    setDelIndex(null);
  }

  // Nom de l'extra à supprimer pour le modal de confirmation
  const extraToDelete = delIndex !== null ? extras[delIndex] : null;
  const extraNameToDelete = extraToDelete?.name || "";

  // Masquer entièrement si vide et pas en édition et pas d'éléments supprimés
  if (extras.length===0 && !editing && !hasRemovedExtras) return null;

  return (
    <Section title={
      <div className="flex items-center justify-between gap-2">
        <span>{title}</span>
        <div className="flex items-center gap-3">
          <SectionReviewActions section="extras" />
          {canAdd && (
            <button
              type="button"
              onClick={()=>setAddOpen(true)}
              className="no-print flex items-center justify-center p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    }>
      {extras.length === 0 && !hasRemovedExtras ? (
        editing ? (
          <div className="rounded-xl border border-white/15 p-3 text-sm opacity-60">
            {t("cvSections.noExtras")}
          </div>
        ) : null
      ) : (
        <div className="space-y-3">
          {/* Badges courts (≤40 caractères) + Extras supprimés courts */}
          {(extras.filter(e => (e.summary || "").length <= 40).length > 0 ||
            removedExtras.filter(c => !c.beforeValue?.summary || (c.beforeValue.summary || "").length <= 40).length > 0) && (
            <div className="flex flex-wrap gap-2">
              {extras.filter(e => (e.summary || "").length <= 40).map((e,i)=>{
                const originalIndex = extras.indexOf(e);
                const addedChange = findAddedChange(e);
                const modifiedChange = findModifiedChange(e);

                const badgeContent = (
                  <>
                    <div>
                      <span className="font-semibold">{toTitleCase(e.name) || ""}</span>
                      <span className="text-sm opacity-80"> : {e.summary || ""}</span>
                    </div>
                    {canEditItem(e.name) && (
                      <ContextMenu
                        compact
                        items={[
                          { icon: Pencil, label: t("common.edit"), onClick: () => openEdit(originalIndex) },
                          { icon: Trash2, label: t("common.delete"), onClick: () => setDelIndex(originalIndex), danger: true }
                        ]}
                      />
                    )}
                  </>
                );

                // Si c'est un extra ajouté ou modifié, wrapper dans ReviewableItemCard
                if (addedChange || modifiedChange) {
                  return (
                    <ReviewableItemCard
                      key={originalIndex}
                      change={addedChange || modifiedChange}
                      variant="badge"
                    >
                      {badgeContent}
                    </ReviewableItemCard>
                  );
                }

                return (
                  <div key={originalIndex} className="relative inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm overflow-visible">
                    {badgeContent}
                  </div>
                );
              })}

              {/* Extras supprimés (badges rouges) - pour ceux avec description courte */}
              {removedExtras.filter(c => !c.beforeValue?.summary || (c.beforeValue.summary || "").length <= 40).map((change) => (
                <ReviewableItemCard
                  key={change.id}
                  change={change}
                  variant="badge"
                  className="no-print"
                >
                  <span className="font-semibold">{toTitleCase(change.itemName) || change.change}</span>
                  {change.beforeValue?.summary && (
                    <span className="text-sm opacity-80"> : {change.beforeValue.summary}</span>
                  )}
                </ReviewableItemCard>
              ))}
            </div>
          )}
          {/* Boites carrées pour descriptions longues (>40 caractères) */}
          {extras.filter(e => (e.summary || "").length > 40).length > 0 && (
            <div className={extras.filter(e => (e.summary || "").length > 40).length > 1 ? "grid md:grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
              {extras.filter(e => (e.summary || "").length > 40).map((e,i)=>{
                const originalIndex = extras.indexOf(e);
                const addedChange = findAddedChange(e);
                const modifiedChange = findModifiedChange(e);

                const cardContent = (
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <div className="font-semibold">{toTitleCase(e.name) || ""}</div>
                      <div className="text-sm opacity-80">{e.summary || ""}</div>
                    </div>
                    {canEditItem(e.name) && (
                      <ContextMenu
                        items={[
                          { icon: Pencil, label: t("common.edit"), onClick: () => openEdit(originalIndex) },
                          { icon: Trash2, label: t("common.delete"), onClick: () => setDelIndex(originalIndex), danger: true }
                        ]}
                      />
                    )}
                  </div>
                );

                // Si c'est un extra ajouté ou modifié, wrapper dans ReviewableItemCard
                if (addedChange || modifiedChange) {
                  return (
                    <ReviewableItemCard
                      key={originalIndex}
                      change={addedChange || modifiedChange}
                    >
                      {cardContent}
                    </ReviewableItemCard>
                  );
                }

                return (
                  <div key={originalIndex} className="rounded-xl border border-white/15 p-3 relative z-0 overflow-visible">
                    {cardContent}
                  </div>
                );
              })}
            </div>
          )}

          {/* Extras supprimés (cartes rouges) - pour ceux avec description longue */}
          {removedExtras.filter(c => c.beforeValue?.summary && (c.beforeValue.summary || "").length > 40).length > 0 && (
            <div className={removedExtras.filter(c => c.beforeValue?.summary && (c.beforeValue.summary || "").length > 40).length > 1 ? "grid md:grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
              {removedExtras.filter(c => c.beforeValue?.summary && (c.beforeValue.summary || "").length > 40).map((change) => (
                <ReviewableItemCard
                  key={change.id}
                  change={change}
                  className="no-print"
                >
                  <div className="font-semibold">{toTitleCase(change.itemName) || change.change}</div>
                  {change.beforeValue?.summary && (
                    <div className="text-sm opacity-80">{change.beforeValue.summary}</div>
                  )}
                </ReviewableItemCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Édition */}
      <Modal open={editIndex!==null} onClose={()=>setEditIndex(null)} title={t("cvSections.editExtras")}>
        <div className="space-y-3">
          <ModalSection title={t("cvSections.extras")} icon={Info}>
            <FormField label={t("cvSections.placeholders.extraTitle")}>
              <Input
                placeholder={t("cvSections.placeholders.extraTitle")}
                value={f.name}
                onChange={e => setF({...f, name: e.target.value})}
              />
            </FormField>
            <FormField label={t("cvSections.placeholders.extraSummary")}>
              <Textarea
                placeholder={t("cvSections.placeholders.extraSummary")}
                value={f.summary}
                onChange={e => setF({...f, summary: e.target.value})}
                rows={3}
              />
            </FormField>
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
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title={t("cvSections.addExtra")}>
        <div className="space-y-3">
          <ModalSection title={t("cvSections.extras")} icon={Info}>
            <FormField label={t("cvSections.placeholders.extraTitle")}>
              <Input
                placeholder={t("cvSections.placeholders.extraTitle")}
                value={nf.name}
                onChange={e => setNf({...nf, name: e.target.value})}
              />
            </FormField>
            <FormField label={t("cvSections.placeholders.extraSummary")}>
              <Textarea
                placeholder={t("cvSections.placeholders.extraSummary")}
                value={nf.summary}
                onChange={e => setNf({...nf, summary: e.target.value})}
                rows={3}
              />
            </FormField>
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
            {t("cvSections.deleteExtra")}
            {extraNameToDelete && (
              <span className="font-semibold text-white"> "{extraNameToDelete}"</span>
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

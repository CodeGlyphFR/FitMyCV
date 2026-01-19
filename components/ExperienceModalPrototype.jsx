"use client";
/**
 * PROTOTYPE - Modal Experience Amélioré
 *
 * Ce fichier est un PROTOTYPE pour tester le nouveau design des modaux.
 * Il montre comment utiliser les composants ModalForm pour créer une expérience
 * utilisateur plus agréable et cohérente.
 *
 * Pour tester : importer ce composant à la place du modal actuel dans Experience.jsx
 */

import React from "react";
import Modal from "./ui/Modal";
import {
  ModalSection,
  FormField,
  Input,
  Textarea,
  Checkbox,
  Grid,
  Divider,
  ModalFooter,
  ModalFooterDelete,
  Briefcase,
  Calendar,
  MapPin,
  FileText,
} from "./ui/ModalForm";
import CountrySelect from "./CountrySelect";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// ============================================
// MODAL EDIT/ADD EXPERIENCE - PROTOTYPE
// ============================================
export function ExperienceEditModal({
  open,
  onClose,
  title,
  formData,
  setFormData,
  onSave,
  isAdd = false
}) {
  const { t } = useLanguage();

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || (isAdd ? t("cvSections.addExperience") : t("cvSections.editExperience"))}
      size="medium"
    >
      <div className="space-y-3">

        {/* ══════════════════════════════════════════
            SECTION: POSTE
        ══════════════════════════════════════════ */}
        <ModalSection title={t("cvSections.position") || "Poste"} icon={Briefcase} delay={0}>
          <Grid cols={2}>
            <FormField label={t("cvSections.placeholders.experienceTitleShort") || "Titre du poste"}>
              <Input
                placeholder="Ex: Chef de projet digital"
                value={formData.title || ""}
                onChange={e => updateField("title", e.target.value)}
              />
            </FormField>

            <FormField label={t("cvSections.placeholders.experienceCompanyShort") || "Entreprise"}>
              <Input
                placeholder="Ex: Acme Corporation"
                value={formData.company || ""}
                onChange={e => updateField("company", e.target.value)}
              />
            </FormField>
          </Grid>

          <FormField label={t("cvSections.placeholders.experienceDepartment") || "Département / Client"}>
            <Input
              placeholder="Ex: Direction Marketing Digital"
              value={formData.department_or_client || ""}
              onChange={e => updateField("department_or_client", e.target.value)}
            />
          </FormField>
        </ModalSection>

        {/* ══════════════════════════════════════════
            SECTION: PÉRIODE
        ══════════════════════════════════════════ */}
        <ModalSection title={t("cvSections.period") || "Période"} icon={Calendar} delay={0.05}>
          <div className="flex flex-wrap items-end gap-2">
            <FormField label={t("cvSections.placeholders.experienceStartShort") || "Début"} className="flex-1 min-w-[100px]">
              <Input
                placeholder="YYYY-MM"
                value={formData.start || ""}
                onChange={e => updateField("start", e.target.value)}
              />
            </FormField>

            <FormField label={t("cvSections.placeholders.experienceEndShort") || "Fin"} className="flex-1 min-w-[100px]">
              <Input
                placeholder="YYYY-MM"
                value={formData.end || ""}
                onChange={e => updateField("end", e.target.value)}
                disabled={formData.inProgress}
                className={formData.inProgress ? "opacity-50 cursor-not-allowed" : ""}
              />
            </FormField>

            <Checkbox
              label={t("cvSections.inProgress") || "Poste actuel"}
              checked={!!formData.inProgress}
              onChange={e => updateField("inProgress", e.target.checked)}
              className="pb-1"
            />
          </div>
        </ModalSection>

        {/* ══════════════════════════════════════════
            SECTION: LOCALISATION
        ══════════════════════════════════════════ */}
        <ModalSection title={t("cvSections.location") || "Localisation"} icon={MapPin} delay={0.1}>
          <Grid cols={3}>
            <FormField label={t("cvSections.placeholders.city") || "Ville"}>
              <Input
                placeholder="Ex: Paris"
                value={formData.city || ""}
                onChange={e => updateField("city", e.target.value)}
              />
            </FormField>

            <FormField label={t("cvSections.placeholders.region") || "Région"}>
              <Input
                placeholder="Ex: Île-de-France"
                value={formData.region || ""}
                onChange={e => updateField("region", e.target.value)}
              />
            </FormField>

            <FormField label={t("cvSections.placeholders.selectCountry") || "Pays"}>
              <CountrySelect
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-sm text-white transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 focus:shadow-[0_0_12px_rgba(52,211,153,0.15)] focus:outline-none appearance-none cursor-pointer [&>option]:bg-slate-900 [&>option]:text-white"
                placeholder={t("cvSections.placeholders.selectCountry")}
                value={formData.country_code || ""}
                onChange={v => updateField("country_code", v)}
              />
            </FormField>
          </Grid>
        </ModalSection>

        <Divider />

        {/* ══════════════════════════════════════════
            SECTION: CONTENU
        ══════════════════════════════════════════ */}
        <ModalSection title={t("cvSections.content") || "Contenu"} icon={FileText} delay={0.15}>
          <FormField label="Description">
            <Textarea
              placeholder="Décrivez brièvement votre rôle..."
              rows={2}
              value={formData.description || ""}
              onChange={e => updateField("description", e.target.value)}
            />
          </FormField>

          <Grid cols={2}>
            <FormField label={t("cvSections.responsibilities") || "Responsabilités (1/ligne)"}>
              <Textarea
                placeholder="Une par ligne..."
                rows={3}
                value={formData.responsibilities || ""}
                onChange={e => updateField("responsibilities", e.target.value)}
              />
            </FormField>

            <FormField label={t("cvSections.deliverables") || "Livrables (1/ligne)"}>
              <Textarea
                placeholder="Un par ligne..."
                rows={3}
                value={formData.deliverables || ""}
                onChange={e => updateField("deliverables", e.target.value)}
              />
            </FormField>
          </Grid>

          <FormField label={t("cvSections.skillsUsed") || "Compétences (virgules)"}>
            <Input
              placeholder="React, TypeScript, Agile..."
              value={formData.skills_used || ""}
              onChange={e => updateField("skills_used", e.target.value)}
            />
          </FormField>
        </ModalSection>

        {/* ══════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════ */}
        <ModalFooter
          onCancel={onClose}
          onSave={onSave}
          cancelLabel={t("common.cancel")}
          saveLabel={isAdd ? t("common.add") : t("common.save")}
        />
      </div>
    </Modal>
  );
}

// ============================================
// MODAL DELETE EXPERIENCE - PROTOTYPE
// ============================================
export function ExperienceDeleteModal({
  open,
  onClose,
  onConfirm,
  experienceTitle
}) {
  const { t } = useLanguage();

  return (
    <Modal open={open} onClose={onClose} title={t("common.confirmation")}>
      <div className="space-y-3">
        <p className="text-sm text-white/80">
          {t("cvSections.deleteExperience")}
          {experienceTitle && (
            <span className="font-medium text-white"> "{experienceTitle}"</span>
          )}
        </p>

        <ModalFooterDelete
          onCancel={onClose}
          onDelete={onConfirm}
          cancelLabel={t("common.cancel")}
          deleteLabel={t("common.delete")}
        />
      </div>
    </Modal>
  );
}

// ============================================
// EXEMPLE D'UTILISATION (pour référence)
// ============================================
/*
import { ExperienceEditModal, ExperienceDeleteModal } from "./ExperienceModalPrototype";

// Dans le composant Experience:

// État du formulaire
const [formData, setFormData] = useState({
  title: "",
  company: "",
  department_or_client: "",
  start: "",
  end: "",
  inProgress: false,
  city: "",
  region: "",
  country_code: "",
  description: "",
  responsibilities: "",
  deliverables: "",
  skills_used: ""
});

// Remplacer le Modal actuel par:
<ExperienceEditModal
  open={editIndex !== null}
  onClose={() => setEditIndex(null)}
  formData={formData}
  setFormData={setFormData}
  onSave={saveEdit}
/>

<ExperienceEditModal
  open={addOpen}
  onClose={() => setAddOpen(false)}
  formData={newFormData}
  setFormData={setNewFormData}
  onSave={saveAdd}
  isAdd={true}
/>

<ExperienceDeleteModal
  open={delIndex !== null}
  onClose={() => setDelIndex(null)}
  onConfirm={confirmDelete}
  experienceTitle={experience[delIndex]?.title}
/>
*/

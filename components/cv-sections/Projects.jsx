"use client";
import React from "react";
import Section from "@/components/layout/Section";
import { ym } from "@/lib/utils/textFormatting";
import { useAdmin } from "@/components/admin/AdminProvider";
import useMutate from "@/components/admin/useMutate";
import Modal from "@/components/ui/Modal";
import {
  ModalSection,
  FormField,
  Input,
  Textarea,
  Grid,
  Divider,
  ModalFooter,
  ModalFooterDelete,
  FolderKanban,
  Calendar,
  FileText,
  Link2,
  Code,
} from "@/components/ui/ModalForm";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getCvSectionTitleInCvLanguage, getTranslatorForCvLanguage } from "@/lib/i18n/cvLanguageHelper";
import SectionReviewActions from "@/components/cv-review/SectionReviewActions";
import ProjectReviewActions, { useProjectHasChanges } from "@/components/cv-review/ProjectReviewActions";
import ReviewableItemCard from "@/components/cv-review/ReviewableItemCard";
import { useItemChanges } from "@/components/cv-review/useItemChanges";
import MonthPicker from "@/components/ui/MonthPicker";
import ContextMenu from "@/components/ui/ContextMenu";
import { Pencil, Trash2 } from "lucide-react";

// Normalise une date vers le format YYYY-MM pour comparaison et sauvegarde
function normalizeDate(s){
  const m = (s || "").trim();
  if (!m) return "";
  if (m.toLowerCase() === "present") return "present";

  if (/^\d{4}(-\d{2})?$/.test(m)) {
    return m.length === 4 ? `${m}-01` : m;
  }

  if (m.includes("/")) {
    const parts = m.split("/");
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

  return m;
}

// Assure que l'URL est absolue (ajoute https:// si manquant)
function ensureAbsoluteUrl(u) {
  const url = (u || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * Composant carte projet individuelle avec highlight review
 */
function ProjectCard({ project, index, isEditing, onEdit, onDelete, cvT, t }) {
  const { hasChanges, isAdded } = useProjectHasChanges(project.name);
  const originalIndex = project._originalIndex ?? index;

  const cardClasses = [
    "flex flex-col h-full rounded-xl p-3 relative z-0 overflow-visible",
    isAdded
      ? "border-2 border-emerald-500/50 bg-emerald-500/10"
      : "border border-white/15",
  ].join(" ");

  return (
    <div className={cardClasses}>
      <div className="flex items-start gap-2">
        <div className="font-semibold flex-1 min-w-0 break-words">
          {project.name || ""}
          {project.url && (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 ml-2 font-normal"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {project.url_label || project.url}
            </a>
          )}
        </div>
        <div className="text-sm opacity-80 whitespace-nowrap ml-auto mt-1">
          {(project.start_date || project.end_date)
            ? [ym(project.start_date) || "", project.end_date === "present" ? cvT("cvSections.present") : (ym(project.end_date) || "")].filter(Boolean).join(" → ")
            : ""}
        </div>
        {hasChanges && !isEditing && (
          <ProjectReviewActions projectIndex={originalIndex} projectName={project.name} />
        )}
        {isEditing && (
          <ContextMenu
            items={[
              { icon: Pencil, label: t("common.edit"), onClick: () => onEdit(index) },
              { icon: Trash2, label: t("common.delete"), onClick: () => onDelete(originalIndex), danger: true }
            ]}
          />
        )}
      </div>

      <div className="text-sm opacity-80">{project.role || ""}</div>
      {project.summary ? <div className="text-sm text-justify mt-1">{project.summary}</div> : null}

      <div className="flex flex-wrap gap-1 mt-auto pt-3">
        {Array.isArray(project.tech_stack) && project.tech_stack.map((m, idx) => (
          <span key={idx} className="inline-block rounded-sm border border-white/15 px-1.5 py-0.5 text-[11px] opacity-90">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Projects(props){
  const { t } = useLanguage();
  const rawProjects = Array.isArray(props.projects) ? props.projects : [];

  // Récupérer les projets supprimés pour les afficher
  const { removedItems: removedProjects } = useItemChanges("projects");

  // Tri par date décroissante
  const projects = React.useMemo(() => {
    return rawProjects
      .map((p, idx) => ({ ...p, _originalIndex: idx }))
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
  }, [rawProjects]);

  const sectionTitles = props.sectionTitles || {};
  const cvLanguage = props.cvLanguage || 'fr';
  const cvT = getTranslatorForCvLanguage(cvLanguage);
  const title = getCvSectionTitleInCvLanguage('projects', sectionTitles.projects, cvLanguage);
  const { editing } = useAdmin();
  const isEditing = !!editing;
  const { mutate } = useMutate();

  // ---- UI State ----
  const [editIndex, setEditIndex] = React.useState(null);
  const [delIndex, setDelIndex] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);

  // ---- Forms ----
  const emptyForm = { name:"", role:"", start:"", end:"", summary:"", tech_stack:"", url:"", url_label:"" };
  const [f, setF] = React.useState(emptyForm);
  const [nf, setNf] = React.useState(emptyForm);

  const isEmpty = projects.length === 0;
  const hasRemovedProjects = removedProjects.length > 0;
  const shouldRender = isEditing || !isEmpty || hasRemovedProjects;
  if (!shouldRender) return null;

  // ---- Actions ----
  function openEdit(i){
    const p = projects[i] || {};
    setF({
      name: p.name || "",
      role: p.role || "",
      start: p.start_date || "",
      end: p.end_date || "",
      summary: p.summary || "",
      tech_stack: Array.isArray(p.tech_stack) ? p.tech_stack.join(", ") : (p.tech_stack || ""),
      url: p.url || "",
      url_label: p.url_label || ""
    });
    setEditIndex(p._originalIndex);
  }

  async function saveEdit(){
    const p = {};
    if (f.name) p.name = f.name;
    if (f.role) p.role = f.role;
    if (f.start) p.start_date = normalizeDate(f.start);
    // Si vide ou "present", c'est un projet en cours
    if (!f.end || f.end.toLowerCase() === "present") p.end_date = "present";
    else p.end_date = normalizeDate(f.end);
    if (f.summary) p.summary = f.summary;
    const tech_stack = (f.tech_stack || "").split(",").map(t => t.trim()).filter(Boolean);
    if (tech_stack.length) p.tech_stack = tech_stack;
    if (f.url) p.url = ensureAbsoluteUrl(f.url);
    if (f.url_label) p.url_label = f.url_label;

    await mutate({ op:"set", path:`projects[${editIndex}]`, value:p });
    setEditIndex(null);
  }

  async function saveAdd(){
    const p = {};
    if (nf.name) p.name = nf.name;
    if (nf.role) p.role = nf.role;
    if (nf.start) p.start_date = normalizeDate(nf.start);
    // Si vide ou "present", c'est un projet en cours
    if (!nf.end || nf.end.toLowerCase() === "present") p.end_date = "present";
    else p.end_date = normalizeDate(nf.end);
    if (nf.summary) p.summary = nf.summary;
    const tech_stack = (nf.tech_stack || "").split(",").map(t => t.trim()).filter(Boolean);
    if (tech_stack.length) p.tech_stack = tech_stack;
    if (nf.url) p.url = ensureAbsoluteUrl(nf.url);
    if (nf.url_label) p.url_label = nf.url_label;

    await mutate({ op:"push", path:"projects", value:p });
    setNf(emptyForm);
    setAddOpen(false);
  }

  async function confirmDelete(){
    await mutate({ op:"remove", path:"projects", index: delIndex });
    setDelIndex(null);
  }

  return (
    <Section
      title={
        <div className="flex items-center justify-between gap-2">
          <span>{title}</span>
          <div className="flex items-center gap-3">
            <SectionReviewActions section="projects" />
            {isEditing && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="no-print text-xs rounded-lg border-2 border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-white hover:bg-white/30 transition-colors duration-200"
              >
                {t("common.add")}
              </button>
            )}
          </div>
        </div>
      }
    >
      {isEmpty && !hasRemovedProjects ? (
        isEditing ? (
          <div className="rounded-2xl border border-white/15 p-3 text-sm opacity-60">
            {t("cvSections.noProjects")}
          </div>
        ) : null
      ) : (
        <div className="space-y-3">
          {/* Projets existants */}
          {projects.length > 0 && (
            <div className={projects.length > 1 ? "grid md:grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
              {projects.map((p, i) => (
                <ProjectCard
                  key={i}
                  project={p}
                  index={i}
                  isEditing={isEditing}
                  onEdit={openEdit}
                  onDelete={setDelIndex}
                  cvT={cvT}
                  t={t}
                />
              ))}
            </div>
          )}

          {/* Projets supprimés par l'IA (cartes rouges) */}
          {removedProjects.length > 0 && (
            <div className={removedProjects.length > 1 ? "grid md:grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
              {removedProjects.map((change) => (
                <ReviewableItemCard
                  key={change.id}
                  change={change}
                  showInlineActions={true}
                  className="no-print"
                >
                  <div className="font-semibold">{change.itemName || change.change || t("cvSections.projects")}</div>
                  {change.reason && (
                    <div className="text-sm opacity-80 mt-1">{change.reason}</div>
                  )}
                </ReviewableItemCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={editIndex !== null} onClose={() => setEditIndex(null)} title={t("cvSections.editProjects")} size="medium">
        <div className="space-y-3">
          <ModalSection title={t("cvSections.projects")} icon={FolderKanban}>
            <Grid cols={2}>
              <FormField label={t("cvSections.placeholders.projectName")}>
                <Input
                  placeholder={t("cvSections.placeholders.projectName")}
                  value={f.name || ""}
                  onChange={e => setF({ ...f, name: e.target.value })}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.role")}>
                <Input
                  placeholder={t("cvSections.placeholders.role")}
                  value={f.role || ""}
                  onChange={e => setF({ ...f, role: e.target.value })}
                />
              </FormField>
            </Grid>
          </ModalSection>

          <ModalSection title={t("cvSections.period")} icon={Calendar}>
            <div className="flex flex-wrap items-end gap-2">
              <FormField label={t("cvSections.placeholders.experienceStartShort")} className="flex-1 min-w-[140px]">
                <MonthPicker
                  placeholder={t("cvSections.placeholders.dateFormat")}
                  value={f.start || ""}
                  onChange={v => setF({ ...f, start: v })}
                  todayLabel={t("common.today")}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.experienceEndShort")} className="flex-1 min-w-[140px]">
                <MonthPicker
                  placeholder={t("cvSections.placeholders.dateFormat")}
                  value={f.end || ""}
                  onChange={v => setF({ ...f, end: v })}
                  todayLabel={t("common.ongoing")}
                  presentLabel={t("common.ongoing")}
                  presentMode
                />
              </FormField>
            </div>
          </ModalSection>

          <Divider />

          <ModalSection title={t("cvSections.placeholders.description")} icon={FileText}>
            <FormField label={t("cvSections.placeholders.description")}>
              <Textarea
                placeholder={t("cvSections.placeholders.descriptionHint")}
                rows={2}
                value={f.summary || ""}
                onChange={e => setF({ ...f, summary: e.target.value })}
              />
            </FormField>
            <FormField label={t("cvSections.technologies")}>
              <Input
                placeholder={t("cvSections.placeholders.skillsUsedHint")}
                value={f.tech_stack || ""}
                onChange={e => setF({ ...f, tech_stack: e.target.value })}
              />
            </FormField>
          </ModalSection>

          <ModalSection title={t("cvSections.placeholders.projectUrl")} icon={Link2}>
            <Grid cols={2}>
              <FormField label={t("cvSections.placeholders.projectUrlLabel")}>
                <Input
                  placeholder={t("cvSections.placeholders.projectUrlLabel")}
                  value={f.url_label || ""}
                  onChange={e => setF({ ...f, url_label: e.target.value })}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.projectUrl")}>
                <Input
                  placeholder={t("cvSections.placeholders.projectUrlExample")}
                  value={f.url || ""}
                  onChange={e => setF({ ...f, url: e.target.value })}
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
      <Modal open={!!addOpen} onClose={() => setAddOpen(false)} title={t("cvSections.addProject")} size="medium">
        <div className="space-y-3">
          <ModalSection title={t("cvSections.projects")} icon={FolderKanban}>
            <Grid cols={2}>
              <FormField label={t("cvSections.placeholders.projectName")}>
                <Input
                  placeholder={t("cvSections.placeholders.projectName")}
                  value={nf.name || ""}
                  onChange={e => setNf({ ...nf, name: e.target.value })}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.role")}>
                <Input
                  placeholder={t("cvSections.placeholders.role")}
                  value={nf.role || ""}
                  onChange={e => setNf({ ...nf, role: e.target.value })}
                />
              </FormField>
            </Grid>
          </ModalSection>

          <ModalSection title={t("cvSections.period")} icon={Calendar}>
            <div className="flex flex-wrap items-end gap-2">
              <FormField label={t("cvSections.placeholders.experienceStartShort")} className="flex-1 min-w-[140px]">
                <MonthPicker
                  placeholder={t("cvSections.placeholders.dateFormat")}
                  value={nf.start || ""}
                  onChange={v => setNf({ ...nf, start: v })}
                  todayLabel={t("common.today")}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.experienceEndShort")} className="flex-1 min-w-[140px]">
                <MonthPicker
                  placeholder={t("cvSections.placeholders.dateFormat")}
                  value={nf.end || ""}
                  onChange={v => setNf({ ...nf, end: v })}
                  todayLabel={t("common.ongoing")}
                  presentLabel={t("common.ongoing")}
                  presentMode
                />
              </FormField>
            </div>
          </ModalSection>

          <Divider />

          <ModalSection title={t("cvSections.placeholders.description")} icon={FileText}>
            <FormField label={t("cvSections.placeholders.description")}>
              <Textarea
                placeholder={t("cvSections.placeholders.descriptionHint")}
                rows={2}
                value={nf.summary || ""}
                onChange={e => setNf({ ...nf, summary: e.target.value })}
              />
            </FormField>
            <FormField label={t("cvSections.technologies")}>
              <Input
                placeholder={t("cvSections.placeholders.skillsUsedHint")}
                value={nf.tech_stack || ""}
                onChange={e => setNf({ ...nf, tech_stack: e.target.value })}
              />
            </FormField>
          </ModalSection>

          <ModalSection title={t("cvSections.placeholders.projectUrl")} icon={Link2}>
            <Grid cols={2}>
              <FormField label={t("cvSections.placeholders.projectUrlLabel")}>
                <Input
                  placeholder={t("cvSections.placeholders.projectUrlLabel")}
                  value={nf.url_label || ""}
                  onChange={e => setNf({ ...nf, url_label: e.target.value })}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.projectUrl")}>
                <Input
                  placeholder={t("cvSections.placeholders.projectUrlExample")}
                  value={nf.url || ""}
                  onChange={e => setNf({ ...nf, url: e.target.value })}
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
            {t("cvSections.deleteProject")}
            {delIndex !== null && rawProjects[delIndex]?.name && (
              <span className="font-medium text-white"> "{rawProjects[delIndex].name}"</span>
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

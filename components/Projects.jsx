"use client";
import React from "react";
import Section from "./Section";
import { ym } from "@/lib/utils";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getSectionTitle } from "@/lib/i18n/cvLabels";

function norm(s){
  const m = (s || "").trim();
  if (!m) return "";
  if (m.toLowerCase() === "present") return "present";
  return /^\d{4}(-\d{2})?$/.test(m) ? (m.length === 4 ? m + "-01" : m) : m;
}

export default function Projects(props){
  const { t } = useLanguage();
  const projects = Array.isArray(props.projects) ? props.projects : [];
  const sectionTitles = props.sectionTitles || {};
  const title = getSectionTitle('projects', sectionTitles.projects, t);
  const { editing } = useAdmin();
  const isEditing = !!editing; // force bool
  const { mutate } = useMutate();

  const [editIndex, setEditIndex] = React.useState(null);
  const [delIndex, setDelIndex]   = React.useState(null);
  const [addOpen, setAddOpen]     = React.useState(false);

  const [f,  setF]  = React.useState({ name:"", role:"", start:"", end:"", inProgress: false, summary:"", tech_stack:"" });
  const [nf, setNf] = React.useState({ name:"", role:"", start:"", end:"", inProgress: false, summary:"", tech_stack:"" });

  const isEmpty = projects.length === 0;
  const shouldRender = isEditing || !isEmpty; // rend la section si on édite OU si non vide
  if (!shouldRender) return null;

  function openEdit(i){
    const p = projects[i] || {};
    const isCurrentProject = p.end_date === "present";
    setF({
      name: p.name || "",
      role: p.role || "",
      start: p.start_date || "",
      end: isCurrentProject ? "" : (p.end_date || ""),
      inProgress: isCurrentProject,
      summary: p.summary || "",
      tech_stack: Array.isArray(p.tech_stack) ? p.tech_stack.join(", ") : (p.tech_stack || "")
    });
    setEditIndex(i);
  }

  async function save(){
    const p = {};
    if (f.name) p.name = f.name;
    if (f.role) p.role = f.role;
    if (f.start) p.start_date = norm(f.start);
    if (f.inProgress) {
      p.end_date = "present";
    } else if (f.end) {
      p.end_date = norm(f.end);
    }
    if (f.summary) p.summary = f.summary;
    const tech_stack = (f.tech_stack || "").split(",").map(t => t.trim()).filter(Boolean);
    if (tech_stack.length) p.tech_stack = tech_stack;

    await mutate({ op:"set", path:`projects[${editIndex}]`, value:p });
    setEditIndex(null);
  }

  async function add(){
    const p = {};
    if (nf.name) p.name = nf.name;
    if (nf.role) p.role = nf.role;
    if (nf.start) p.start_date = norm(nf.start);
    if (nf.inProgress) {
      p.end_date = "present";
    } else if (nf.end) {
      p.end_date = norm(nf.end);
    }
    if (nf.summary) p.summary = nf.summary;
    const tech_stack = (nf.tech_stack || "").split(",").map(t => t.trim()).filter(Boolean);
    if (tech_stack.length) p.tech_stack = tech_stack;

    await mutate({ op:"push", path:"projects", value:p });
    setNf({ name:"", role:"", start:"", end:"", inProgress: false, summary:"", tech_stack:"" });
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
          {isEditing && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="no-print text-xs rounded border px-2 py-1"
            >
              {t("common.add")}
            </button>
          )}
        </div>
      }
    >
      {isEmpty ? (
        // visible en édition quand vide
        isEditing ? (
          <div className="rounded-2xl border p-3 text-sm opacity-60">
            {t("cvSections.noProjects")}
          </div>
        ) : null
      ) : (
        <div className={projects.length > 1 ? "grid md:grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
          {projects.map((p, i) => (
            <div key={i} className="flex flex-col h-full rounded-xl border p-3 relative z-0 overflow-visible">
              <div className={"flex items-start gap-2" + (isEditing ? " pr-20" : "")}>
                <div className="font-semibold flex-1 min-w-0 break-words">{p.name || ""}</div>
                <div className="text-sm opacity-80 whitespace-nowrap ml-auto mt-1">
                  {(p.start_date || p.end_date)
                    ? [ym(p.start_date) || "", p.end_date === "present" ? t("cvSections.present") : (ym(p.end_date) || "")].filter(Boolean).join(" → ")
                    : ""}
                </div>
              </div>

              {isEditing && (
                <div className="no-print absolute top-2 right-2 z-20 flex gap-2 bg-white rounded shadow px-2 py-1">
                  <button type="button" onClick={() => openEdit(i)} className="text-[11px] px-2 py-0.5">🖊️</button>
                  <button type="button" onClick={() => setDelIndex(i)} className="text-[11px]">❌</button>
                </div>
              )}

              <div className="text-sm opacity-80">{p.role || ""}</div>
              {p.summary ? <div className="text-sm text-justify mt-1">{p.summary}</div> : null}

              <div className="flex flex-wrap gap-1 mt-auto pt-3">
                {Array.isArray(p.tech_stack) && p.tech_stack.map((m, idx) => (
                  <span key={idx} className="inline-block rounded border px-1.5 py-0.5 text-[11px] opacity-90">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={editIndex !== null} onClose={() => setEditIndex(null)} title={t("cvSections.editProjects")}>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.projectName")} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.role")} value={f.role} onChange={e => setF({ ...f, role: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.startDate")} value={f.start} onChange={e => setF({ ...f, start: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.endDate")} value={f.end} onChange={e => setF({ ...f, end: e.target.value })} disabled={f.inProgress} />
          <div className="md:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="edit-inProgress" checked={f.inProgress} onChange={e => setF({ ...f, inProgress: e.target.checked, end: e.target.checked ? "" : f.end })} />
            <label htmlFor="edit-inProgress" className="text-sm">{t("cvSections.projectInProgress")}</label>
          </div>
          <textarea className="rounded border px-2 py-1 text-sm md:col-span-2" placeholder={t("cvSections.placeholders.description")} value={f.summary} onChange={e => setF({ ...f, summary: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm md:col-span-2" placeholder={t("cvSections.technologies")} value={f.tech_stack || ""} onChange={e => setF({ ...f, tech_stack: e.target.value })} />
          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setEditIndex(null)} className="rounded border px-3 py-1 text-sm">{t("common.cancel")}</button>
            <button type="button" onClick={save} className="rounded border px-3 py-1 text-sm">{t("common.save")}</button>
          </div>
        </div>
      </Modal>

      {/* Add Modal */}
      <Modal open={!!addOpen} onClose={() => setAddOpen(false)} title={t("cvSections.addProject")}>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.projectName")} value={nf.name} onChange={e => setNf({ ...nf, name: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.role")} value={nf.role} onChange={e => setNf({ ...nf, role: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.startDate")} value={nf.start} onChange={e => setNf({ ...nf, start: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.endDate")} value={nf.end} onChange={e => setNf({ ...nf, end: e.target.value })} disabled={nf.inProgress} />
          <div className="md:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="add-inProgress" checked={nf.inProgress} onChange={e => setNf({ ...nf, inProgress: e.target.checked, end: e.target.checked ? "" : nf.end })} />
            <label htmlFor="add-inProgress" className="text-sm">{t("cvSections.projectInProgress")}</label>
          </div>
          <textarea className="rounded border px-2 py-1 text-sm md:col-span-2" placeholder={t("cvSections.placeholders.description")} value={nf.summary} onChange={e => setNf({ ...nf, summary: e.target.value })} />

          {/* ✅ Champ tech_stack ajouté */}
          <input
            className="rounded border px-2 py-1 text-sm md:col-span-2"
            placeholder={t("cvSections.technologies")}
            value={nf.tech_stack || ""}
            onChange={e => setNf({ ...nf, tech_stack: e.target.value })}
          />

          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="rounded border px-3 py-1 text-sm">{t("common.cancel")}</button>
            <button type="button" onClick={add} className="rounded border px-3 py-1 text-sm">{t("common.add")}</button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={delIndex !== null} onClose={() => setDelIndex(null)} title={t("common.confirmation")}>
        <div className="space-y-3">
          <p className="text-sm">{t("cvSections.deleteProject")}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDelIndex(null)} className="rounded border px-3 py-1 text-sm">{t("common.cancel")}</button>
            <button type="button" onClick={confirmDelete} className="rounded border px-3 py-1 text-sm text-red-700">{t("common.delete")}</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

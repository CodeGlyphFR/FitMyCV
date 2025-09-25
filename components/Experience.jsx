"use client";
import React from "react";
import Section from "./Section";
import { ym } from "@/lib/utils";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";


export default function Experience(props){
  const experience = Array.isArray(props.experience) ? props.experience : [];
  const sectionTitles = props.sectionTitles || {};
  const title = sectionTitles.experience || "Expérience";
  const { editing } = useAdmin();
  const { mutate } = useMutate();

  // ---- UI State ----
  const [editIndex, setEditIndex] = React.useState(null);
  const [delIndex, setDelIndex] = React.useState(null);
  const [addOpen, setAddOpen]   = React.useState(false);

  // ---- Forms ----
  const emptyForm = { title:"", company:"", department_or_client:"", start:"", end:"", inProgress:false, city:"", region:"", country_code:"", description:"", responsibilities:"", deliverables:"", skills_used:"" };
  const [nf, setNf] = React.useState(emptyForm);
  const [f,  setF]  = React.useState({});

  // ---- Helpers ----
  const norm = React.useCallback((s) => {
    const v = (s || "").trim();
    if (!v) return "";
    if (v.toLowerCase() === "present") return "present";
    if (/^\d{4}(-\d{2})?$/.test(v)) return v.length === 4 ? `${v}-01` : v;
    return v;
  }, []);

  const isEmpty = experience.length === 0;
  if (!editing && isEmpty) return null; // Masquer entièrement hors édition s'il n'y a aucune expérience

  // ---- Actions ----
  const openEdit = (i) => {
    const e = experience[i] || {};
    setF({
      title: e.title || "",
      company: e.company || "",
      department_or_client: e.department_or_client || "",
      start: e.start_date || "",
      end: e.end_date === "present" ? "present" : (e.end_date || ""),
      inProgress: e.end_date === "present",
      city: e.location?.city || "",
      region: e.location?.region || "",
      country_code: e.location?.country_code || "",
      description: e.description || "",
      responsibilities: Array.isArray(e.responsibilities) ? e.responsibilities.join("\n") : "",
      deliverables: Array.isArray(e.deliverables) ? e.deliverables.join("\n") : "",
      skills_used: Array.isArray(e.skills_used) ? e.skills_used.join(", ") : ""
    });
    setEditIndex(i);
  };

  const saveEdit = async () => {
    const p = { title: f.title?.trim() || "Nouvelle expérience" };
    if (f.company) p.company = f.company;
    if (f.department_or_client) p.department_or_client = f.department_or_client;
    if (f.start) p.start_date = norm(f.start);
    if (f.inProgress) p.end_date = "present"; else if (f.end) p.end_date = norm(f.end);

    const loc = {};
    if (f.city) loc.city = f.city;
    if (f.region) loc.region = f.region;
    if (f.country_code) loc.country_code = f.country_code;
    if (Object.keys(loc).length) p.location = loc;

    if (f.description) p.description = f.description;

    const resp = (f.responsibilities || "").split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    if (resp.length) p.responsibilities = resp;

    const del = (f.deliverables || "").split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    if (del.length) p.deliverables = del;

    const skills = (f.skills_used || "").split(",").map(s => s.trim()).filter(Boolean);
    if (skills.length) p.skills_used = skills;

    await mutate({ op:"set", path:`experience[${editIndex}]`, value:p });
    setEditIndex(null);
  };

  const saveAdd = async () => {
    const p = { title: (nf.title || "Nouvelle expérience").trim() || "Nouvelle expérience" };
    if (nf.company) p.company = nf.company;
    if (nf.department_or_client) p.department_or_client = nf.department_or_client;
    if (nf.start) p.start_date = norm(nf.start);
    if (nf.inProgress) p.end_date = "present"; else if (nf.end) p.end_date = norm(nf.end);

    const loc = {};
    if (nf.city) loc.city = nf.city;
    if (nf.region) loc.region = nf.region;
    if (nf.country_code) loc.country_code = nf.country_code;
    if (Object.keys(loc).length) p.location = loc;

    if (nf.description) p.description = nf.description;

    const resp = (nf.responsibilities || "").split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    if (resp.length) p.responsibilities = resp;

    const del = (nf.deliverables || "").split(/\r?\n|,/).map(s => s.trim()).filter(Boolean);
    if (del.length) p.deliverables = del;

    const skills = (nf.skills_used || "").split(",").map(s => s.trim()).filter(Boolean);
    if (skills.length) p.skills_used = skills;

    await mutate({ op:"push", path:"experience", value:p });
    setAddOpen(false);
    setNf(emptyForm);
  };

  const confirmDelete = async () => {
    await mutate({ op:"remove", path:`experience[${delIndex}]` });
    setDelIndex(null);
  };

  return (
    <Section
      title={
        <div className="flex items-center justify-between gap-2">
          <span>{title}</span>
          {editing && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="no-print text-xs rounded border px-2 py-1"
            >
              + Ajouter
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        {experience.length > 0 ? (
          experience.map((e, i) => (
            <div key={i} className="rounded-2xl border p-3 relative">
              {editing && (
                <div className="no-print absolute top-2 right-2 z-20 flex gap-2 bg-white/90 backdrop-blur-sm rounded shadow px-2 py-1">
                  <button type="button" onClick={() => openEdit(i)} className="text-[11px] px-2 py-0.5">🖊️</button>
                  <button type="button" onClick={() => setDelIndex(i)} className="text-xs rounded border px-2 py-1 hover:shadow text-red-700">❌</button>
                </div>
              )}

              <div className={"flex flex-wrap items-baseline gap-2" + (editing ? " pr-20" : "")}>
                <div className="font-semibold flex-1 min-w-0">
                  {e.title || ""}{e.company ? " • " : ""}{e.company || ""}{e.department_or_client ? ` (${e.department_or_client})` : ""}
                </div>
                <div className="ml-3 text-sm opacity-80 whitespace-nowrap">
                  {ym(e.start_date)} — {ym(e.end_date)}
                </div>
              </div>

              {e.location && (
                <div className="text-xs opacity-70 mt-0.5">
                  {e.location.city || ""}{e.location.region ? ", " : ""}{e.location.region || ""}{e.location.country_code ? ` (${e.location.country_code})` : ""}
              </div>
              )}

              <div className="mt-3 space-y-3">
                {e.description ? (
                  <p className="text-sm text-justify opacity-95 whitespace-pre-line">{e.description}</p>
                ) : null}

                {(Array.isArray(e.responsibilities) && e.responsibilities.length > 0) || (Array.isArray(e.deliverables) && e.deliverables.length > 0) ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {Array.isArray(e.responsibilities) && e.responsibilities.length > 0 ? (
                      <div className="md:col-span-2">
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {e.responsibilities.map((r, j) => <li key={j}>{r}</li>)}
                        </ul>
                      </div>
                    ) : <div className="md:col-span-2" />}

                    {Array.isArray(e.deliverables) && e.deliverables.length > 0 ? (
                      <div className="md:col-span-1">
                        <div className="text-sm font-medium mb-1">Livrables</div>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {e.deliverables.map((d, j) => <li key={j}>{d}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1 mt-2">
                {Array.isArray(e.skills_used) && e.skills_used.map((m, k) => (
                  <span key={k} className="inline-block rounded border px-1.5 py-0.5 text-[11px] opacity-90">{m}</span>
                ))}
              </div>
            </div>
          ))
        ) : (
          editing && (
            <div className="rounded-2xl border p-3 text-sm opacity-60">
              Aucune expérience pour le moment.
            </div>
          )
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={editIndex !== null} onClose={() => setEditIndex(null)} title="Modifier l'expérience">
        <div className="grid gap-2 md:grid-cols-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder="Intitulé" value={f.title || ""} onChange={e => setF({ ...f, title: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Entreprise" value={f.company || ""} onChange={e => setF({ ...f, company: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Département/Client" value={f.department_or_client || ""} onChange={e => setF({ ...f, department_or_client: e.target.value })} />

          <div className="grid grid-cols-2 gap-2">
            <input className="rounded border px-2 py-1 text-sm" placeholder="Début (YYYY ou YYYY-MM)" value={f.start || ""} onChange={e => setF({ ...f, start: e.target.value })} />
            <input className="rounded border px-2 py-1 text-sm" placeholder="Fin (YYYY, YYYY-MM)" value={f.end || ""} onChange={e => setF({ ...f, end: e.target.value })} disabled={f.inProgress} />
            <label className="text-xs col-span-2 inline-flex items-center gap-2">
              <input type="checkbox" checked={!!f.inProgress} onChange={e => setF({ ...f, inProgress: e.target.checked })} /> Poste en cours (fin = present)
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input className="rounded border px-2 py-1 text-sm" placeholder="Ville" value={f.city || ""} onChange={e => setF({ ...f, city: e.target.value })} />
            <input className="rounded border px-2 py-1 text-sm" placeholder="Région" value={f.region || ""} onChange={e => setF({ ...f, region: e.target.value })} />
            <input className="rounded border px-2 py-1 text-sm" placeholder="Pays (code)" value={f.country_code || ""} onChange={e => setF({ ...f, country_code: e.target.value })} />
          </div>

          <textarea className="rounded border px-2 py-1 text-sm md:col-span-2" placeholder="Description" rows={3} value={f.description || ""} onChange={e => setF({ ...f, description: e.target.value })} />
          <textarea className="rounded border px-2 py-1 text-sm md:col-span-2" placeholder="Responsabilités (une par ligne)" rows={3} value={f.responsibilities || ""} onChange={e => setF({ ...f, responsibilities: e.target.value })} />
          <textarea className="rounded border px-2 py-1 text-sm md:col-span-2" placeholder="Livrables (un par ligne)" rows={3} value={f.deliverables || ""} onChange={e => setF({ ...f, deliverables: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm md:col-span-2" placeholder="Compétences utilisées (séparées par des virgules)" value={f.skills_used || ""} onChange={e => setF({ ...f, skills_used: e.target.value })} />

          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={saveEdit} className="rounded border px-3 py-1 text-sm">Enregistrer</button>
          </div>
        </div>
      </Modal>

      {/* Add Modal */}
      <Modal open={!!addOpen} onClose={() => setAddOpen(false)} title="Ajouter une expérience">
        <div className="grid gap-2 md:grid-cols-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder="Intitulé" value={nf.title || ""} onChange={e => setNf({ ...nf, title: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Entreprise" value={nf.company || ""} onChange={e => setNf({ ...nf, company: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Département/Client" value={nf.department_or_client || ""} onChange={e => setNf({ ...nf, department_or_client: e.target.value })} />

          <div className="grid grid-cols-2 gap-2">
            <input className="rounded border px-2 py-1 text-sm" placeholder="Début (YYYY ou YYYY-MM)" value={nf.start || ""} onChange={e => setNf({ ...nf, start: e.target.value })} />
            <input className="rounded border px-2 py-1 text-sm" placeholder="Fin (YYYY, YYYY-MM ou present)" value={nf.end || ""} onChange={e => setNf({ ...nf, end: e.target.value })} disabled={nf.inProgress} />
          </div>
          <label className="text-xs flex items-center gap-2">
            <input type="checkbox" checked={!!nf.inProgress} onChange={e => setNf({ ...nf, inProgress: e.target.checked })} /> Poste en cours (fin = present)
          </label>

          <div className="grid grid-cols-3 gap-2">
            <input className="rounded border px-2 py-1 text-sm" placeholder="Ville" value={nf.city || ""} onChange={e => setNf({ ...nf, city: e.target.value })} />
            <input className="rounded border px-2 py-1 text-sm" placeholder="Région" value={nf.region || ""} onChange={e => setNf({ ...nf, region: e.target.value })} />
            <input className="rounded border px-2 py-1 text-sm" placeholder="Pays (code)" value={nf.country_code || ""} onChange={e => setNf({ ...nf, country_code: e.target.value })} />
          </div>

          <textarea className="rounded border px-2 py-1 text-sm md:col-span-2" placeholder="Description" rows={3} value={nf.description || ""} onChange={e => setNf({ ...nf, description: e.target.value })} />
          <textarea className="rounded border px-2 py-1 text-sm" placeholder="Responsabilités (une par ligne)" rows={3} value={nf.responsibilities || ""} onChange={e => setNf({ ...nf, responsibilities: e.target.value })} />
          <textarea className="rounded border px-2 py-1 text-sm" placeholder="Livrables (un par ligne)" rows={3} value={nf.deliverables || ""} onChange={e => setNf({ ...nf, deliverables: e.target.value })} />
          <input className="rounded border px-2 py-1 text-sm md:col-span-2" placeholder="Compétences utilisées (séparées par des virgules)" value={nf.skills_used || ""} onChange={e => setNf({ ...nf, skills_used: e.target.value })} />

          <div className="md:col-span-2 flex justify-end gap-2">
            <button type="button" onClick={saveAdd} className="rounded border px-3 py-1 text-sm">Ajouter</button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={delIndex !== null} onClose={() => setDelIndex(null)} title="Confirmation">
        <div className="space-y-3">
          <p className="text-sm">Voulez-vous vraiment supprimer cet élément ?</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDelIndex(null)} className="rounded border px-3 py-1 text-sm">Non</button>
            <button type="button" onClick={confirmDelete} className="rounded border px-3 py-1 text-sm text-red-700">Oui</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

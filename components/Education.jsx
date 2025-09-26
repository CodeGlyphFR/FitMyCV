"use client";
import React from "react";
import Section from "./Section";
import { ym } from "@/lib/utils";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";

export default function Education(props){
  const education = Array.isArray(props.education)? props.education:[];
  const sectionTitles = props.sectionTitles || {};
  const title = sectionTitles.education || "Éducation";
  const { editing } = useAdmin();
  const { mutate } = useMutate();
  const [editIndex, setEditIndex] = React.useState(null);
  const [delIndex, setDelIndex] = React.useState(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [f, setF] = React.useState({});
  const [nf, setNf] = React.useState({ institution:"", degree:"", field_of_study:"", start_date:"" , end_date:""});

  function openEdit(i){
    const e = education[i] || {};
    setF({
      institution: e.institution || "",
      degree: e.degree || "",
      field_of_study: e.field_of_study || "",
      start_date: e.start_date || "",
      end_date: e.end_date || ""
    });
    setEditIndex(i);
  }
  async function edit(){
    const p = {};
    if(f.institution) p.institution = f.institution;
    if(f.degree) p.degree = f.degree;
    if(f.field_of_study) p.field_of_study = f.field_of_study;
    if(f.start_date) p.start_date = f.start_date;
    if(f.end_date) p.end_date = f.end_date;
    await mutate({ op:"set", path:`education[${editIndex}]`, value:p });
    setEditIndex(null);
  }
  async function add(){
    const p = {};
    if(nf.institution) p.institution = nf.institution;
    if(nf.degree) p.degree = nf.degree;
    if(nf.field_of_study) p.field_of_study = nf.field_of_study;
    if(nf.start_date) p.start_date = nf.start_date;
    if(nf.end_date) p.end_date = nf.end_date;
    await mutate({ op:"push", path:"education", value:p });
    setNf({ institution:"", degree:"", field_of_study:"", start_date:"", end_date:"" });
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
                className="no-print text-xs rounded border px-2 py-1"
              >
                + Ajouter
              </button>
            )}
          </div>
        }
      >
        {(!education || education.length === 0) ? (
          <div className="rounded-xl border p-3 text-sm opacity-60">
            Aucune formation ou certification pour le moment.
          </div>
        ) : (
          <div className={education.length > 1 ? "grid md:grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
            {education.map((e, i) => (
              <div key={i} className="rounded-xl border p-3 relative z-0 overflow-visible">
                <div className={"flex items-start gap-2" + (editing ? " pr-20" : "")}>
                  <div className="font-semibold flex-1 min-w-0 break-words">
                    {e.institution || ""}
                  </div>
                  <div className="text-sm opacity-80 whitespace-nowrap ml-auto mt-1">
                    {e.start_date ? (
                      <span>{ym(e.start_date)} — {ym(e.end_date)}</span>
                    ) : (
                      <span>{ym(e.end_date)}</span>
                    )}
                  </div>
                </div>

                {editing && (
                  <div className="no-print absolute top-2 right-2 z-20 flex gap-2 bg-white/90 backdrop-blur-sm rounded shadow px-2 py-1">
                    <button onClick={() => openEdit(i)} className="text-[11px] px-2 py-0.5">🖊️</button>
                    <button onClick={() => setDelIndex(i)} className="text-[11px]">❌</button>
                  </div>
                )}

                <div className="text-sm opacity-80">
                  {e.degree || ""}
                  {e.field_of_study ? " • " : ""}
                  {e.field_of_study || ""}
                </div>
              </div>
            ))}
          </div>
        )}

      <Modal open={editIndex!==null} onClose={()=>setEditIndex(null)} title="Modifier la formation">
        <div className="grid gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder="Établissement" value={f.institution} onChange={e=>setF({...f,institution:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Diplôme" value={f.degree} onChange={e=>setF({...f,degree:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Spécialité" value={f.field_of_study} onChange={e=>setF({...f,field_of_study:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Début (YYYY ou YYYY-MM)" value={f.start_date} onChange={e=>setF({...f,start_date:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Fin (YYYY ou YYYY-MM)" value={f.end_date} onChange={e=>setF({...f,end_date:e.target.value})} />
          <div className="flex justify-end gap-2">
            <button onClick={()=>setEditIndex(null)} className="rounded border px-3 py-1 text-sm">Annuler</button>
            <button onClick={edit} className="rounded border px-3 py-1 text-sm">Enregistrer</button>
          </div>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Ajouter une formation ou une certification">
        <div className="grid gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder="Établissement" value={nf.institution} onChange={e=>setNf({...nf,institution:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Diplôme ou certification" value={nf.degree} onChange={e=>setNf({...nf,degree:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Spécialité" value={nf.field_of_study} onChange={e=>setNf({...nf,field_of_study:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Début (YYYY ou YYYY-MM)" value={nf.start_date} onChange={e=>setNf({...nf,start_date:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Fin (YYYY ou YYYY-MM)" value={nf.end_date} onChange={e=>setNf({...nf,end_date:e.target.value})} />
          <div className="flex justify-end gap-2">
            <button onClick={()=>setAddOpen(false)} className="rounded border px-3 py-1 text-sm">Annuler</button>
            <button onClick={add} className="rounded border px-3 py-1 text-sm">Ajouter</button>
          </div>
        </div>
      </Modal>

      <Modal open={delIndex!==null} onClose={()=>setDelIndex(null)} title="Confirmation">
        <div className="space-y-3">
          <p className="text-sm">Voulez-vous vraiment supprimer cet élément ?</p>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setDelIndex(null)} className="rounded border px-3 py-1 text-sm">Non</button>
            <button onClick={confirmDelete} className="rounded border px-3 py-1 text-sm text-red-700">Oui</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

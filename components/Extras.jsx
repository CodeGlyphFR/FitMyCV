"use client";
import React from "react";
import Section from "./Section";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";

export default function Extras(props){
  const extras = Array.isArray(props.extras)? props.extras:[];
  const sectionTitles = props.sectionTitles || {};
  const title = sectionTitles.extras || "Informations complémentaires";
  const { editing } = useAdmin();
  const { mutate } = useMutate();
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

  // Masquer entièrement si vide et pas en édition (inchangé)
  if (extras.length===0 && !editing) return null;

  return (
    <Section title={<div className="flex items-center justify-between gap-2"><span>{title}</span>{editing && (<button onClick={()=>setAddOpen(true)} className="no-print text-xs rounded border px-2 py-1">+ Ajouter</button>)}</div>}>
      {extras.length === 0 ? (
        // ➜ Nouveau rendu: message bordé en édition quand vide
        editing ? (
          <div className="rounded-2xl border p-3 text-sm opacity-60">
            Aucune informations complémentaire pour le moment.
          </div>
        ) : null
      ) : (
        <div className="flex flex-wrap gap-2">
          {extras.map((e,i)=>(
            <div key={i} className="relative inline-block rounded-full border px-3 py-1 text-sm">
              <span className="font-semibold">{e.name || ""}</span>
              <span className="text-sm opacity-80"> : {e.summary || ""}</span>
              {editing && (
                <span>
                  <button onClick={()=>openEdit(i)} className="text-[11px] px-2 py-0.5">🖊️</button>
                  <button onClick={()=>setDelIndex(i)} className="text-[11px]">❌</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={editIndex!==null} onClose={()=>setEditIndex(null)} title="Modifier l'information">
        <div className="grid gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder="Titre" value={f.name} onChange={e=>setF({...f,name:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Résumé" value={f.summary} onChange={e=>setF({...f,summary:e.target.value})} />
          <div className="flex justify-end gap-2">
            <button onClick={()=>setEditIndex(null)} className="rounded border px-3 py-1 text-sm">Annuler</button>
            <button onClick={save} className="rounded border px-3 py-1 text-sm">Enregistrer</button>
          </div>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Ajouter une information">
        <div className="grid gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder="Titre" value={nf.name} onChange={e=>setNf({...nf,name:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Résumé" value={nf.summary} onChange={e=>setNf({...nf,summary:e.target.value})} />
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

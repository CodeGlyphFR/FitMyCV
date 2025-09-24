"use client";
import React from "react";
import Section from "./Section";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";

export default function Languages(props){
  const languages = Array.isArray(props.languages)? props.languages:[];
  const sectionTitles = props.sectionTitles || {};
  const title = sectionTitles.languages || "Langues";
  const { editing } = useAdmin();
  const { mutate } = useMutate();
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

  // Masquer entièrement la section si aucune langue et pas en édition
  if (languages.length===0 && !editing) return null;

  return (
    <Section title={<div className="flex items-center justify-between gap-2"><span>{title}</span>{editing && (<button onClick={()=>setAddOpen(true)} className="no-print text-xs rounded border px-2 py-1">+ Ajouter</button>)}</div>}>
      {languages.length === 0 ? (
        // Édition vide : message bordé
        editing ? (
          <div className="rounded-2xl border p-3 text-sm opacity-60">
            Aucune langue pour le moment.
          </div>
        ) : null
      ) : (
        <div className="flex flex-wrap gap-2">
          {languages.map((l,i)=>(
            <div key={i} className="relative inline-block rounded-full border px-3 py-1 text-sm">
              <span className="font-semibold">{l.name || ""}</span>
              <span className="text-sm opacity-80"> : {l.level || ""}</span>
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

      <Modal open={editIndex!==null} onClose={()=>setEditIndex(null)} title="Modifier la langue">
        <div className="grid gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder="Nom" value={f.name} onChange={e=>setF({...f,name:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Niveau" value={f.level} onChange={e=>setF({...f,level:e.target.value})} />
          <div className="flex justify-end gap-2"><button onClick={()=>setEditIndex(null)} className="rounded border px-3 py-1 text-sm">Annuler</button><button onClick={save} className="rounded border px-3 py-1 text-sm">Enregistrer</button></div>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="Ajouter une langue">
        <div className="grid gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder="Langue" value={nf.name} onChange={e=>setNf({...nf,name:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder="Niveau (ex: C1, B2, courant...)" value={nf.level} onChange={e=>setNf({...nf,level:e.target.value})} />
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

"use client";
import React from "react";
import Section from "./Section";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getSectionTitle } from "@/lib/i18n/cvLabels";

export default function Extras(props){
  const { t } = useLanguage();
  const extras = Array.isArray(props.extras)? props.extras:[];
  const sectionTitles = props.sectionTitles || {};
  const title = getSectionTitle('extras', sectionTitles.extras, t);
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
    <Section title={<div className="flex items-center justify-between gap-2"><span>{title}</span>{editing && (<button onClick={()=>setAddOpen(true)} className="no-print text-xs rounded border px-2 py-1">{t("common.add")}</button>)}</div>}>
      {extras.length === 0 ? (
        // ➜ Nouveau rendu: message bordé en édition quand vide
        editing ? (
          <div className="rounded-2xl border p-3 text-sm opacity-60">
            {t("cvSections.noExtras")}
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

      <Modal open={editIndex!==null} onClose={()=>setEditIndex(null)} title={t("cvSections.editExtras")}>
        <div className="grid gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.extraTitle")} value={f.name} onChange={e=>setF({...f,name:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.extraSummary")} value={f.summary} onChange={e=>setF({...f,summary:e.target.value})} />
          <div className="flex justify-end gap-2">
            <button onClick={()=>setEditIndex(null)} className="rounded border px-3 py-1 text-sm">{t("common.cancel")}</button>
            <button onClick={save} className="rounded border px-3 py-1 text-sm">{t("common.save")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title={t("cvSections.addExtra")}>
        <div className="grid gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.extraTitle")} value={nf.name} onChange={e=>setNf({...nf,name:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.extraSummary")} value={nf.summary} onChange={e=>setNf({...nf,summary:e.target.value})} />
          <div className="flex justify-end gap-2">
            <button onClick={()=>setAddOpen(false)} className="rounded border px-3 py-1 text-sm">{t("common.cancel")}</button>
            <button onClick={add} className="rounded border px-3 py-1 text-sm">{t("common.add")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={delIndex!==null} onClose={()=>setDelIndex(null)} title={t("common.confirmation")}>
        <div className="space-y-3">
          <p className="text-sm">{t("cvSections.deleteExtra")}</p>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setDelIndex(null)} className="rounded border px-3 py-1 text-sm">{t("common.cancel")}</button>
            <button onClick={confirmDelete} className="rounded border px-3 py-1 text-sm text-red-700">{t("common.delete")}</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

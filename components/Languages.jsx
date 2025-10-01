"use client";
import React from "react";
import Section from "./Section";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getLanguageLevelLabel, getSectionTitle } from "@/lib/i18n/cvLabels";

export default function Languages(props){
  const { t } = useLanguage();
  const languages = Array.isArray(props.languages)? props.languages:[];
  const sectionTitles = props.sectionTitles || {};
  const title = getSectionTitle('languages', sectionTitles.languages, t);
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
    <Section title={<div className="flex items-center justify-between gap-2"><span>{title}</span>{editing && (<button onClick={()=>setAddOpen(true)} className="no-print text-xs rounded border px-2 py-1">{t("common.add")}</button>)}</div>}>
      {languages.length === 0 ? (
        // Édition vide : message bordé
        editing ? (
          <div className="rounded-2xl border p-3 text-sm opacity-60">
            {t("cvSections.noLanguages")}
          </div>
        ) : null
      ) : (
        <div className="flex flex-wrap gap-2">
          {languages.map((l,i)=>(
            <div key={i} className="relative inline-block rounded-full border px-3 py-1 text-sm">
              <span className="font-semibold">{l.name || ""}</span>
              <span className="text-sm opacity-80"> : {getLanguageLevelLabel(l.level, t) || l.level || ""}</span>
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

      <Modal open={editIndex!==null} onClose={()=>setEditIndex(null)} title={t("cvSections.editLanguages")}>
        <div className="grid gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.languageName")} value={f.name} onChange={e=>setF({...f,name:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.languageLevel")} value={f.level} onChange={e=>setF({...f,level:e.target.value})} />
          <div className="flex justify-end gap-2"><button onClick={()=>setEditIndex(null)} className="rounded border px-3 py-1 text-sm">{t("common.cancel")}</button><button onClick={save} className="rounded border px-3 py-1 text-sm">{t("common.save")}</button></div>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title={t("cvSections.addLanguage")}>
        <div className="grid gap-2">
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.languageName")} value={nf.name} onChange={e=>setNf({...nf,name:e.target.value})} />
          <input className="rounded border px-2 py-1 text-sm" placeholder={t("cvSections.placeholders.languageLevel")} value={nf.level} onChange={e=>setNf({...nf,level:e.target.value})} />
          <div className="flex justify-end gap-2">
            <button onClick={()=>setAddOpen(false)} className="rounded border px-3 py-1 text-sm">{t("common.cancel")}</button>
            <button onClick={add} className="rounded border px-3 py-1 text-sm">{t("common.add")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={delIndex!==null} onClose={()=>setDelIndex(null)} title={t("common.confirmation")}>
        <div className="space-y-3">
          <p className="text-sm">{t("cvSections.deleteLanguage")}</p>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setDelIndex(null)} className="rounded border px-3 py-1 text-sm">{t("common.cancel")}</button>
            <button onClick={confirmDelete} className="rounded border px-3 py-1 text-sm text-red-700">{t("common.delete")}</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

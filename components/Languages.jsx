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
    <Section title={<div className="flex items-center justify-between gap-2"><span>{title}</span>{editing && (<button onClick={()=>setAddOpen(true)} className="no-print text-xs rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-white hover:bg-white/30 transition-all duration-200">{t("common.add")}</button>)}</div>}>
      {languages.length === 0 ? (
        // Édition vide : message bordé
        editing ? (
          <div className="rounded-2xl border border-white/15 p-3 text-sm opacity-60">
            {t("cvSections.noLanguages")}
          </div>
        ) : null
      ) : (
        <div className="flex flex-wrap gap-2">
          {languages.map((l,i)=>(
            <div key={i} className="relative inline-block rounded-full border border-white/15 px-3 py-1 text-sm overflow-visible">
              <div className={editing ? "pr-12" : ""}>
                <span className="font-semibold">{l.name || ""}</span>
                <span className="text-sm opacity-80"> : {getLanguageLevelLabel(l.level, t) || l.level || ""}</span>
              </div>
              {editing && (
                <div className="no-print absolute top-1/2 -translate-y-1/2 right-0 flex">
                  <button onClick={()=>openEdit(i)} className="text-sm hover:scale-110 transition-transform -mr-[0.8rem]"><img src="/icons/edit.png" alt="Edit" className="h-3 w-3 " /></button>
                  <button onClick={()=>setDelIndex(i)} className="text-sm hover:scale-110 transition-transform"><img src="/icons/delete.png" alt="Delete" className="h-3 w-3 " /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={editIndex!==null} onClose={()=>setEditIndex(null)} title={t("cvSections.editLanguages")}>
        <div className="grid gap-2">
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none" placeholder={t("cvSections.placeholders.languageName")} value={f.name} onChange={e=>setF({...f,name:e.target.value})} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none" placeholder={t("cvSections.placeholders.languageLevel")} value={f.level} onChange={e=>setF({...f,level:e.target.value})} />
          <div className="flex justify-end gap-2"><button onClick={()=>setEditIndex(null)} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">{t("common.cancel")}</button><button onClick={save} className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">{t("common.save")}</button></div>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title={t("cvSections.addLanguage")}>
        <div className="grid gap-2">
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none" placeholder={t("cvSections.placeholders.languageName")} value={nf.name} onChange={e=>setNf({...nf,name:e.target.value})} />
          <input className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none" placeholder={t("cvSections.placeholders.languageLevel")} value={nf.level} onChange={e=>setNf({...nf,level:e.target.value})} />
          <div className="flex justify-end gap-2">
            <button onClick={()=>setAddOpen(false)} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">{t("common.cancel")}</button>
            <button onClick={add} className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">{t("common.add")}</button>
          </div>
        </div>
      </Modal>

      <Modal open={delIndex!==null} onClose={()=>setDelIndex(null)} title={t("common.confirmation")}>
        <div className="space-y-3">
          <p className="text-sm text-white drop-shadow">{t("cvSections.deleteLanguage")}</p>
          <div className="flex justify-end gap-2">
            <button onClick={()=>setDelIndex(null)} className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors">{t("common.cancel")}</button>
            <button onClick={confirmDelete} className="px-6 py-2.5 rounded-lg bg-red-500/30 hover:bg-red-500/40 border border-red-500/50 text-white text-sm font-semibold transition-colors">{t("common.delete")}</button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

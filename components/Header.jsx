"use client";
import React from "react";
import SourceInfo from "./SourceInfo";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import FormRow from "./ui/FormRow";

export default function Header(props){
  const header = props.header || {};
  const links = (header.contact && header.contact.links) || [];
  const { editing } = useAdmin();
  const { mutate } = useMutate();
  const [open, setOpen] = React.useState(false);
  const [sourceInfo, setSourceInfo] = React.useState({ sourceType: null, sourceValue: null });

  const [f, setF] = React.useState({
    full_name: header.full_name || "",
    current_title: header.current_title || "",
    email: header.contact?.email || "",
    phone: header.contact?.phone || "",
    city: header.contact?.location?.city || "",
    region: header.contact?.location?.region || "",
    country_code: header.contact?.location?.country_code || "",
  });

  const [linksLocal, setLinksLocal] = React.useState(
    Array.isArray(links) ? links.map(l => ({ label: l.label || "", url: l.url || "" })) : []
  );

  React.useEffect(()=>{
    setF({
      full_name: header.full_name || "",
      current_title: header.current_title || "",
      email: header.contact?.email || "",
      phone: header.contact?.phone || "",
      city: header.contact?.location?.city || "",
      region: header.contact?.location?.region || "",
      country_code: header.contact?.location?.country_code || ""
    });
    setLinksLocal(Array.isArray(header.contact?.links)
      ? header.contact.links.map(l => ({ label: l.label || "", url: l.url || "" }))
      : []
    );
  }, [header]);

  React.useEffect(() => {
    fetch("/api/cv/source")
      .then(res => {
        if (!res.ok) {
          return { sourceType: null, sourceValue: null };
        }
        return res.json();
      })
      .then(data => {
        setSourceInfo({ sourceType: data.sourceType, sourceValue: data.sourceValue });
      })
      .catch(err => console.error("Failed to fetch source info:", err));
  }, []); // Fetch seulement au montage du composant

  // Si le CV est vide (pas de header), ne pas afficher le composant
  const isEmpty = !header.full_name && !header.current_title && !header.contact?.email;
  if (isEmpty && !editing) {
    return null;
  }

  // -- helper: force https:// si pas de schéma http/https
  function ensureAbsoluteUrl(u) {
    const url = (u || "").trim();
    if (!url) return "";
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  async function save(){
    const cleanedLinks = (linksLocal || [])
      .map(l => ({
        label: (l.label || "").trim(),
        url: ensureAbsoluteUrl(l.url) // ✅ ajoute https:// si http(s) absent
      }))
      .filter(l => !!l.url); // garde seulement ceux avec une URL non vide

    const next = {
      full_name: f.full_name,
      current_title: f.current_title,
      contact: {
        email: f.email,
        phone: f.phone,
        links: cleanedLinks,
        location: {
          city: f.city, region: f.region, country_code: f.country_code
        }
      }
    };
    await mutate({ op:"set", path: "header", value: next });
    setOpen(false);
  }

  return (
    <header className="page mb-6 flex items-start justify-between gap-4 bg-gradient-to-r from-zinc-100 to-zinc-50 p-4 rounded-2xl border relative">
      <div>
        <h1 className="text-2xl font-bold">{header.full_name || ""}</h1>
        <p className="text-sm opacity-80">{header.current_title || ""}</p>
        <div className="mt-2 text-sm opacity-90">
          <div>{header.contact?.email || ""}</div>
          <div>{header.contact?.phone || ""}</div>
          {header.contact?.location ? (
            <div>
              {header.contact.location.city || ""}{header.contact.location.region? ", ":""}
              {header.contact.location.region || ""}
              {header.contact.location.country_code? " (" : ""}{header.contact.location.country_code || ""}{header.contact.location.country_code?")":""}
            </div>
          ) : null}
          {Array.isArray(links) && links.length>0 ? (
            <div className="mt-1 flex flex-wrap gap-2">
              {links.map((l,i)=> (
                <a
                  key={i}
                  href={/^https?:\/\//i.test(l.url||"") ? l.url : `https://${l.url||""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted"
                >
                  {l.label || l.url}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-start gap-3">
        {editing ? (
          <button onClick={()=>setOpen(true)} className="no-print rounded border px-2 py-1 text-sm hover:shadow" type="button">🖊️</button>
        ) : null}
        <SourceInfo sourceType={sourceInfo.sourceType} sourceValue={sourceInfo.sourceValue} />
      </div>

      <Modal open={open} onClose={()=>setOpen(false)} title="Modifier l'entête">
        <div className="grid gap-3 md:grid-cols-2">
          <FormRow label="Nom complet">
            <input className="rounded border px-2 py-1 text-sm w-full" value={f.full_name} onChange={e=>setF({...f,full_name:e.target.value})} />
          </FormRow>
          <FormRow label="Titre actuel">
            <input className="rounded border px-2 py-1 text-sm w-full" value={f.current_title} onChange={e=>setF({...f,current_title:e.target.value})} />
          </FormRow>
          <FormRow label="Email">
            <input className="rounded border px-2 py-1 text-sm w-full" value={f.email} onChange={e=>setF({...f,email:e.target.value})} />
          </FormRow>
          <FormRow label="Téléphone">
            <input className="rounded border px-2 py-1 text-sm w-full" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} />
          </FormRow>

          <div className="md:col-span-2 grid grid-cols-3 gap-3">
            <FormRow label="Ville">
              <input className="rounded border px-2 py-1 text-sm w-full" value={f.city} onChange={e=>setF({...f,city:e.target.value})} />
            </FormRow>
            <FormRow label="Région">
              <input className="rounded border px-2 py-1 text-sm w-full" value={f.region} onChange={e=>setF({...f,region:e.target.value})} />
            </FormRow>
            <FormRow label="Pays (code)">
              <input className="rounded border px-2 py-1 text-sm w-full" value={f.country_code} onChange={e=>setF({...f,country_code:e.target.value})} />
            </FormRow>
          </div>

          {/* Liens */}
          <div className="md:col-span-2">
            <div className="text-sm font-medium mb-2">Liens</div>
            <div className="space-y-2">
              {linksLocal.length === 0 && (
                <div className="rounded border px-2 py-1 text-xs opacity-60">
                  Aucun lien pour le moment.
                </div>
              )}
              {linksLocal.map((row, idx) => (
                <div key={idx} className="grid grid-cols-7 gap-2 items-center">
                  <input
                    className="col-span-2 rounded border px-2 py-1 text-sm"
                    placeholder="Label (ex: GitHub)"
                    value={row.label}
                    onChange={e=>{
                      const arr=[...linksLocal]; arr[idx]={...arr[idx], label:e.target.value}; setLinksLocal(arr);
                    }}
                  />
                  <input
                    className="col-span-4 rounded border px-2 py-1 text-sm"
                    placeholder="URL (ex: https://github.com/erick)"
                    value={row.url}
                    onChange={e=>{
                      const arr=[...linksLocal]; arr[idx]={...arr[idx], url:e.target.value}; setLinksLocal(arr);
                    }}
                  />
                  <button
                    type="button"
                    onClick={()=>{
                      const arr=[...linksLocal]; arr.splice(idx,1); setLinksLocal(arr);
                    }}
                    className="text-xs rounded border px-2 py-1"
                    title="Supprimer"
                  >
                    ❌
                  </button>
                </div>
              ))}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={()=>setLinksLocal([...(linksLocal||[]), {label:"", url:""}])}
                  className="text-xs rounded border px-2 py-1"
                >
                  ➕ Ajouter un lien
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <button onClick={()=>setOpen(false)} className="rounded border px-3 py-1 text-sm" type="button">Annuler</button>
            <button onClick={save} className="rounded border px-3 py-1 text-sm" type="button">Enregistrer</button>
          </div>
        </div>
      </Modal>
    </header>
  );
}

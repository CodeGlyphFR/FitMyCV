"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function NewCVPage(){
  const router = useRouter();
  const { status } = useSession();
  const { t } = useLanguage();
  const [full_name, setFullName] = React.useState("");
  const [current_title, setCurrentTitle] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (status === "unauthenticated"){
      router.replace("/auth?mode=login");
    }
  }, [status, router]);

  async function create(){
    const trimmedName = full_name.trim();
    const trimmedTitle = current_title.trim();

    if (!trimmedName || !trimmedTitle){
      setError(t("newCv.required"));
      return;
    }

    setBusy(true); setError(null);
    try{
      const res = await fetch("/api/cvs/create", {
        method: "POST",
        headers: { "content-type":"application/json" },
        body: JSON.stringify({ full_name: trimmedName, current_title: trimmedTitle, email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t("newCv.error"));

      // Set the newly created CV as current
      document.cookie = "cvFile="+encodeURIComponent(data.file)+"; path=/; max-age=31536000";
      try {
        localStorage.setItem("admin:cv", data.file);
      } catch (_err) {}

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cv:list:changed"));
      }

      // Redirect to home with the new CV
      router.push("/");
      router.refresh();
    } catch(e) {
      setError(e?.message || t("newCv.error"));
    }
    setBusy(false);
  }
  if (status === "loading"){
    return <main className="max-w-2xl mx-auto p-4">{t("newCv.loading")}</main>;
  }

  return (<main className="max-w-2xl mx-auto p-4"><h1 className="text-xl font-semibold mb-4">{t("newCv.title")}</h1><div className="rounded-2xl border p-4 space-y-3">
    <div><label className="text-sm block mb-1">{t("newCv.fullName")}<span className="text-red-500" aria-hidden="true"> *</span></label><input className="w-full rounded-sm border px-3 py-2" value={full_name} onChange={e=>setFullName(e.target.value)} placeholder={t("newCv.fullNamePlaceholder")} required /></div>
    <div><label className="text-sm block mb-1">{t("newCv.currentTitle")}<span className="text-red-500" aria-hidden="true"> *</span></label><input className="w-full rounded-sm border px-3 py-2" value={current_title} onChange={e=>setCurrentTitle(e.target.value)} placeholder={t("newCv.currentTitlePlaceholder")} required /></div>
    <div><label className="text-sm block mb-1">{t("newCv.email")}</label><input className="w-full rounded-sm border px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder={t("newCv.emailPlaceholder")} /></div>
    {error ? <div className="text-sm text-red-600">{String(error)}</div> : null}
    <div className="flex gap-2"><button onClick={create} disabled={busy || !full_name.trim() || !current_title.trim()} className="rounded-sm border px-3 py-2 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">{busy? t("newCv.creating"):t("newCv.createButton")}</button><button onClick={()=>router.push("/")} className="rounded-sm border px-3 py-2">{t("newCv.cancel")}</button></div>
    <p className="text-xs opacity-70">{t("newCv.tip")}</p>
  </div></main>);
}

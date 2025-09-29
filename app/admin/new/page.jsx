"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function NewCVPage(){
  const router = useRouter();
  const { status } = useSession();
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
      setError("Merci de renseigner le nom complet et le titre actuel.");
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
      if (!res.ok) throw new Error(data?.error || "Erreur");

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
      setError(e?.message || "Erreur");
    }
    setBusy(false);
  }
  if (status === "loading"){
    return <main className="max-w-2xl mx-auto p-4">Chargement…</main>;
  }

  return (<main className="max-w-2xl mx-auto p-4"><h1 className="text-xl font-semibold mb-4">Créer un nouveau CV</h1><div className="rounded-2xl border p-4 space-y-3">
    <div><label className="text-sm block mb-1">Nom complet<span className="text-red-500" aria-hidden="true"> *</span></label><input className="w-full rounded border px-3 py-2" value={full_name} onChange={e=>setFullName(e.target.value)} placeholder="Ex: Erick De Smet" required /></div>
    <div><label className="text-sm block mb-1">Titre actuel<span className="text-red-500" aria-hidden="true"> *</span></label><input className="w-full rounded border px-3 py-2" value={current_title} onChange={e=>setCurrentTitle(e.target.value)} placeholder="Ex: Développeur Full‑Stack" required /></div>
    <div><label className="text-sm block mb-1">Email</label><input className="w-full rounded border px-3 py-2" value={email} onChange={e=>setEmail(e.target.value)} placeholder="email@exemple.com" /></div>
    {error ? <div className="text-sm text-red-600">{String(error)}</div> : null}
    <div className="flex gap-2"><button onClick={create} disabled={busy || !full_name.trim() || !current_title.trim()} className="rounded border px-3 py-2 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed">{busy? "Création...":"Créer le CV"}</button><button onClick={()=>router.push("/")} className="rounded border px-3 py-2">Annuler</button></div>
    <p className="text-xs opacity-70">Tu pourras compléter toutes les sections ensuite via le mode édition.</p>
  </div></main>);
}

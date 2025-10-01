"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
var Ctx = React.createContext(null);
export function useAdmin(){ var c=React.useContext(Ctx); if(!c) throw new Error("useAdmin outside"); return c; }
export default function AdminProvider(props){
  const { data: session } = useSession();
  const [editing, setEditingState] = React.useState(false);
  const [currentFile, setCurrentFile] = React.useState("");
  const [hasAnyCv, setHasAnyCv] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(function(){
    const stored = localStorage.getItem("admin:cv");
    if (stored) { setCurrentFile(stored); return; }
    const cookie = document.cookie.split(";").map(v=>v.trim()).find(v=>v.startsWith("cvFile="));
    if (cookie){
      const value = decodeURIComponent(cookie.split("=")[1] || "");
      setCurrentFile(value || "");
    }
  }, []);

  // Check if user has any CVs
  React.useEffect(() => {
    if (!session?.user?.id) return;

    async function checkCvs() {
      try {
        const res = await fetch("/api/cvs", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const hasCv = Array.isArray(data.items) && data.items.length > 0;
          setHasAnyCv(hasCv);
          if (!hasCv) {
            setEditingState(false);
          }
        }
      } catch (error) {
        console.error("Failed to check CVs:", error);
      }
    }

    checkCvs();

    // Listen for CV list changes
    const handleCvListChanged = () => checkCvs();
    window.addEventListener("cv:list:changed", handleCvListChanged);
    return () => window.removeEventListener("cv:list:changed", handleCvListChanged);
  }, [session?.user?.id]);

  React.useEffect(function(){
    localStorage.setItem("admin:editing", editing ? "1" : "0");
    document.body.classList.toggle("admin-editing", editing);
  }, [editing]);

  React.useEffect(function(){
    if (currentFile) localStorage.setItem("admin:cv", currentFile);
  }, [currentFile]);

  React.useEffect(() => {
    if (session?.user?.id){
      try {
        const stored = localStorage.getItem("admin:editing");
        setEditingState(stored === "1");
      } catch (_err) {
        setEditingState(false);
      }
    } else {
      setEditingState(false);
      setCurrentFile("");
    }
  }, [session?.user?.id]);

  function setEditing(next){
    if (!session?.user?.id){
      setEditingState(false);
      return;
    }
    setEditingState(next);
  }

  return (
    <Ctx.Provider value={{ editing, setEditing, setCurrentFile }}>
      {props.children}
      {session?.user?.id && pathname !== "/admin/new" && hasAnyCv ? (
        <button
          onClick={()=>setEditing(!editing)}
          className="fixed bottom-4 right-4 z-50 rounded-full px-4 py-2 shadow border bg-white text-sm hover:shadow-md"
          style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
        >
          {editing ? "✏️ Édition ON" : "Édition OFF"}
        </button>
      ) : null}

      <style jsx global>{`
        .admin-editing [data-editable="true"]{outline:1px dashed rgba(37,99,235,.6);cursor:text}
        .admin-editing [data-editable="true"]:hover{background:rgba(37,99,235,.06)}
      `}</style>
    </Ctx.Provider>
  );
}

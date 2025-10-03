"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
var Ctx = React.createContext(null);
export function useAdmin(){ var c=React.useContext(Ctx); if(!c) throw new Error("useAdmin outside"); return c; }
export default function AdminProvider(props){
  const { data: session } = useSession();
  const { t } = useLanguage();
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
          className={`
            fixed bottom-6 right-6 z-50 no-print
            w-10 h-10 rounded-full
            shadow-lg hover:shadow-xl
            flex items-center justify-center
            transition-all duration-200
            hover:scale-110
            border
            pointer-events-auto
            ${editing
              ? 'bg-blue-50 border-blue-300'
              : 'bg-white border-neutral-300'
            }
          `}
          title={editing ? t("editMode.on") : t("editMode.off")}
          aria-label={editing ? t("editMode.on") : t("editMode.off")}
          style={{
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitTransform: 'translateZ(0)',
            WebkitBackfaceVisibility: 'hidden',
            willChange: 'transform'
          }}
        >
          <span className={`text-xl ${editing ? '' : 'grayscale opacity-70'}`}>
            📝
          </span>
        </button>
      ) : null}

      <style jsx global>{`
        .admin-editing [data-editable="true"]{outline:1px dashed rgba(37,99,235,.6);cursor:text}
        .admin-editing [data-editable="true"]:hover{background:rgba(37,99,235,.06)}
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </Ctx.Provider>
  );
}

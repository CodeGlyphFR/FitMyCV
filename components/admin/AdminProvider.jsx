"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSettings } from "@/lib/settings/SettingsContext";
var Ctx = React.createContext(null);
export function useAdmin(){ var c=React.useContext(Ctx); if(!c) throw new Error("useAdmin outside"); return c; }
export default function AdminProvider(props){
  const { data: session } = useSession();
  const { settings } = useSettings();
  const [currentFile, setCurrentFile] = React.useState("");
  const [hasAnyCv, setHasAnyCv] = React.useState(false);
  const [hasDebitedEditSession, setHasDebitedEditSession] = React.useState(false);
  const pathname = usePathname();

  // Editing est dérivé : toujours actif quand l'utilisateur a un CV et que la feature est activée
  const editing = !!(session?.user?.id && hasAnyCv && settings.feature_edit_mode);

  React.useEffect(function(){
    const stored = localStorage.getItem("admin:cv");
    if (stored) { setCurrentFile(stored); return; }
    const cookie = document.cookie.split(";").map(v=>v.trim()).find(v=>v.startsWith("cvFile="));
    if (cookie){
      const value = decodeURIComponent(cookie.split("=")[1] || "");
      setCurrentFile(value || "");
    }
  }, []);

  // Check if user has any CVs (avec debounce pour éviter les 429)
  React.useEffect(() => {
    if (!session?.user?.id) return;

    let debounceTimer = null;
    let lastCheckTime = 0;
    const DEBOUNCE_MS = 500;

    async function checkCvs() {
      // Debounce: ignorer si un check récent a eu lieu
      const now = Date.now();
      if (now - lastCheckTime < DEBOUNCE_MS) {
        if (!debounceTimer) {
          debounceTimer = setTimeout(() => {
            debounceTimer = null;
            checkCvs();
          }, DEBOUNCE_MS);
        }
        return;
      }
      lastCheckTime = now;

      try {
        const res = await fetch("/api/cvs", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const hasCv = Array.isArray(data.items) && data.items.length > 0;
          setHasAnyCv(hasCv);
        }
        // Ignorer silencieusement les erreurs 429 (rate limit)
      } catch (error) {
        console.error("Failed to check CVs:", error);
      }
    }

    checkCvs();

    // Listen for CV list changes (debounced)
    const handleCvListChanged = () => checkCvs();
    window.addEventListener("cv:list:changed", handleCvListChanged);
    return () => {
      window.removeEventListener("cv:list:changed", handleCvListChanged);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [session?.user?.id]);

  React.useEffect(function(){
    document.body.classList.toggle("admin-editing", editing);
  }, [editing]);

  React.useEffect(function(){
    if (currentFile) localStorage.setItem("admin:cv", currentFile);
  }, [currentFile]);

  React.useEffect(() => {
    if (!session?.user?.id) {
      setCurrentFile("");
    }
  }, [session?.user?.id]);

  // Setter simple pour setEditing (utilisé par OnboardingOrchestrator)
  function setEditing(next) {
    // editing est dérivé, ce setter est un no-op mais conserve la compatibilité
    return Promise.resolve();
  }

  function markEditAsDebited() {
    setHasDebitedEditSession(true);
  }

  return (
    <Ctx.Provider value={{ editing, setEditing, setCurrentFile, hasDebitedEditSession, markEditAsDebited, hasAnyCv }}>
      {props.children}

      {/* Analytics button for ADMIN users */}
      {session?.user?.role === 'ADMIN' && pathname !== "/admin/analytics" ? (
        <button
          onClick={() => window.location.href = '/admin/analytics'}
          className="fixed bottom-6 right-6 z-50 no-print w-10 h-10 rounded-full shadow-2xl hover:shadow-sm-xl flex items-center justify-center transition-all duration-200 hover:scale-110 border-2 pointer-events-auto backdrop-blur-xl bg-white/20 border-white/30"
          title="Analytics Dashboard"
          aria-label="Analytics Dashboard"
          style={{
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
            WebkitTransform: 'translateZ(0)',
            WebkitBackfaceVisibility: 'hidden',
            willChange: 'transform'
          }}
        >
          <img
            src="/dashboard.png"
            alt="Analytics Dashboard"
            className="h-5 w-5 drop-shadow-lg"
          />
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

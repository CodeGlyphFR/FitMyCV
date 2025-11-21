"use client";
import React from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";
import { useNotifications } from "@/components/notifications/NotificationProvider";

var Ctx = React.createContext(null);
export function useAdmin(){ var c=React.useContext(Ctx); if(!c) throw new Error("useAdmin outside"); return c; }
export default function AdminProvider(props){
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { settings } = useSettings();
  const { addNotification } = useNotifications();
  const [editing, setEditingState] = React.useState(false);
  const [currentFile, setCurrentFile] = React.useState("");
  const [hasAnyCv, setHasAnyCv] = React.useState(false);
  const [hasDebitedEditSession, setHasDebitedEditSession] = React.useState(false);
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

  async function setEditing(next){
    if (!session?.user?.id){
      setEditingState(false);
      return;
    }

    if (next === true) {
      // Vérifier si l'utilisateur peut activer le mode édition (sans débiter)
      try {
        const res = await fetch('/api/cv/can-edit');
        const data = await res.json();

        if (!data.canEdit) {
          // Bloquer + afficher notification d'erreur avec bouton d'action
          const notification = {
            type: 'error',
            message: data.reason || 'Vous ne pouvez pas activer le mode édition',
            duration: 10000 // Plus long car il y a une action à faire
          };

          // Ajouter le bouton d'action si nécessaire
          if (data.redirectUrl) {
            notification.redirectUrl = data.redirectUrl;
            notification.linkText = 'Voir mes options';
          }

          addNotification(notification);

          return; // Ne pas activer le mode édition
        }

        // OK → Activer le mode édition (sans débiter)
        setHasDebitedEditSession(false);
        setEditingState(true);
      } catch (error) {
        console.error('[AdminProvider] Erreur vérification can-edit:', error);
        addNotification({
          type: 'error',
          message: 'Erreur lors de la vérification',
          duration: 4000
        });
      }
    } else {
      // Sortie du mode édition → Reset du flag
      setHasDebitedEditSession(false);
      setEditingState(false);
    }
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
          className="fixed bottom-[4.5rem] right-6 z-50 no-print w-10 h-10 rounded-full shadow-2xl hover:shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-110 border-2 pointer-events-auto backdrop-blur-xl bg-white/20 border-white/30"
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

      {/* Edit mode button */}
      {session?.user?.id && pathname !== "/admin/new" && pathname !== "/admin/analytics" && hasAnyCv && settings.feature_edit_mode ? (
        <button
          data-onboarding="edit-mode-button"
          onClick={()=>setEditing(!editing)}
          className={`
            fixed bottom-6 right-6 z-50 no-print
            w-10 h-10 rounded-full
            shadow-2xl hover:shadow-xl
            flex items-center justify-center
            transition-all duration-200
            hover:scale-110
            border-2
            pointer-events-auto
            backdrop-blur-xl
            ${editing
              ? 'bg-emerald-500/30 border-emerald-400/60'
              : 'bg-white/20 border-white/30'
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
          <img
            src="/icons/edit_mode.png"
            alt={editing ? t("editMode.on") : t("editMode.off")}
            className={`h-5 w-5 drop-shadow-lg ${editing ? '' : 'grayscale opacity-70'}`}
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

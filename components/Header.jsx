"use client";
import React from "react";
import SourceInfo from "./SourceInfo";
import MatchScore from "./MatchScore";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import FormRow from "./ui/FormRow";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { useNotifications } from "@/components/notifications/NotificationProvider";

export default function Header(props){
  const header = props.header || {};
  const links = (header.contact && header.contact.links) || [];
  const { editing } = useAdmin();
  const { mutate } = useMutate();
  const { t, language } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const [openTranslateModal, setOpenTranslateModal] = React.useState(false);
  const [sourceInfo, setSourceInfo] = React.useState({ sourceType: null, sourceValue: null });
  const [matchScore, setMatchScore] = React.useState(null);
  const [matchScoreStatus, setMatchScoreStatus] = React.useState("idle");
  const [canRefreshScore, setCanRefreshScore] = React.useState(true);
  const [refreshCount, setRefreshCount] = React.useState(0);
  const [minutesUntilReset, setMinutesUntilReset] = React.useState(0);
  const { localDeviceId, addOptimisticTask, removeOptimisticTask, refreshTasks } = useBackgroundTasks();
  const { addNotification } = useNotifications();

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

  const headerKeyRef = React.useRef("");
  const currentHeaderKey = JSON.stringify(header);

  React.useEffect(()=>{
    if (headerKeyRef.current === currentHeaderKey) return;
    headerKeyRef.current = currentHeaderKey;

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
  });

  const fetchMatchScore = React.useCallback(async () => {
    try {
      // Récupérer le fichier CV actuel depuis le cookie
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (!cvFileCookie) return;

      const currentFile = decodeURIComponent(cvFileCookie.split('=')[1]);

      const response = await fetch(`/api/cv/match-score?file=${encodeURIComponent(currentFile)}`);
      if (!response.ok) {
        console.error("Failed to fetch match score");
        return;
      }

      const data = await response.json();
      setMatchScore(data.score);
      setMatchScoreStatus(data.score !== null ? "idle" : "idle");
      setCanRefreshScore(data.canRefresh ?? true);
      setRefreshCount(data.refreshCount || 0);
      setMinutesUntilReset(data.minutesUntilReset || 0);
    } catch (error) {
      console.error("Error fetching match score:", error);
    }
  }, []);

  const fetchSourceInfo = React.useCallback(() => {
    fetch("/api/cv/source", { cache: "no-store" })
      .then(res => {
        if (!res.ok) {
          return { sourceType: null, sourceValue: null };
        }
        return res.json();
      })
      .then(data => {
        setSourceInfo({ sourceType: data.sourceType, sourceValue: data.sourceValue });

        // Si le CV est créé depuis un lien, récupérer le score de match
        if (data.sourceType === "link") {
          fetchMatchScore();
        } else {
          setMatchScore(null);
          setMatchScoreStatus("idle");
        }
      })
      .catch(err => console.error("Failed to fetch source info:", err));
  }, [fetchMatchScore]);

  React.useEffect(() => {
    fetchSourceInfo();
  }, [fetchSourceInfo]); // Fetch au montage

  React.useEffect(() => {
    // Écouter les changements de CV sélectionné
    const handleCvSelected = () => {
      fetchSourceInfo();
    };

    window.addEventListener("cv:selected", handleCvSelected);
    return () => window.removeEventListener("cv:selected", handleCvSelected);
  }, [fetchSourceInfo]);

  const handleRefreshMatchScore = React.useCallback(async () => {
    // Vérifier le rate limit avant de commencer
    if (!canRefreshScore) {
      addNotification({
        type: "error",
        message: t("matchScore.rateLimitExceeded", { minutes: minutesUntilReset }),
        duration: 5000,
      });
      return;
    }

    setMatchScoreStatus("loading");

    try {
      // Récupérer le fichier CV actuel depuis le cookie
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (!cvFileCookie) {
        throw new Error("No CV file selected");
      }

      const currentFile = decodeURIComponent(cvFileCookie.split('=')[1]);

      const response = await fetch("/api/cv/match-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cvFile: currentFile, isAutomatic: false }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Gestion spéciale pour le rate limit
        if (response.status === 429) {
          setCanRefreshScore(false);
          setMinutesUntilReset(errorData.minutesLeft || 60);
          throw new Error(errorData.details || t("matchScore.rateLimitExceeded", { minutes: errorData.minutesLeft || 60 }));
        }

        const errorMessage = errorData.details || errorData.error || "Failed to calculate match score";
        console.error("[Header] Erreur API match score:", errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setMatchScore(data.score);
      setMatchScoreStatus("idle");
      setRefreshCount(data.refreshCount || 0);

      // Si on atteint la limite
      if (data.refreshCount >= 5) {
        setCanRefreshScore(false);
      }

      // Pas de notification - le décompte dans la bulle suffit
    } catch (error) {
      console.error("Error refreshing match score:", error);
      console.error("Error message:", error.message);
      setMatchScoreStatus("error");

      addNotification({
        type: "error",
        message: error.message,
        duration: 6000,
      });
    }
  }, [t, addNotification, canRefreshScore, minutesUntilReset]);

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

  function handleTranslate() {
    // Ouvrir le modal de sélection de langue
    setOpenTranslateModal(true);
  }

  async function executeTranslation(targetLanguage) {
    // Récupérer le fichier CV actuel depuis le cookie ou localStorage
    let currentFile = null;
    try {
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (cvFileCookie) {
        currentFile = decodeURIComponent(cvFileCookie.split('=')[1]);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération du CV actuel:', err);
    }

    if (!currentFile) {
      addNotification({
        type: "error",
        message: t("translate.errors.noCvSelected"),
        duration: 3000,
      });
      return;
    }

    const targetLangName = targetLanguage === 'fr' ? 'français' : 'anglais';

    // Créer la tâche optimiste immédiatement
    const optimisticTaskId = addOptimisticTask({
      type: 'translate-cv',
      label: `Traduction en ${targetLangName}`,
      metadata: { sourceFile: currentFile, targetLanguage },
      shouldUpdateCvList: true,
    });

    // Fermer le modal et notifier immédiatement
    setOpenTranslateModal(false);
    addNotification({
      type: "info",
      message: t("translate.notifications.scheduled", { targetLangName }),
      duration: 2500,
    });

    // Envoyer la requête en arrière-plan
    try {
      const response = await fetch("/api/background-tasks/translate-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceFile: currentFile,
          targetLanguage,
          deviceId: localDeviceId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Impossible de mettre la tâche en file.");
      }

      // Succès : supprimer la tâche optimiste et rafraîchir
      removeOptimisticTask(optimisticTaskId);
      await refreshTasks();
    } catch (error) {
      console.error("Impossible de planifier la traduction", error);
      // Échec : supprimer la tâche optimiste et notifier
      removeOptimisticTask(optimisticTaskId);
      addNotification({
        type: "error",
        message: error?.message || t("translate.notifications.error"),
        duration: 4000,
      });
    }
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
        <MatchScore
          sourceType={sourceInfo.sourceType}
          sourceValue={sourceInfo.sourceValue}
          score={matchScore}
          status={matchScoreStatus}
          canRefresh={canRefreshScore}
          refreshCount={refreshCount}
          minutesUntilReset={minutesUntilReset}
          onRefresh={handleRefreshMatchScore}
        />
        <SourceInfo sourceType={sourceInfo.sourceType} sourceValue={sourceInfo.sourceValue} />
      </div>

      {/* Bouton de traduction en bas à droite */}
      {!editing ? (
        <button
          onClick={handleTranslate}
          className="no-print absolute bottom-3 right-3 rounded border px-2 py-1 text-xs hover:shadow bg-white"
          type="button"
          title={t("translate.buttonTitle")}
        >
          🌐
        </button>
      ) : null}

      <Modal open={open} onClose={()=>setOpen(false)} title={t("header.modalTitle")}>
        <div className="grid gap-3 md:grid-cols-2">
          <FormRow label={t("header.fullName")}>
            <input className="rounded border px-2 py-1 text-sm w-full" value={f.full_name} onChange={e=>setF({...f,full_name:e.target.value})} />
          </FormRow>
          <FormRow label={t("header.currentTitle")}>
            <input className="rounded border px-2 py-1 text-sm w-full" value={f.current_title} onChange={e=>setF({...f,current_title:e.target.value})} />
          </FormRow>
          <FormRow label={t("header.email")}>
            <input className="rounded border px-2 py-1 text-sm w-full" value={f.email} onChange={e=>setF({...f,email:e.target.value})} />
          </FormRow>
          <FormRow label={t("header.phone")}>
            <input className="rounded border px-2 py-1 text-sm w-full" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} />
          </FormRow>

          <div className="md:col-span-2 grid grid-cols-3 gap-3">
            <FormRow label={t("header.city")}>
              <input className="rounded border px-2 py-1 text-sm w-full" value={f.city} onChange={e=>setF({...f,city:e.target.value})} />
            </FormRow>
            <FormRow label={t("header.region")}>
              <input className="rounded border px-2 py-1 text-sm w-full" value={f.region} onChange={e=>setF({...f,region:e.target.value})} />
            </FormRow>
            <FormRow label={t("header.countryCode")}>
              <input className="rounded border px-2 py-1 text-sm w-full" value={f.country_code} onChange={e=>setF({...f,country_code:e.target.value})} />
            </FormRow>
          </div>

          {/* Liens */}
          <div className="md:col-span-2">
            <div className="text-sm font-medium mb-2">{t("header.links")}</div>
            <div className="space-y-2">
              {linksLocal.length === 0 && (
                <div className="rounded border px-2 py-1 text-xs opacity-60">
                  {t("header.noLinks")}
                </div>
              )}
              {linksLocal.map((row, idx) => (
                <div key={idx} className="grid grid-cols-7 gap-2 items-center">
                  <input
                    className="col-span-2 rounded border px-2 py-1 text-sm"
                    placeholder={t("header.labelPlaceholder")}
                    value={row.label}
                    onChange={e=>{
                      const arr=[...linksLocal]; arr[idx]={...arr[idx], label:e.target.value}; setLinksLocal(arr);
                    }}
                  />
                  <input
                    className="col-span-4 rounded border px-2 py-1 text-sm"
                    placeholder={t("header.urlPlaceholder")}
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
                    title={t("common.delete")}
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
                  ➕ {t("header.addLink")}
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <button onClick={()=>setOpen(false)} className="rounded border px-3 py-1 text-sm" type="button">{t("common.cancel")}</button>
            <button onClick={save} className="rounded border px-3 py-1 text-sm" type="button">{t("common.save")}</button>
          </div>
        </div>
      </Modal>

      {/* Modal de sélection de langue pour la traduction */}
      <Modal open={openTranslateModal} onClose={()=>setOpenTranslateModal(false)} title={t("translate.selectLanguage")}>
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">{t("translate.selectLanguageDescription")}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => executeTranslation('fr')}
              className="rounded border px-4 py-3 text-sm hover:shadow hover:bg-zinc-50 flex flex-col items-center gap-2"
              type="button"
            >
              <span className="text-2xl">🇫🇷</span>
              <span className="font-medium">Français</span>
            </button>
            <button
              onClick={() => executeTranslation('en')}
              className="rounded border px-4 py-3 text-sm hover:shadow hover:bg-zinc-50 flex flex-col items-center gap-2"
              type="button"
            >
              <span className="text-2xl">🇬🇧</span>
              <span className="font-medium">English</span>
            </button>
          </div>
          <div className="flex justify-end">
            <button onClick={()=>setOpenTranslateModal(false)} className="rounded border px-3 py-1 text-sm" type="button">{t("common.cancel")}</button>
          </div>
        </div>
      </Modal>
    </header>
  );
}

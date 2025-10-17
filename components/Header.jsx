"use client";
import React from "react";
import Image from "next/image";
import SourceInfo from "./SourceInfo";
import MatchScore from "./MatchScore";
import CVImprovementPanel from "./CVImprovementPanel";
import { useAdmin } from "./admin/AdminProvider";
import useMutate from "./admin/useMutate";
import Modal from "./ui/Modal";
import FormRow from "./ui/FormRow";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useSettings } from "@/lib/settings/SettingsContext";
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { useNotifications } from "@/components/notifications/NotificationProvider";

export default function Header(props){
  const header = props.header || {};
  const links = (header.contact && header.contact.links) || [];
  const { editing } = useAdmin();
  const { mutate } = useMutate();
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const [open, setOpen] = React.useState(false);
  const [isTranslateDropdownOpen, setIsTranslateDropdownOpen] = React.useState(false);
  const [sourceInfo, setSourceInfo] = React.useState({ sourceType: null, sourceValue: null });
  const translateDropdownRef = React.useRef(null);
  const [matchScore, setMatchScore] = React.useState(null);
  const [matchScoreStatus, setMatchScoreStatus] = React.useState("idle");
  const [optimiseStatus, setOptimiseStatus] = React.useState("idle");
  const [isLoadingMatchScore, setIsLoadingMatchScore] = React.useState(false);
  const [canRefreshScore, setCanRefreshScore] = React.useState(true);
  const [refreshCount, setRefreshCount] = React.useState(0);
  const [hoursUntilReset, setHoursUntilReset] = React.useState(0);
  const [minutesUntilReset, setMinutesUntilReset] = React.useState(0);
  const [currentCvFile, setCurrentCvFile] = React.useState(null);
  const [hasExtractedJobOffer, setHasExtractedJobOffer] = React.useState(false);
  const [hasScoreBreakdown, setHasScoreBreakdown] = React.useState(false);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  // Calculer si le bouton Optimiser est disponible (visible ET actif)
  const isOptimizeButtonReady = React.useMemo(() => {
    return hasScoreBreakdown && matchScoreStatus !== 'inprogress';
  }, [hasScoreBreakdown, matchScoreStatus]);
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
    setIsLoadingMatchScore(true);
    try {
      // Récupérer le fichier CV actuel depuis le cookie
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (!cvFileCookie) {
        setIsLoadingMatchScore(false);
        return;
      }

      const currentFile = decodeURIComponent(cvFileCookie.split('=')[1]);
      setCurrentCvFile(currentFile);

      // Cache-busting pour iOS - ajouter un timestamp
      const cacheBuster = Date.now();
      const response = await fetch(`/api/cv/match-score?file=${encodeURIComponent(currentFile)}&_=${cacheBuster}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        // 404 = CV sans offre d'emploi (normal pour CV importés), ne pas logger d'erreur
        if (response.status === 404) {
        } else {
        }
        setIsLoadingMatchScore(false);
        return;
      }

      const data = await response.json();

      // Vérifier que le CV n'a pas changé entre temps
      const updatedCookies = document.cookie.split(';');
      const updatedCvFileCookie = updatedCookies.find(c => c.trim().startsWith('cvFile='));
      const updatedFile = updatedCvFileCookie ? decodeURIComponent(updatedCvFileCookie.split('=')[1]) : null;

      if (updatedFile === currentFile) {
        // Utiliser le status de la base en priorité
        // Workaround iOS : si pas de status en base et qu'on a un score, mettre 'idle'
        const finalStatus = data.status || (data.score !== null ? 'idle' : 'idle');
        const finalOptimiseStatus = data.optimiseStatus || 'idle';


        setMatchScore(data.score);
        setMatchScoreStatus(finalStatus);
        setOptimiseStatus(finalOptimiseStatus);
        setCanRefreshScore(data.canRefresh ?? true);
        setRefreshCount(data.refreshCount || 0);
        setHoursUntilReset(data.hoursUntilReset || 0);
        setMinutesUntilReset(data.minutesUntilReset || 0);
        setHasExtractedJobOffer(data.hasExtractedJobOffer || false);
        setHasScoreBreakdown(data.hasScoreBreakdown || false);

        // Force un re-render en utilisant un timeout (workaround iOS)
        setTimeout(() => {
          setIsLoadingMatchScore(false);
        }, 0);
      } else {
        setIsLoadingMatchScore(false);
      }
    } catch (error) {
      setIsLoadingMatchScore(false);
    }
  }, []);

  const fetchSourceInfo = React.useCallback(() => {
    // Récupérer le CV actuel depuis le cookie pour détecter les changements
    const cookies = document.cookie.split(';');
    const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
    const newCvFile = cvFileCookie ? decodeURIComponent(cvFileCookie.split('=')[1]) : null;

    // Activer l'état de transition pour éviter le flash visuel
    setIsTransitioning(true);

    // Mettre à jour seulement le CV actuel et le loading, garder les autres états temporairement
    setCurrentCvFile(newCvFile);
    setIsLoadingMatchScore(true);

    fetch("/api/cv/source", { cache: "no-store" })
      .then(res => {
        if (!res.ok) {
          return { sourceType: null, sourceValue: null, hasExtractedJobOffer: false };
        }
        return res.json();
      })
      .then(data => {
        // Mettre à jour les infos de source
        setSourceInfo({ sourceType: data.sourceType, sourceValue: data.sourceValue });

        // Ne récupérer le score que si le CV a une offre d'emploi extraite
        if (data.hasExtractedJobOffer) {
          fetchMatchScore();
        } else {
          // Réinitialiser les états du score seulement si pas d'offre
          setMatchScore(null);
          setMatchScoreStatus('idle');
          setOptimiseStatus('idle');
          setCanRefreshScore(true);
          setRefreshCount(0);
          setHoursUntilReset(0);
          setMinutesUntilReset(0);
          setHasExtractedJobOffer(false);
          setHasScoreBreakdown(false);
          setIsLoadingMatchScore(false);
        }

        // Fin de la transition après un court délai pour la fluidité
        setTimeout(() => setIsTransitioning(false), 100);
      })
      .catch(err => {
        setIsLoadingMatchScore(false);
        setIsTransitioning(false);
      });
  }, [fetchMatchScore]);

  React.useEffect(() => {
    fetchSourceInfo();
  }, [fetchSourceInfo]); // Fetch au montage

  // Écouter les événements de synchronisation temps réel
  React.useEffect(() => {
    const handleRealtimeCvUpdate = (event) => {
      fetchMatchScore();
    };

    // Écouter les changements de métadonnées (status, score, etc.)
    const handleRealtimeCvMetadataUpdate = (event) => {
      fetchMatchScore();
    };

    // WORKAROUND iOS: Forcer le refresh si MatchScore détecte une incohérence
    const handleForceRefresh = (event) => {
      fetchMatchScore();
    };

    // Écouter les changements de CV pour recharger les infos de source
    const handleCvSelected = (event) => {
      fetchSourceInfo();
    };

    // Écouter les mises à jour des tokens (depuis la search bar)
    const handleTokensUpdated = (event) => {
      fetchMatchScore();
    };

    window.addEventListener('realtime:cv:updated', handleRealtimeCvUpdate);
    window.addEventListener('realtime:cv:metadata:updated', handleRealtimeCvMetadataUpdate);
    window.addEventListener('matchscore:force-refresh', handleForceRefresh);
    window.addEventListener('cv:selected', handleCvSelected);
    window.addEventListener('tokens:updated', handleTokensUpdated);

    return () => {
      window.removeEventListener('realtime:cv:updated', handleRealtimeCvUpdate);
      window.removeEventListener('realtime:cv:metadata:updated', handleRealtimeCvMetadataUpdate);
      window.removeEventListener('matchscore:force-refresh', handleForceRefresh);
      window.removeEventListener('cv:selected', handleCvSelected);
      window.removeEventListener('tokens:updated', handleTokensUpdated);
    };
  }, [fetchMatchScore, fetchSourceInfo]);

  // Fermer le dropdown de traduction quand on clique à l'extérieur
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (translateDropdownRef.current && !translateDropdownRef.current.contains(event.target)) {
        setIsTranslateDropdownOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsTranslateDropdownOpen(false);
      }
    }

    if (isTranslateDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isTranslateDropdownOpen]);

  // Pas de SSE - l'utilisateur rafraîchira manuellement pour voir le résultat

  const handleRefreshMatchScore = React.useCallback(async () => {
    // Vérifier le rate limit avant de commencer
    if (!canRefreshScore) {
      addNotification({
        type: "error",
        message: t("matchScore.rateLimitExceeded", { hours: hoursUntilReset, minutes: minutesUntilReset }),
        duration: 5000,
      });
      return;
    }

    // Mise à jour optimiste : passer immédiatement le status en loading
    setMatchScoreStatus('inprogress');
    setIsLoadingMatchScore(true);

    try {
      // Récupérer le fichier CV actuel depuis le cookie
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (!cvFileCookie) {
        throw new Error("No CV file selected");
      }

      const currentFile = decodeURIComponent(cvFileCookie.split('=')[1]);

      // Envoyer la requête pour lancer le calcul
      const response = await fetch("/api/background-tasks/calculate-match-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cvFile: currentFile,
          isAutomatic: false,
          deviceId: localDeviceId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Gestion spéciale pour le rate limit
        if (response.status === 429) {
          setCanRefreshScore(false);
          const hours = data.hoursLeft || 24;
          const minutes = data.minutesLeft || 0;
          setHoursUntilReset(hours);
          setMinutesUntilReset(minutes);
          throw new Error(t("matchScore.rateLimitExceeded", { hours, minutes }));
        }

        const errorMessage = data.details || data.error || "Impossible de lancer le calcul.";
        throw new Error(errorMessage);
      }

      // Succès - émettre l'événement pour mettre à jour les compteurs de tokens
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tokens:updated'));
      }
    } catch (error) {

      // En cas d'erreur, réinitialiser le status
      setMatchScoreStatus('idle');
      setIsLoadingMatchScore(false);

      addNotification({
        type: "error",
        message: error.message,
        duration: 6000,
      });
    }
  }, [t, addNotification, canRefreshScore, hoursUntilReset, minutesUntilReset, localDeviceId]);

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

  async function executeTranslation(targetLanguage) {
    // Fermer le dropdown
    setIsTranslateDropdownOpen(false);
    // Récupérer le fichier CV actuel depuis le cookie ou localStorage
    let currentFile = null;
    try {
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (cvFileCookie) {
        currentFile = decodeURIComponent(cvFileCookie.split('=')[1]);
      }
    } catch (err) {
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

    // Notifier immédiatement
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
    <header className="page mb-6 flex items-start justify-between gap-4 bg-white/15 backdrop-blur-xl p-4 rounded-2xl shadow-2xl relative overflow-visible">
      <div className="pr-24">
        <h1 className="text-2xl font-bold text-white drop-shadow-lg">{header.full_name || ""}</h1>
        <p className="text-sm text-white/80 drop-shadow">{header.current_title || ""}</p>
        <div className="mt-2 text-sm text-white/90 drop-shadow">
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
                  className="underline decoration-dotted text-white/90 hover:text-white transition-colors duration-200"
                >
                  {l.label || l.url}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Boîte des boutons en haut à droite */}
      <div className={`no-print absolute top-2 right-2 z-30 transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
        <div className="relative w-20 h-20">
          {/* Icône info en haut à droite */}
          <div className="absolute top-0 right-0">
            <SourceInfo sourceType={sourceInfo.sourceType} sourceValue={sourceInfo.sourceValue} />
          </div>

          {/* Bouton Score au milieu à gauche */}
          <div className="absolute top-1/2 -left-1 -translate-y-1/2">
            <MatchScore
              sourceType={sourceInfo.sourceType}
              sourceValue={sourceInfo.sourceValue}
              score={matchScore}
              status={matchScoreStatus === 'inprogress' ? 'loading' : matchScoreStatus}
              isLoading={isLoadingMatchScore}
              canRefresh={canRefreshScore}
              refreshCount={refreshCount}
              hoursUntilReset={hoursUntilReset}
              minutesUntilReset={minutesUntilReset}
              onRefresh={handleRefreshMatchScore}
              currentCvFile={currentCvFile}
              hasExtractedJobOffer={hasExtractedJobOffer}
              isOptimizeButtonReady={isOptimizeButtonReady}
              optimiseStatus={optimiseStatus}
            />
          </div>

          {/* Bouton Optimiser en bas à droite */}
          {hasScoreBreakdown && currentCvFile && (
            <div className="absolute bottom-0 right-2">
              <CVImprovementPanel
                cvFile={currentCvFile}
                canRefresh={canRefreshScore}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bouton d'édition du header en mode édition */}
      {(editing && settings.feature_edit_mode) ? (
        <button
          onClick={()=>setOpen(true)}
          className="no-print absolute bottom-3 right-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-0.5 text-xs hover:bg-white/30 hover:shadow-xl transition-all duration-200"
          type="button"
        >
          <img src="/icons/edit.png" alt="Edit" className="h-3 w-3 " />
        </button>
      ) : null}

      {/* Bouton de traduction en bas à droite */}
      {(!editing && settings.feature_translate) ? (
        <div className="no-print absolute bottom-3 right-3 flex items-center gap-2">
          {/* Bouton de traduction avec dropdown */}
          <div
            ref={translateDropdownRef}
            className="relative"
          >
            {/* Options de langue - apparaissent à gauche du bouton quand ouvert */}
            <div
              className={`
                absolute right-full top-0 mr-2
                flex flex-row gap-2
                transition-all duration-300 ease-out origin-right
                ${isTranslateDropdownOpen ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-75 translate-x-2 pointer-events-none'}
              `}
            >
              {[
                { code: 'fr', flag: '/icons/fr.svg', label: 'Français' },
                { code: 'en', flag: '/icons/gb.svg', label: 'English' }
              ].map((lang, index) => (
                <button
                  key={lang.code}
                  onClick={() => executeTranslation(lang.code)}
                  className={`
                    w-8 h-8 rounded-full
                    bg-white/20 backdrop-blur-xl border-2 border-white/30 shadow-2xl
                    flex items-center justify-center
                    overflow-hidden
                    hover:shadow-xl hover:bg-white/30
                    transition-all duration-200
                    cursor-pointer
                    p-0.5
                  `}
                  style={{
                    transitionDelay: isTranslateDropdownOpen ? `${index * 50}ms` : '0ms'
                  }}
                  title={`Traduire en ${lang.label}`}
                  aria-label={`Traduire en ${lang.label}`}
                  type="button"
                >
                  <Image
                    src={lang.flag}
                    alt={lang.label}
                    width={24}
                    height={24}
                    className="object-cover"
                  />
                </button>
              ))}
            </div>

            {/* Bouton principal de traduction */}
            <button
              onClick={() => setIsTranslateDropdownOpen(!isTranslateDropdownOpen)}
              className={`
                w-8 h-8 rounded-full
                bg-white/20 backdrop-blur-xl border-2 border-white/30 shadow-2xl
                flex items-center justify-center
                hover:shadow-xl hover:bg-white/30
                transition-all duration-300
                cursor-pointer
                ${isTranslateDropdownOpen ? 'shadow-xl' : ''}
              `}
              title={t("translate.buttonTitle")}
              aria-label="Traduire le CV"
              aria-expanded={isTranslateDropdownOpen}
              type="button"
            >
              <img src="/icons/translate.png" alt="Translate" className="h-4 w-4 " />
            </button>
          </div>
        </div>
      ) : null}

      <Modal open={open} onClose={()=>setOpen(false)} title={t("header.modalTitle")}>
        <div className="grid gap-3 md:grid-cols-2">
          <FormRow label={t("header.fullName")}>
            <input className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 w-full focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none transition-all duration-200" value={f.full_name} onChange={e=>setF({...f,full_name:e.target.value})} />
          </FormRow>
          <FormRow label={t("header.currentTitle")}>
            <input className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 w-full focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none transition-all duration-200" value={f.current_title} onChange={e=>setF({...f,current_title:e.target.value})} />
          </FormRow>
          <FormRow label={t("header.email")}>
            <input className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 w-full focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none transition-all duration-200" value={f.email} onChange={e=>setF({...f,email:e.target.value})} />
          </FormRow>
          <FormRow label={t("header.phone")}>
            <input className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 w-full focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none transition-all duration-200" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} />
          </FormRow>

          <div className="md:col-span-2 grid grid-cols-3 gap-3">
            <FormRow label={t("header.city")}>
              <input className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 w-full focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none transition-all duration-200" value={f.city} onChange={e=>setF({...f,city:e.target.value})} />
            </FormRow>
            <FormRow label={t("header.region")}>
              <input className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 w-full focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none transition-all duration-200" value={f.region} onChange={e=>setF({...f,region:e.target.value})} />
            </FormRow>
            <FormRow label={t("header.countryCode")}>
              <input className="rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-3 py-2 text-sm text-white placeholder:text-white/50 w-full focus:bg-white/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none transition-all duration-200" value={f.country_code} onChange={e=>setF({...f,country_code:e.target.value})} />
            </FormRow>
          </div>

          {/* Liens */}
          <div className="md:col-span-2">
            <div className="text-xs font-medium mb-2 uppercase tracking-wide text-white drop-shadow">{t("header.links")}</div>
            <div className="space-y-2">
              {linksLocal.length === 0 && (
                <div className="rounded border border-white/40 bg-white/20 px-2 py-1 text-xs text-white/60">
                  {t("header.noLinks")}
                </div>
              )}
              {linksLocal.map((row, idx) => (
                <div key={idx} className="grid grid-cols-7 gap-2 items-center">
                  <input
                    className="col-span-2 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-sm text-white placeholder:text-white/50 focus:bg-white/30 focus:border-emerald-400 focus:outline-none transition-all duration-200"
                    placeholder={t("header.labelPlaceholder")}
                    value={row.label}
                    onChange={e=>{
                      const arr=[...linksLocal]; arr[idx]={...arr[idx], label:e.target.value}; setLinksLocal(arr);
                    }}
                  />
                  <input
                    className="col-span-4 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-sm text-white placeholder:text-white/50 focus:bg-white/30 focus:border-emerald-400 focus:outline-none transition-all duration-200"
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
                    className="text-xs rounded border-2 border-white/40 bg-white/20 backdrop-blur-sm px-2 py-1 text-white hover:bg-white/30 transition-all duration-200"
                    title={t("common.delete")}
                  >
                    <img src="/icons/delete.png" alt="Delete" className="h-3 w-3 " />
                  </button>
                </div>
              ))}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={()=>setLinksLocal([...(linksLocal||[]), {label:"", url:""}])}
                  className="px-2 py-1 text-xs font-medium text-white bg-white/20 border-2 border-white/40 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-all duration-200 inline-flex items-center gap-1"
                >
                  <img src="/icons/add.png" alt="" className="h-3 w-3 " /> {t("header.addLink")}
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <button onClick={()=>setOpen(false)} className="px-3 py-2 text-sm font-medium text-white bg-white/20 border-2 border-white/40 backdrop-blur-sm rounded-lg hover:bg-white/30 transition-all duration-200" type="button">{t("common.cancel")}</button>
            <button onClick={save} className="px-3 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-all duration-200" type="button">{t("common.save")}</button>
          </div>
        </div>
      </Modal>
    </header>
  );
}

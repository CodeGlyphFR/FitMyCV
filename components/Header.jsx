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
import { useBackgroundTasks } from "@/components/BackgroundTasksProvider";
import { useNotifications } from "@/components/notifications/NotificationProvider";

export default function Header(props){
  const header = props.header || {};
  const links = (header.contact && header.contact.links) || [];
  const { editing } = useAdmin();
  const { mutate } = useMutate();
  const { t, language } = useLanguage();
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
    console.log('[Header] 📥 fetchMatchScore appelé');
    setIsLoadingMatchScore(true);
    try {
      // Récupérer le fichier CV actuel depuis le cookie
      const cookies = document.cookie.split(';');
      const cvFileCookie = cookies.find(c => c.trim().startsWith('cvFile='));
      if (!cvFileCookie) {
        console.log('[Header] ⚠️ Pas de cookie cvFile');
        setIsLoadingMatchScore(false);
        return;
      }

      const currentFile = decodeURIComponent(cvFileCookie.split('=')[1]);
      setCurrentCvFile(currentFile);
      console.log('[Header] 📄 CV actuel:', currentFile);

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
          console.log('[Header] ℹ️ CV sans score de match (pas d\'offre d\'emploi associée)');
        } else {
          console.error('[Header] ❌ Échec fetch match score:', response.status);
        }
        setIsLoadingMatchScore(false);
        return;
      }

      const data = await response.json();
      console.log('[Header] 📊 Données reçues:', data);

      // Vérifier que le CV n'a pas changé entre temps
      const updatedCookies = document.cookie.split(';');
      const updatedCvFileCookie = updatedCookies.find(c => c.trim().startsWith('cvFile='));
      const updatedFile = updatedCvFileCookie ? decodeURIComponent(updatedCvFileCookie.split('=')[1]) : null;

      if (updatedFile === currentFile) {
        // Utiliser le status de la base en priorité
        // Workaround iOS : si pas de status en base et qu'on a un score, mettre 'idle'
        const finalStatus = data.status || (data.score !== null ? 'idle' : 'idle');
        const finalOptimiseStatus = data.optimiseStatus || 'idle';

        console.log('[Header] ✅ Mise à jour state - score:', data.score, 'status from API:', data.status, 'finalStatus:', finalStatus, 'optimiseStatus:', finalOptimiseStatus);

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
        console.log('[Header] ⚠️ CV changé pendant le fetch');
        setIsLoadingMatchScore(false);
      }
    } catch (error) {
      console.error('[Header] ❌ Erreur fetch match score:', error);
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
          console.log('[Header] ✅ CV avec offre d\'emploi, récupération du score...');
          fetchMatchScore();
        } else {
          console.log('[Header] ℹ️ CV sans offre d\'emploi extraite, pas de score disponible');
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
        console.error("Failed to fetch source info:", err);
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
      console.log('[Header] CV mis à jour en temps réel, rechargement...', event.detail);
      fetchMatchScore();
    };

    // Écouter les changements de métadonnées (status, score, etc.)
    const handleRealtimeCvMetadataUpdate = (event) => {
      console.log('[Header] 📊 Métadonnées CV mises à jour en temps réel:', event.detail);
      fetchMatchScore();
    };

    // WORKAROUND iOS: Forcer le refresh si MatchScore détecte une incohérence
    const handleForceRefresh = (event) => {
      console.log('[Header] 🔄 Force refresh demandé par MatchScore (iOS fix):', event.detail);
      fetchMatchScore();
    };

    // Écouter les changements de CV pour recharger les infos de source
    const handleCvSelected = (event) => {
      console.log('[Header] 📄 CV sélectionné, rechargement des infos...', event.detail);
      fetchSourceInfo();
    };

    window.addEventListener('realtime:cv:updated', handleRealtimeCvUpdate);
    window.addEventListener('realtime:cv:metadata:updated', handleRealtimeCvMetadataUpdate);
    window.addEventListener('matchscore:force-refresh', handleForceRefresh);
    window.addEventListener('cv:selected', handleCvSelected);

    return () => {
      window.removeEventListener('realtime:cv:updated', handleRealtimeCvUpdate);
      window.removeEventListener('realtime:cv:metadata:updated', handleRealtimeCvMetadataUpdate);
      window.removeEventListener('matchscore:force-refresh', handleForceRefresh);
      window.removeEventListener('cv:selected', handleCvSelected);
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
    console.log('[Header] 🔄 Début calcul score - mise à jour optimiste du status');
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

      // Succès - pas de notification
    } catch (error) {
      console.error("Error refreshing match score:", error);

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

      {/* Score et Info en haut à droite */}
      <div className={`flex items-start gap-4 transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
        {/* Container pour le bouton Optimiser + Score avec positionnement relatif */}
        <div className="relative">
          {/* Bouton Optimiser - uniquement si le CV a un scoreBreakdown */}
          {hasScoreBreakdown && currentCvFile && (
            <div className="absolute -bottom-6 -right-11 z-10">
              <CVImprovementPanel
                cvFile={currentCvFile}
                canRefresh={canRefreshScore}
              />
            </div>
          )}
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
        <SourceInfo sourceType={sourceInfo.sourceType} sourceValue={sourceInfo.sourceValue} />
      </div>

      {/* Bouton d'édition du header en mode édition */}
      {editing ? (
        <button
          onClick={()=>setOpen(true)}
          className="no-print absolute bottom-3 right-3 rounded border px-2 py-1 text-sm hover:shadow"
          type="button"
        >
          🖊️
        </button>
      ) : null}

      {/* Bouton de traduction en bas à droite */}
      {!editing ? (
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
                    bg-white shadow-lg border border-neutral-200
                    flex items-center justify-center
                    overflow-hidden
                    hover:shadow-xl
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
                bg-white shadow-lg border border-neutral-300
                inline-flex items-center justify-center
                hover:shadow-xl
                transition-all duration-200
                cursor-pointer
                text-sm leading-none
                ${isTranslateDropdownOpen ? 'shadow-xl' : ''}
              `}
              title={t("translate.buttonTitle")}
              aria-label="Traduire le CV"
              aria-expanded={isTranslateDropdownOpen}
              type="button"
            >
              <span className="block">🌐</span>
            </button>
          </div>
        </div>
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
                  className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  ➕ {t("header.addLink")}
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-2">
            <button onClick={()=>setOpen(false)} className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50" type="button">{t("common.cancel")}</button>
            <button onClick={save} className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700" type="button">{t("common.save")}</button>
          </div>
        </div>
      </Modal>
    </header>
  );
}

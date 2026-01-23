"use client";
import React from "react";
import SourceInfo from "@/components/cv-improvement/SourceInfo";
import MatchScore from "@/components/cv-improvement/MatchScore";
import CVImprovementPanel from "@/components/cv-improvement/CVImprovementPanel";
import { useAdmin } from "@/components/admin/AdminProvider";
import useMutate from "@/components/admin/useMutate";
import Modal from "@/components/ui/Modal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { getTranslatorForCvLanguage } from "@/lib/i18n/cvLanguageHelper";
import { useSettings } from "@/lib/settings/SettingsContext";
import ChangeHighlight from "@/components/cv-review/ChangeHighlight";
import { toTitleCase } from "@/lib/utils/textFormatting";
import { formatPhoneNumber } from "@/lib/utils/phoneFormatting";
import { useHighlight } from "@/components/providers/HighlightProvider";
import CountrySelect from "@/components/ui/CountrySelect";
import { User, Mail, MapPin, Link2, Plus, Trash2 } from "lucide-react";
import {
  ModalSection,
  FormField,
  Input,
  Grid,
  ModalFooter,
} from "@/components/ui/ModalForm";
import { useMatchScore, useSourceInfo, useTranslation, TranslationDropdown } from "@/components/header";

export default function Header(props){
  const header = props.header || {};
  const links = (header.contact && header.contact.links) || [];
  const { editing } = useAdmin();
  const { mutate } = useMutate();
  const { t } = useLanguage();
  const { settings } = useSettings();
  const cvT = getTranslatorForCvLanguage(props.cvLanguage || 'fr');
  const [open, setOpen] = React.useState(false);

  // Récupérer la version courante depuis le contexte
  const { currentVersion } = useHighlight();

  // Calculer isHistoricalVersion directement depuis currentVersion (plus fiable que l'API)
  const isHistoricalVersion = currentVersion !== 'latest';

  // Hook pour le score de matching
  const {
    matchScore,
    scoreBefore,
    matchScoreStatus,
    optimiseStatus,
    isLoadingMatchScore,
    currentCvFile,
    setCurrentCvFile,
    hasJobOffer,
    setHasJobOffer,
    hasScoreBreakdown,
    setHasScoreBreakdown,
    setMatchScore,
    setScoreBefore,
    setMatchScoreStatus,
    setOptimiseStatus,
    setIsLoadingMatchScore,
    fetchMatchScore,
    handleRefreshMatchScore,
  } = useMatchScore({ currentVersion });

  // Hook pour les infos de source
  const { sourceInfo, isTransitioning, fetchSourceInfo } = useSourceInfo({
    fetchMatchScore,
    setCurrentCvFile,
    setIsLoadingMatchScore,
    setMatchScore,
    setScoreBefore,
    setMatchScoreStatus,
    setOptimiseStatus,
    setHasJobOffer,
    setHasScoreBreakdown,
  });

  // Hook pour la traduction
  const {
    isTranslateDropdownOpen,
    setIsTranslateDropdownOpen,
    translateDropdownRef,
    executeTranslation,
  } = useTranslation();

  // Calculer si le bouton Optimiser est disponible (visible ET actif)
  const isOptimizeButtonReady = React.useMemo(() => {
    return hasScoreBreakdown && matchScoreStatus !== 'inprogress';
  }, [hasScoreBreakdown, matchScoreStatus]);

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

  // Fetch au montage
  React.useEffect(() => {
    fetchSourceInfo();
  }, [fetchSourceInfo]);

  // Refetch le score quand on change de version
  React.useEffect(() => {
    fetchMatchScore();
  }, [currentVersion, fetchMatchScore]);

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
    <header className="page mb-6 flex items-start justify-between gap-4 bg-white/15 backdrop-blur-xl p-4 rounded-2xl shadow-2xl relative overflow-visible min-h-[120px]">
      <div className="pr-24">
        <h1 className="text-2xl font-bold text-white drop-shadow-lg">{toTitleCase(header.full_name) || ""}</h1>
        <p className="text-sm text-white/80 drop-shadow">
          <ChangeHighlight section="header" field="current_title">
            {toTitleCase(header.current_title) || ""}
          </ChangeHighlight>
        </p>
        <div className="mt-2 text-sm text-white/90 drop-shadow">
          <div>{header.contact?.email || ""}</div>
          <div>{formatPhoneNumber(header.contact?.phone, header.contact?.location?.country_code)}</div>
          {header.contact?.location && (header.contact.location.city || header.contact.location.region || header.contact.location.country_code) ? (
            <div>
              {[
                header.contact.location.city,
                header.contact.location.region,
                header.contact.location.country_code ? (cvT(`countries.${header.contact.location.country_code}`) || header.contact.location.country_code) : null
              ].filter(Boolean).join(", ")}
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
            <SourceInfo
              sourceType={sourceInfo.sourceType}
              sourceValue={sourceInfo.sourceValue}
              jobOfferInfo={sourceInfo.jobOfferInfo}
              sourceCvInfo={sourceInfo.sourceCvInfo}
            />
          </div>

          {/* Bouton Score au milieu à gauche */}
          <div className="absolute top-1/2 -left-1 -translate-y-1/2">
            <MatchScore
              sourceType={sourceInfo.sourceType}
              sourceValue={sourceInfo.sourceValue}
              score={matchScore}
              scoreBefore={scoreBefore}
              status={matchScoreStatus === 'inprogress' ? 'loading' : matchScoreStatus}
              isLoading={isLoadingMatchScore}
              onRefresh={handleRefreshMatchScore}
              currentCvFile={currentCvFile}
              hasJobOffer={hasJobOffer}
              isOptimizeButtonReady={isOptimizeButtonReady}
              optimiseStatus={optimiseStatus}
              isHistoricalVersion={isHistoricalVersion}
            />
          </div>

          {/* Bouton Optimiser en bas à droite (masqué pour versions historiques) */}
          {hasScoreBreakdown && currentCvFile && !isHistoricalVersion && (
            <div className="absolute bottom-0 right-2">
              <CVImprovementPanel
                cvFile={currentCvFile}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bouton d'édition du header en mode édition */}
      {(editing && settings.feature_edit_mode) ? (
        <button
          data-onboarding="edit-button"
          onClick={()=>setOpen(true)}
          className="no-print absolute bottom-3 right-3 rounded-lg border border-white/40 bg-white/20 backdrop-blur-sm px-2 py-0.5 text-xs hover:bg-white/30 hover:shadow-sm-xl transition-all duration-200"
          type="button"
        >
          <img src="/icons/edit.png" alt="Edit" className="h-3 w-3 " />
        </button>
      ) : null}

      {/* Bouton de traduction en bas à droite */}
      {(!editing && settings.feature_translate) ? (
        <div className="no-print absolute bottom-3 right-3 flex items-center gap-2">
          <TranslationDropdown
            isOpen={isTranslateDropdownOpen}
            setIsOpen={setIsTranslateDropdownOpen}
            dropdownRef={translateDropdownRef}
            executeTranslation={executeTranslation}
            cvLanguage={props.cvLanguage}
          />
        </div>
      ) : null}

      <Modal open={open} onClose={()=>setOpen(false)} title={t("header.modalTitle")}>
        <div className="space-y-3">
          {/* Identité */}
          <ModalSection title={t("header.identity")} icon={User}>
            <Grid cols={2}>
              <FormField label={t("header.fullName")}>
                <Input
                  value={f.full_name}
                  onChange={e => setF({...f, full_name: e.target.value})}
                  placeholder={t("header.fullName")}
                />
              </FormField>
              <FormField label={t("header.currentTitle")}>
                <Input
                  value={f.current_title}
                  onChange={e => setF({...f, current_title: e.target.value})}
                  placeholder={t("header.currentTitle")}
                />
              </FormField>
            </Grid>
          </ModalSection>

          {/* Contact */}
          <ModalSection title={t("header.contact")} icon={Mail}>
            <Grid cols={2}>
              <FormField label={t("header.email")}>
                <Input
                  value={f.email}
                  onChange={e => setF({...f, email: e.target.value})}
                  placeholder={t("header.email")}
                />
              </FormField>
              <FormField label={t("header.phone")}>
                <Input
                  value={f.phone}
                  onChange={e => setF({...f, phone: e.target.value})}
                  placeholder={t("header.phone")}
                />
              </FormField>
            </Grid>
          </ModalSection>

          {/* Localisation */}
          <ModalSection title={t("header.location")} icon={MapPin}>
            <Grid cols={3}>
              <FormField label={t("cvSections.placeholders.city")}>
                <Input
                  placeholder={t("cvSections.placeholders.city")}
                  value={f.city}
                  onChange={e => setF({...f, city: e.target.value})}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.region")}>
                <Input
                  placeholder={t("cvSections.placeholders.region")}
                  value={f.region}
                  onChange={e => setF({...f, region: e.target.value})}
                />
              </FormField>
              <FormField label={t("cvSections.placeholders.selectCountry")}>
                <CountrySelect
                  className="w-full rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm text-white transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none"
                  placeholder={t("cvSections.placeholders.selectCountry")}
                  value={f.country_code}
                  onChange={v => setF({...f, country_code: v})}
                />
              </FormField>
            </Grid>
          </ModalSection>

          {/* Liens */}
          <ModalSection title={t("header.links")} icon={Link2}>
            <div className="space-y-2">
              {linksLocal.length === 0 && (
                <div className="rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-xs text-white/50">
                  {t("header.noLinks")}
                </div>
              )}
              {linksLocal.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    className="w-28 shrink-0 rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/40 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none"
                    placeholder={t("header.labelPlaceholder")}
                    value={row.label}
                    onChange={e => {
                      const arr = [...linksLocal];
                      arr[idx] = {...arr[idx], label: e.target.value};
                      setLinksLocal(arr);
                    }}
                  />
                  <input
                    className="flex-1 min-w-0 rounded-md border border-white/20 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/40 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none"
                    placeholder={t("header.urlPlaceholder")}
                    value={row.url}
                    onChange={e => {
                      const arr = [...linksLocal];
                      arr[idx] = {...arr[idx], url: e.target.value};
                      setLinksLocal(arr);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const arr = [...linksLocal];
                      arr.splice(idx, 1);
                      setLinksLocal(arr);
                    }}
                    className="flex items-center justify-center rounded-md border border-red-500/50 bg-red-500/20 p-1.5 text-red-400 hover:bg-red-500/30 transition-colors shrink-0"
                    title={t("common.delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLinksLocal([...(linksLocal || []), {label: "", url: ""}])}
                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {t("header.addLink")}
              </button>
            </div>
          </ModalSection>

          <ModalFooter
            onCancel={() => setOpen(false)}
            onSave={save}
            saveLabel={t("common.save")}
            cancelLabel={t("common.cancel")}
          />
        </div>
      </Modal>
    </header>
  );
}

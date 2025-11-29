"use client";

import React from "react";
import Modal from "@/components/ui/Modal";
import { ANALYSIS_OPTIONS } from "@/lib/i18n/cvLabels";
import { getCvIcon } from "../utils/cvUtils";
import DefaultCvIcon from "@/components/ui/DefaultCvIcon";
import ItemLabel from "../components/ItemLabel";
import { CREATE_TEMPLATE_OPTION } from "../utils/constants";
import { getPlanTier } from "@/lib/subscription/planUtils";

/**
 * Modal de génération de CV à partir d'une offre d'emploi
 */
export default function CvGeneratorModal({
  open,
  onClose,
  onSubmit,
  linkInputs,
  updateLink,
  addLinkField,
  removeLinkField,
  fileSelection,
  onFilesChanged,
  clearFiles,
  fileInputRef,
  generatorBaseFile,
  setGeneratorBaseFile,
  baseSelectorOpen,
  setBaseSelectorOpen,
  generatorSourceItems,
  generatorBaseItem,
  analysisLevel,
  setAnalysisLevel,
  currentAnalysisOption,
  generatorError,
  linkHistory,
  linkHistoryDropdowns,
  setLinkHistoryDropdowns,
  tickerResetKey,
  t,
  baseSelectorRef,
  baseDropdownRef,
  allowedAnalysisLevels = ['rapid', 'medium', 'deep'],
  plans = [],
}) {
  // Fonction pour déterminer quel badge afficher pour un niveau bloqué
  // en trouvant le plan avec le tier le plus bas qui autorise ce niveau
  const getLevelBadge = (levelId) => {
    // Si le niveau est autorisé, pas de badge
    if (allowedAnalysisLevels.includes(levelId)) {
      return null;
    }

    // Trouver tous les plans qui autorisent ce niveau
    const plansWithLevel = plans.filter(plan => {
      const featureLimit = plan.featureLimits?.find(
        limit => limit.featureName === 'gpt_cv_generation'
      );

      if (!featureLimit?.allowedAnalysisLevels) return false;

      try {
        const levels = JSON.parse(featureLimit.allowedAnalysisLevels);
        return levels.includes(levelId);
      } catch {
        return false;
      }
    });

    // Si aucun plan n'autorise ce niveau, ne pas afficher de badge
    if (plansWithLevel.length === 0) return null;

    // Trouver le plan avec le tier le plus bas
    const minTierPlan = plansWithLevel.reduce((min, plan) => {
      const planTier = getPlanTier(plan);
      const minTier = getPlanTier(min);
      return planTier < minTier ? plan : min;
    }, plansWithLevel[0]);

    // Retourner le nom du plan
    return minTierPlan.name;
  };

  // Handler pour le clic sur un niveau bloqué
  const handleBlockedLevelClick = () => {
    window.location.href = '/account/subscriptions';
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("cvGenerator.title")}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="text-sm text-white/90 drop-shadow">
          {t("cvGenerator.description")}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("cvGenerator.referenceCV")}</div>
          <div className="relative" ref={baseSelectorRef}>
            <button
              type="button"
              onClick={() => setBaseSelectorOpen((prev) => !prev)}
              className="w-full min-w-0 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm flex items-center justify-between gap-3 text-white transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
            >
              <span className="flex items-center gap-3 min-w-0 overflow-hidden">
                {generatorBaseFile === CREATE_TEMPLATE_OPTION ? (
                  <>
                    <span className="flex h-6 w-6 items-center justify-center shrink-0">
                      <span className="text-lg">✨</span>
                    </span>
                    <span className="font-medium text-emerald-300">
                      {t("cvGenerator.createTemplateOption")}
                    </span>
                  </>
                ) : generatorBaseItem ? (
                  <>
                    <span
                      key={`gen-base-icon-${generatorBaseFile}-${generatorBaseItem.createdBy}`}
                      className="flex h-6 w-6 items-center justify-center shrink-0"
                    >
                      {getCvIcon(generatorBaseItem.createdBy, generatorBaseItem.originalCreatedBy, "h-4 w-4") || <DefaultCvIcon className="h-4 w-4" size={16} />}
                    </span>
                    <span className="min-w-0">
                      <ItemLabel
                        item={generatorBaseItem}
                        withHyphen={false}
                        tickerKey={tickerResetKey}
                        t={t}
                      />
                    </span>
                  </>
                ) : (
                  <span className="truncate italic text-neutral-500">
                    {t("cvGenerator.selectCV")}
                  </span>
                )}
              </span>
              <span className="text-xs opacity-60">▾</span>
            </button>
            {baseSelectorOpen ? (
              <div
                ref={baseDropdownRef}
                className="absolute z-10 mt-1 w-full rounded-lg border-2 border-white/30 bg-slate-900/95 backdrop-blur-3xl shadow-2xl max-h-60 overflow-y-auto"
                style={{ backdropFilter: 'blur(40px)' }}
              >
                <ul className="py-1">
                  <li key={CREATE_TEMPLATE_OPTION}>
                    <button
                      type="button"
                      onClick={() => {
                        setGeneratorBaseFile(CREATE_TEMPLATE_OPTION);
                        setBaseSelectorOpen(false);
                      }}
                      className={`w-full px-3 py-1 text-left text-sm flex items-center gap-3 text-white transition-colors duration-200 hover:bg-white/25 ${CREATE_TEMPLATE_OPTION === generatorBaseFile ? "bg-white/20" : ""}`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center shrink-0">
                        <span className="text-lg">✨</span>
                      </span>
                      <span className="font-medium text-emerald-300">
                        {t("cvGenerator.createTemplateOption")}
                      </span>
                    </button>
                  </li>
                  {generatorSourceItems.length > 0 && (
                    <li className="my-1 border-t border-white/20"></li>
                  )}
                  {generatorSourceItems.map((item) => (
                    <li key={item.file}>
                      <button
                        type="button"
                        onClick={() => {
                          setGeneratorBaseFile(item.file);
                          setBaseSelectorOpen(false);
                        }}
                        className={`w-full px-3 py-1 text-left text-sm flex items-center gap-3 text-white transition-colors duration-200 hover:bg-white/25 ${item.file === generatorBaseFile ? "bg-white/20" : ""}`}
                      >
                        <span
                          key={`gen-dropdown-icon-${item.file}-${item.createdBy}`}
                          className="flex h-6 w-6 items-center justify-center shrink-0"
                        >
                          {getCvIcon(item.createdBy, item.originalCreatedBy, "h-4 w-4") || <DefaultCvIcon className="h-4 w-4" size={16} />}
                        </span>
                        <ItemLabel
                          item={item}
                          className="leading-tight"
                          withHyphen={false}
                          tickerKey={tickerResetKey}
                          t={t}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("cvGenerator.links")}</div>
          {linkInputs.map((value, index) => (
            <div key={index} className="flex gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setLinkHistoryDropdowns(prev => ({
                      ...prev,
                      [index]: !prev[index]
                    }));
                  }}
                  className="h-full rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200 disabled:opacity-50"
                  title={t("cvGenerator.loadRecentLink")}
                  disabled={linkHistory.length === 0}
                >
                  📋
                </button>
                {linkHistoryDropdowns[index] && linkHistory.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 w-80 max-h-60 overflow-y-auto bg-slate-900/95 backdrop-blur-3xl border-2 border-white/30 rounded-lg shadow-2xl z-10" style={{ backdropFilter: 'blur(40px)' }}>
                    <div className="p-2 border-b border-white/20 bg-white/10 text-xs font-medium text-white drop-shadow">
                      {t("cvGenerator.recentLinks")}
                    </div>
                    <ul className="py-1">
                      {linkHistory.map((link, histIndex) => (
                        <li key={histIndex}>
                          <button
                            type="button"
                            onClick={() => {
                              updateLink(link, index);
                              setLinkHistoryDropdowns(prev => ({
                                ...prev,
                                [index]: false
                              }));
                            }}
                            className="w-full px-3 py-2 text-left text-xs text-white hover:bg-white/25 truncate transition-colors duration-200"
                            title={link}
                          >
                            {link}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <input
                className="flex-1 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/50 transition-all duration-200 hover:bg-white/10 hover:border-white/30 focus:bg-white/10 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none"
                placeholder="https://..."
                value={value}
                onChange={(event) => updateLink(event.target.value, index)}
              />
              <button
                type="button"
                onClick={() => removeLinkField(index)}
                className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200"
                title={t("topbar.delete")}
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addLinkField}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200 inline-flex items-center gap-1"
            >
              <img src="/icons/add.png" alt="" className="h-3 w-3 " /> {t("cvGenerator.addLink")}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("cvGenerator.files")}</div>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept=".pdf,.doc,.docx"
            multiple
            onChange={onFilesChanged}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-sm text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="font-medium">
              {(fileSelection || []).length > 0 ? `${(fileSelection || []).length} fichier${(fileSelection || []).length > 1 ? 's' : ''} sélectionné${(fileSelection || []).length > 1 ? 's' : ''}` : t("pdfImport.selectFile")}
            </span>
          </button>
          {(fileSelection || []).length ? (
            <div className="rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-2 text-xs space-y-1">
              <div className="font-medium text-white drop-shadow flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {t("cvGenerator.selection")}
              </div>
              {(fileSelection || []).map((file, idx) => (
                <div key={idx} className="truncate text-white/90">
                  {file.name}
                </div>
              ))}
              <button
                type="button"
                onClick={clearFiles}
                className="mt-1 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200"
              >
                {t("cvGenerator.clearFiles")}
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-white drop-shadow">{t("cvGenerator.analysisQuality")}</div>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/20 bg-white/5 p-1 text-xs sm:text-sm">
            {ANALYSIS_OPTIONS(t).map((option) => {
              const active = option.id === analysisLevel;
              const isAllowed = allowedAnalysisLevels.includes(option.id);
              const badge = getLevelBadge(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    if (isAllowed) {
                      setAnalysisLevel(option.id);
                    } else {
                      handleBlockedLevelClick();
                    }
                  }}
                  className={`
                    rounded-md px-2 py-1 font-medium transition-all duration-200 relative
                    ${active && isAllowed ? "bg-emerald-400 text-white shadow" : ""}
                    ${!active && isAllowed ? "text-white/80 hover:bg-white/20" : ""}
                    ${!isAllowed ? "text-white/80 hover:bg-white/20 hover:ring-2 hover:ring-white/30" : ""}
                  `}
                  aria-pressed={active && isAllowed}
                >
                  {option.label}
                  {badge && (
                    <span className={`
                      absolute -top-1 -right-1
                      text-[9px] px-1.5 py-0.5 rounded-full font-semibold
                      shadow-lg
                      ${badge === 'Premium' || badge.toLowerCase().includes('premium') ? 'bg-gradient-to-r from-purple-500 to-violet-600 border border-purple-300 text-white' : ''}
                      ${badge === 'Pro' || badge.toLowerCase().includes('pro') ? 'bg-gradient-to-r from-blue-500 to-cyan-600 border border-blue-300 text-white' : ''}
                      ${!badge.toLowerCase().includes('premium') && !badge.toLowerCase().includes('pro') ? 'bg-gradient-to-r from-blue-500 to-cyan-600 border border-blue-300 text-white' : ''}
                    `}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-white/70 drop-shadow">
            {currentAnalysisOption.hint}
          </p>
        </div>

        {generatorError ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {generatorError}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            {t("cvGenerator.cancel")}
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            disabled={!generatorBaseFile}
          >
            {t("cvGenerator.validate")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

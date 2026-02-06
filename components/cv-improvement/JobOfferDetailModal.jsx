"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  X,
  Briefcase,
  Building2,
  MapPin,
  Globe,
  Clock,
  Banknote,
  GraduationCap,
  Languages,
  Target,
  Gift,
  ExternalLink,
  ListOrdered
} from "lucide-react";

// Map des drapeaux par code langue
const languageFlags = {
  fr: "/icons/fr.svg",
  en: "/icons/gb.svg",
  es: "/icons/es.svg",
  de: "/icons/de.svg",
};

/**
 * Modal affichant les détails complets d'une offre d'emploi
 * Design cohérent avec CVImprovementPanel
 */
export default function JobOfferDetailModal({
  isOpen,
  onClose,
  jobOffer,
  isLoading
}) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [isAnimationReady, setIsAnimationReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsAnimationReady(false);
      const timer = setTimeout(() => setIsAnimationReady(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsAnimationReady(false);
    }
  }, [isOpen]);

  // Fermeture avec Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const content = jobOffer?.content || {};
  const hasUrl = jobOffer?.sourceType === "url" && jobOffer?.sourceValue;

  // Helper pour capitaliser la première lettre
  const capitalize = (str) => {
    if (!str || typeof str !== 'string') return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Helpers pour formater les données
  const formatSalary = () => {
    const salary = content.salary;
    if (!salary) return null;
    const min = salary.min?.toLocaleString() || "";
    const max = salary.max?.toLocaleString() || "";
    const currency = salary.currency || "EUR";
    const period = salary.period || "year";

    const currencySymbol = currency === "EUR" ? "€" : currency;
    const periodLabel = t(`jobOffer.periods.${period}`) || period;

    if (min && max) {
      return `${min} - ${max} ${currencySymbol} / ${periodLabel}`;
    } else if (min) {
      return `${t("jobOffer.from")} ${min} ${currencySymbol} / ${periodLabel}`;
    } else if (max) {
      return `${t("jobOffer.upTo")} ${max} ${currencySymbol} / ${periodLabel}`;
    }
    return null;
  };

  const formatExperience = () => {
    const exp = content.experience;
    if (!exp) return null;
    if (exp.min_years && exp.max_years) {
      return `${exp.min_years}-${exp.max_years} ${t("jobOffer.years")}`;
    } else if (exp.min_years) {
      return `${exp.min_years}+ ${t("jobOffer.years")}`;
    } else if (exp.level) {
      return exp.level;
    }
    return null;
  };

  const formatRemote = () => {
    const remote = content.location?.remote;
    if (!remote) return null;
    const remoteLabels = {
      full: t("jobOffer.remote.full"),
      hybrid: t("jobOffer.remote.hybrid"),
      onsite: t("jobOffer.remote.onsite"),
      partial: t("jobOffer.remote.partial"),
    };
    return remoteLabels[remote] || remote;
  };

  const salary = formatSalary();
  const experience = formatExperience();
  const remote = formatRemote();
  const education = content.education?.level || content.education?.field;
  const languages = content.languages || [];
  const responsibilities = content.responsibilities || [];
  const benefits = content.benefits || [];
  // Tri alphabétique des compétences (insensible à la casse)
  const sortAlpha = (arr) => [...arr].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const skills = content.skills || {};

  // Nouveau format avec 4 catégories
  const hardSkillsRequired = sortAlpha(skills.hard_skills?.required || []);
  const hardSkillsNice = sortAlpha(skills.hard_skills?.nice_to_have || []);
  const toolsRequired = sortAlpha(skills.tools?.required || []);
  const toolsNice = sortAlpha(skills.tools?.nice_to_have || []);
  const methodologiesRequired = sortAlpha(skills.methodologies?.required || []);
  const methodologiesNice = sortAlpha(skills.methodologies?.nice_to_have || []);
  const softSkills = sortAlpha(skills.soft_skills || []);

  // Vérifier s'il y a des compétences dans chaque catégorie
  const hasHardSkills = hardSkillsRequired.length > 0 || hardSkillsNice.length > 0;
  const hasTools = toolsRequired.length > 0 || toolsNice.length > 0;
  const hasMethodologies = methodologiesRequired.length > 0 || methodologiesNice.length > 0;
  const hasSoftSkills = softSkills.length > 0;
  const hasAnySkills = hasHardSkills || hasTools || hasMethodologies || hasSoftSkills;

  const recruitmentProcess = content.recruitment_process || null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-offer-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="relative z-10 w-full max-w-2xl bg-[rgb(2,6,23)] rounded-xl border border-white/20 shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <style jsx>{`
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
          .animate-scale-in { animation: scaleIn 0.3s ease-out forwards; }
        `}</style>

        {/* Header */}
        <div className="flex-shrink-0">
          <div className="flex items-start justify-between p-4 md:p-6 gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 id="job-offer-modal-title" className="text-lg font-bold text-white truncate">
                    {content.title || t("jobOffer.untitled")}
                  </h2>
                  {content.language && languageFlags[content.language] && (
                    <Image
                      src={languageFlags[content.language]}
                      alt={content.language.toUpperCase()}
                      width={20}
                      height={20}
                      className="flex-shrink-0"
                    />
                  )}
                </div>
                {content.company && (
                  <p className="text-sm text-white/60 mt-0.5">
                    <span className="text-white/40">{t("jobOffer.company")} :</span> {content.company}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0"
              aria-label={t("common.close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="border-b border-white/10" />
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 custom-scrollbar"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        >
          <div className={`space-y-5 transition-all duration-300 ${!isAnimationReady && !isLoading ? 'blur-sm opacity-0' : 'blur-0 opacity-100'}`}>
            {isLoading && (
              <div className="text-center py-12 text-white/70 text-sm">
                <div className="inline-block w-8 h-8 border-4 border-white/30 border-t-emerald-500 rounded-full animate-spin mb-3" />
                <div>{t("common.loading")}</div>
              </div>
            )}

            {!isLoading && jobOffer && (
              <>
                {/* Métadonnées (chips) */}
                <div className="flex flex-wrap gap-2">
                  {content.company && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm">
                      <Building2 className="w-3.5 h-3.5" />
                      {content.company}
                    </span>
                  )}
                  {content.location?.city && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm">
                      <MapPin className="w-3.5 h-3.5" />
                      {content.location.city}{content.location.country ? `, ${content.location.country}` : ""}
                    </span>
                  )}
                  {remote && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm">
                      <Globe className="w-3.5 h-3.5" />
                      {remote}
                    </span>
                  )}
                  {content.contract && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/80 text-sm">
                      <Clock className="w-3.5 h-3.5" />
                      {content.contract}
                    </span>
                  )}
                </div>

                {/* Salaire */}
                {salary && (
                  <div className="rounded-xl p-4 bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-2 text-emerald-300">
                      <Banknote className="w-5 h-5" />
                      <span className="font-semibold text-lg">{salary}</span>
                    </div>
                  </div>
                )}

                {/* Grid: Avantages + Compétences/Exigences */}
                {(benefits.length > 0 || hasAnySkills || experience || education || languages.length > 0) && (
                  <div className={`grid grid-cols-1 gap-4 ${benefits.length > 0 ? 'lg:grid-cols-2' : ''}`}>
                    {/* Avantages */}
                    {benefits.length > 0 && (
                      <div className="rounded-xl p-4 bg-green-500/5 border border-green-500/20">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3 flex items-center gap-2">
                          <Gift className="w-4 h-4" />
                          {t("jobOffer.benefits")}
                        </h3>
                        <ul className="space-y-2 text-sm text-white/70">
                          {benefits.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <span>{capitalize(item)}{idx === benefits.length - 1 ? '.' : ','}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Compétences + Exigences fusionnées */}
                    {(hasAnySkills || experience || education || languages.length > 0) && (
                      <div className="rounded-xl p-4 bg-white/5 border border-white/10">
                        {/* Compétences par catégorie */}
                        {hasAnySkills && (
                          <>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3 flex items-center gap-2">
                              <GraduationCap className="w-4 h-4" />
                              {t("jobOffer.skills")}
                            </h3>
                            <div className="space-y-3">
                              {/* Compétences techniques (hard_skills) */}
                              {hasHardSkills && (
                                <div>
                                  <span className="text-xs text-white/50 block mb-1.5">{t("jobOffer.hardSkills")}</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {hardSkillsRequired.map((skill, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                                      >
                                        {capitalize(skill)}
                                      </span>
                                    ))}
                                    {hardSkillsNice.map((skill, idx) => (
                                      <span
                                        key={`nice-${idx}`}
                                        className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300"
                                      >
                                        {capitalize(skill)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Outils & Technologies */}
                              {hasTools && (
                                <div>
                                  <span className="text-xs text-white/50 block mb-1.5">{t("jobOffer.tools")}</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {toolsRequired.map((skill, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300"
                                      >
                                        {capitalize(skill)}
                                      </span>
                                    ))}
                                    {toolsNice.map((skill, idx) => (
                                      <span
                                        key={`nice-${idx}`}
                                        className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300"
                                      >
                                        {capitalize(skill)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Méthodologies */}
                              {hasMethodologies && (
                                <div>
                                  <span className="text-xs text-white/50 block mb-1.5">{t("jobOffer.methodologies")}</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {methodologiesRequired.map((skill, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300"
                                      >
                                        {capitalize(skill)}
                                      </span>
                                    ))}
                                    {methodologiesNice.map((skill, idx) => (
                                      <span
                                        key={`nice-${idx}`}
                                        className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300"
                                      >
                                        {capitalize(skill)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Soft Skills */}
                              {hasSoftSkills && (
                                <div>
                                  <span className="text-xs text-white/50 block mb-1.5">{t("jobOffer.softSkills")}</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {softSkills.map((skill, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300"
                                      >
                                        {capitalize(skill)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* Séparateur si les deux sections existent */}
                        {hasAnySkills && (experience || education || languages.length > 0) && (
                          <div className="border-t border-white/10 my-4" />
                        )}

                        {/* Exigences */}
                        {(experience || education || languages.length > 0) && (
                          <>
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3 flex items-center gap-2">
                              <Target className="w-4 h-4" />
                              {t("jobOffer.requirements")}
                            </h3>
                            <div className="space-y-2 text-sm text-white/70">
                              {experience && (
                                <div className="flex items-center gap-2">
                                  <span className="text-white/50">{t("jobOffer.experience")}:</span>
                                  <span className="text-white">{experience}</span>
                                </div>
                              )}
                              {education && (
                                <div className="flex items-center gap-2">
                                  <span className="text-white/50">{t("jobOffer.education")}:</span>
                                  <span className="text-white">{education}</span>
                                </div>
                              )}
                              {languages.length > 0 && (
                                <div className="flex items-start gap-2">
                                  <span className="text-white/50">{t("jobOffer.languages")}:</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {languages.map((lang, idx) => {
                                      const isNiceToHave = lang.requirement === 'nice_to_have';
                                      return (
                                        <span
                                          key={idx}
                                          className={`px-2 py-0.5 text-xs rounded-full ${
                                            isNiceToHave
                                              ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300'
                                              : 'bg-amber-500/20 border border-amber-500/30 text-amber-300'
                                          }`}
                                          title={isNiceToHave ? t("jobOffer.languageNiceToHave") : t("jobOffer.languageRequired")}
                                        >
                                          {capitalize(lang.language)}{lang.level ? ` (${capitalize(lang.level)})` : ""}
                                          {isNiceToHave && ' ✦'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Missions (pleine largeur) */}
                {responsibilities.length > 0 && (
                  <div className="rounded-xl p-4 bg-white/5 border border-white/10">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      {t("jobOffer.responsibilities")}
                    </h3>
                    <ul className="space-y-2 text-sm text-white/70">
                      {responsibilities.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5 text-xs">•</span>
                          <span>{capitalize(item)}{idx === responsibilities.length - 1 ? '.' : ','}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Processus de recrutement - Workflow */}
                {recruitmentProcess && (recruitmentProcess.steps?.length > 0 || recruitmentProcess.contact || recruitmentProcess.deadline || recruitmentProcess.duration) && (
                  <div className="rounded-xl p-4 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-indigo-500/10 border border-indigo-500/20">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-4 flex items-center gap-2">
                      <ListOrdered className="w-4 h-4" />
                      {t("jobOffer.recruitmentProcess.title")}
                    </h3>

                    {/* Métadonnées du processus en chips */}
                    {(recruitmentProcess.contact || recruitmentProcess.deadline || recruitmentProcess.duration) && (
                      <div className="flex flex-wrap gap-2 mb-5">
                        {recruitmentProcess.duration && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs">
                            <Clock className="w-3 h-3" />
                            {recruitmentProcess.duration}
                          </span>
                        )}
                        {recruitmentProcess.deadline && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs">
                            <Target className="w-3 h-3" />
                            {recruitmentProcess.deadline}
                          </span>
                        )}
                        {recruitmentProcess.contact && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs">
                            {recruitmentProcess.contact}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Timeline des étapes */}
                    {recruitmentProcess.steps?.length > 0 && (
                      <div className="relative">
                        {/* Ligne de connexion verticale */}
                        <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-gradient-to-b from-indigo-500/50 via-purple-500/50 to-indigo-500/30 rounded-full" />

                        <ol className="space-y-0">
                          {recruitmentProcess.steps.map((step, idx) => {
                            const isFirst = idx === 0;
                            const isLast = idx === recruitmentProcess.steps.length - 1;
                            const progress = recruitmentProcess.steps.length > 1
                              ? idx / (recruitmentProcess.steps.length - 1)
                              : 0;

                            return (
                              <li key={idx} className="relative flex items-start gap-4 pb-4 last:pb-0">
                                {/* Cercle numéroté avec dégradé progressif */}
                                <div
                                  className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-lg"
                                  style={{
                                    background: `hsl(${240 + progress * 30}, 70%, ${55 - progress * 10}%)`,
                                    boxShadow: `0 4px 12px hsla(${240 + progress * 30}, 70%, 50%, 0.3)`
                                  }}
                                >
                                  {idx + 1}
                                </div>

                                {/* Contenu de l'étape */}
                                <div
                                  className="flex-1 pt-0.5 text-sm"
                                  style={{
                                    color: `hsla(0, 0%, 100%, ${1 - progress * 0.3})`
                                  }}
                                >
                                  {capitalize(step)}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                {/* Lien vers l'offre originale */}
                {hasUrl && (
                  <>
                    <div className="border-t border-white/10" />
                    <a
                      href={jobOffer.sourceValue}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t("jobOffer.viewOriginal")}
                    </a>
                  </>
                )}
              </>
            )}

            {/* Message si pas de données */}
            {!isLoading && !jobOffer && (
              <div className="text-center py-12">
                <div className="text-white/40 text-5xl mb-4">📋</div>
                <div className="text-white/70 text-sm font-medium">{t("jobOffer.noData")}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

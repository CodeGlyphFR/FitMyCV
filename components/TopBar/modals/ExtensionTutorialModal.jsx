'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Check } from 'lucide-react';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { EXTENSION_STORE, BROWSER_ICONS, detectBrowser } from '@/lib/constants/extensionStore';

/**
 * Styles d'animation injectés une seule fois dans le <head>
 */
const ANIMATION_STYLES = `
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }
    50% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.8), 0 0 40px rgba(16, 185, 129, 0.3); }
  }
  @keyframes dotPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

/** Design tokens fidèles au popup extension (popup.css) */
const EXT = {
  bg: 'rgb(2, 6, 23)',
  surface: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.15)',
  emerald500: '#10b981',
  emerald400: '#34d399',
  amber400: '#fbbf24',
  textPrimary: 'rgba(255, 255, 255, 0.95)',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textTertiary: 'rgba(255, 255, 255, 0.4)',
  radiusSm: '6px',
};

/** Durée de chaque sous-étape en ms */
const STEP_DURATIONS = [2500, 1500, 2500, 2500, 2000];
const TOTAL_STEPS = STEP_DURATIONS.length;

/**
 * Mockup navigateur pleine largeur avec popup extension en overlay.
 *
 * 5 sous-étapes en boucle (~11s) :
 *   0 — Page d'emploi, bouton FitMyCV+ glow
 *   1 — Bouton cliqué → "✓ Ajouté"
 *   2 — Popup apparaît (offer list + "Générer 1 CV")
 *   3 — Popup → progress view "En cours…"
 *   4 — Progress → "Terminé"
 */
function ExtensionWorkflowMockup({ t }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setTimeout(
      () => setStep((prev) => (prev + 1) % TOTAL_STEPS),
      STEP_DURATIONS[step],
    );
    return () => clearTimeout(timer);
  }, [step]);

  // Phase pour la barre de progression (3 segments)
  const phase = step <= 1 ? 0 : step === 2 ? 1 : 2;
  const showPopup = step >= 2;

  return (
    // Negative margins to reclaim parent padding → full-bleed browser mockup
    <div className="-mx-4 md:-mx-6 space-y-3">
      {/* Barre de progression 3 segments */}
      <div className="flex gap-1 px-4 md:px-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                i <= phase ? 'bg-emerald-500 w-full' : 'w-0'
              }`}
            />
          </div>
        ))}
      </div>

      {/* ═══ Browser frame ═══ */}
      <div
        className="rounded-lg md:rounded-xl overflow-hidden mx-2 md:mx-4"
        style={{ border: `1px solid ${EXT.border}`, background: EXT.bg }}
      >
        {/* ─── Title bar : onglet + barre adresse + icône extension ─── */}
        <div style={{ background: 'rgba(255,255,255,0.03)', borderBottom: `1px solid ${EXT.border}` }}>
          {/* Tab bar */}
          <div className="flex items-center px-2 pt-1.5 gap-1">
            <div className="flex gap-1 mr-2 pl-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
            </div>
            {/* Active tab */}
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-t-md max-w-[200px]"
              style={{ background: EXT.bg, borderTop: `2px solid ${EXT.emerald500}` }}
            >
              <div className="w-3 h-3 rounded-sm bg-[#2164f3] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-[5px] font-bold">in</span>
              </div>
              <span className="truncate" style={{ color: EXT.textSecondary, fontSize: '10px' }}>
                Dev Full Stack (H/F) - Indeed
              </span>
            </div>
          </div>
          {/* Address bar + extension icon */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div
              className="flex-1 rounded-full px-3 py-0.5 font-mono truncate"
              style={{ background: 'rgba(255,255,255,0.08)', color: EXT.textTertiary, fontSize: '10px' }}
            >
              indeed.fr/viewjob?jk=8f2e4a...
            </div>
            {/* Extension icon (puzzle area) */}
            <div className="flex items-center gap-1.5">
              <div
                className="rounded-sm p-0.5 transition-all duration-300"
                style={{
                  background: showPopup ? 'rgba(16,185,129,0.15)' : 'transparent',
                  border: showPopup ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                }}
              >
                <img
                  src="/icons/extension-brain.png"
                  alt=""
                  className="w-4 h-4 rounded-sm transition-opacity duration-300"
                  style={{ opacity: showPopup ? 1 : 0.5 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Page content + popup overlay ─── */}
        <div className="relative" style={{ minHeight: '230px' }}>
          {/* Job page */}
          <div
            className="p-4 transition-opacity duration-500"
            style={{ opacity: showPopup ? 0.35 : 1 }}
          >
            {/* Indeed branding */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-[#2164f3] flex items-center justify-center">
                <span className="text-white text-[9px] font-bold">in</span>
              </div>
              <span style={{ color: EXT.textSecondary, fontSize: '12px', fontWeight: 500 }}>Indeed</span>
            </div>

            <h3 style={{ color: EXT.textPrimary, fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
              Développeur Full Stack (H/F)
            </h3>
            <p style={{ color: EXT.textTertiary, fontSize: '11px', marginBottom: '10px' }}>
              Paris &middot; CDI &middot; 45-55k&euro;
            </p>

            {/* Bouton FitMyCV+ — style fidèle à detector.js */}
            <div
              className="inline-flex items-center gap-1.5"
              style={{
                background: step >= 1 ? '#059669' : EXT.emerald500,
                color: '#fff',
                borderRadius: '9999px',
                padding: '5px 12px',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                cursor: 'default',
                transition: 'background 0.3s, transform 0.2s',
                animation: step === 0 ? 'glow 2s ease-in-out infinite' : 'none',
                transform: step === 1 ? 'scale(0.95)' : 'scale(1)',
              }}
            >
              {step >= 1 ? '✓ Ajouté' : 'FitMyCV +'}
            </div>

            {/* Description excerpt */}
            <div style={{ borderTop: `1px solid ${EXT.border}`, paddingTop: '8px', marginTop: '12px' }}>
              <p style={{ color: EXT.textTertiary, fontSize: '10px', fontWeight: 500, marginBottom: '4px' }}>
                Missions :
              </p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>
                &bull; Développer des features React / Node.js
              </p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>
                &bull; Participer aux code reviews et à l&apos;architecture
              </p>
              <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '10px' }}>
                &bull; Optimiser les performances et la scalabilité
              </p>
            </div>
          </div>

          {/* ─── Extension popup overlay (drop-down from icon) ─── */}
          <div
            className="absolute right-3 top-1"
            style={{
              opacity: showPopup ? 1 : 0,
              transform: showPopup ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.95)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              pointerEvents: 'none',
              transformOrigin: 'top right',
            }}
          >
            <div
              className="w-[190px] md:w-[210px] rounded-lg overflow-hidden"
              style={{
                border: '1px solid rgba(255,255,255,0.2)',
                background: EXT.bg,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              {/* Popup header */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5"
                style={{ borderBottom: `1px solid ${EXT.border}`, background: 'rgba(255,255,255,0.03)' }}
              >
                <img src="/icons/extension-brain.png" alt="" className="w-3.5 h-3.5 rounded-sm" />
                <span style={{ color: EXT.textPrimary, fontSize: '11px', fontWeight: 600 }}>FitMyCV</span>
                <span className="ml-auto" style={{ color: EXT.textTertiary, fontSize: '9px' }}>3 ✦</span>
              </div>

              {step <= 2 ? (
                /* ── Offer list view ── */
                <>
                  {/* CV selector */}
                  <div className="px-2 py-1.5" style={{ borderBottom: `1px solid ${EXT.border}` }}>
                    <div
                      className="flex items-center justify-between rounded px-2 py-1"
                      style={{ background: EXT.surface, border: `1px solid ${EXT.border}`, borderRadius: EXT.radiusSm }}
                    >
                      <span style={{ color: EXT.textSecondary, fontSize: '10px' }}>Mon CV principal</span>
                      <span style={{ color: EXT.textTertiary, fontSize: '9px' }}>&#9662;</span>
                    </div>
                  </div>

                  {/* Offer item */}
                  <div className="px-2 py-1.5" style={{ borderBottom: `1px solid ${EXT.border}` }}>
                    <div
                      className="flex items-center gap-1.5 rounded px-2 py-1.5"
                      style={{ background: EXT.surface, border: `1px solid ${EXT.border}`, borderRadius: EXT.radiusSm }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ color: EXT.textPrimary, fontSize: '10px', fontWeight: 500 }}>
                          Dev Full Stack
                        </p>
                        <p style={{ color: EXT.textTertiary, fontSize: '8px' }}>indeed.fr</p>
                      </div>
                      <span
                        className="flex-shrink-0"
                        style={{
                          fontSize: '9px', padding: '1px 5px', borderRadius: '10px',
                          fontWeight: 600, background: 'rgba(16,185,129,0.2)', color: EXT.emerald400,
                        }}
                      >
                        82
                      </span>
                    </div>
                  </div>

                  {/* Generate button */}
                  <div className="px-2 py-1.5">
                    <div
                      className="text-center rounded py-1.5"
                      style={{
                        background: EXT.emerald500, color: '#fff',
                        fontSize: '11px', fontWeight: 600, borderRadius: EXT.radiusSm,
                        animation: step === 2 ? 'glow 2s ease-in-out infinite' : 'none',
                      }}
                    >
                      Générer 1 CV
                    </div>
                  </div>
                </>
              ) : (
                /* ── Progress view ── */
                <div className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-[6px] h-[6px] rounded-full flex-shrink-0 transition-colors duration-500"
                      style={{
                        background: step === 4 ? EXT.emerald500 : EXT.amber400,
                        animation: step === 3 ? 'dotPulse 1.5s ease-in-out infinite' : 'none',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ color: EXT.textPrimary, fontSize: '10px', fontWeight: 500 }}>
                        Dev Full Stack
                      </p>
                    </div>
                    <span
                      className="transition-colors duration-500"
                      style={{ color: step === 4 ? EXT.emerald400 : EXT.amber400, fontSize: '9px' }}
                    >
                      {step === 4 ? 'Terminé' : 'En cours...'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Phase labels */}
      <div className="flex justify-center gap-4 md:gap-6 text-[10px] md:text-xs px-4 md:px-6">
        <span className={`transition-colors duration-300 ${phase === 0 ? 'text-emerald-400 font-medium' : 'text-white/30'}`}>
          1. {t('extensionPromo.tutorial.screen3.phase1')}
        </span>
        <span className={`transition-colors duration-300 ${phase === 1 ? 'text-emerald-400 font-medium' : 'text-white/30'}`}>
          2. {t('extensionPromo.tutorial.screen3.phase2')}
        </span>
        <span className={`transition-colors duration-300 ${phase === 2 ? 'text-emerald-400 font-medium' : 'text-white/30'}`}>
          3. {t('extensionPromo.tutorial.screen3.phase3')}
        </span>
      </div>
    </div>
  );
}

/**
 * Modal tutoriel pour l'extension navigateur FitMyCV.
 * Wrapper autour de OnboardingModal avec 3 écrans dédiés.
 */
export default function ExtensionTutorialModal({ open, onClose }) {
  const { t } = useLanguage();
  const [currentScreen, setCurrentScreen] = useState(0);

  const browser = useMemo(() => detectBrowser(), []);

  // Injecter les styles d'animation une seule fois
  useEffect(() => {
    if (!open) return;
    const styleId = 'ext-tutorial-animations';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = ANIMATION_STYLES;
    document.head.appendChild(style);
  }, [open]);

  const screens = useMemo(() => {
    const browserKeys = Object.keys(EXTENSION_STORE);
    const storeButtons = browserKeys
      .map((key) => ({
        key,
        url: EXTENSION_STORE[key],
        label: t(`extensionPromo.tutorial.screen2.install${key.charAt(0).toUpperCase() + key.slice(1)}`),
        icon: BROWSER_ICONS[key],
        primary: key === browser,
      }))
      .filter((btn) => btn.url);

    storeButtons.sort((a, b) => (a.primary ? -1 : b.primary ? 1 : 0));
    const hasAnyStore = storeButtons.length > 0;

    return [
      // Écran 1 : Gagnez du temps — texte + checklist, pas de mockup
      {
        title: t('extensionPromo.tutorial.screen1.title'),
        type: 'custom',
        customRender: (screen) => (
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-4">
              <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                {screen.description}
              </p>
              <div className="space-y-3 ml-4">
                {screen.checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-left">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-white text-sm md:text-base">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ),
        description: t('extensionPromo.tutorial.screen1.description'),
        checklist: [
          t('extensionPromo.tutorial.screen1.checklist1'),
          t('extensionPromo.tutorial.screen1.checklist2'),
          t('extensionPromo.tutorial.screen1.checklist3'),
          t('extensionPromo.tutorial.screen1.checklist4'),
        ],
      },
      // Écran 2 : Installation — boutons store
      {
        title: t('extensionPromo.tutorial.screen2.title'),
        type: 'custom',
        customRender: (screen) => (
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-4">
              <p className="text-white/80 text-sm md:text-base leading-relaxed text-left">
                {screen.description}
              </p>
              <div className="space-y-3 ml-2">
                {screen.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-left">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-sky-400">{idx + 1}</span>
                    </div>
                    <span className="text-white/80 text-sm md:text-base">{step}</span>
                  </div>
                ))}
              </div>
              {hasAnyStore ? (
                <div className="space-y-2 pt-2">
                  {storeButtons.map((btn) => (
                    <a
                      key={btn.key}
                      href={btn.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        btn.primary
                          ? 'bg-sky-500 hover:bg-sky-600 text-white'
                          : 'bg-white/10 hover:bg-white/15 text-white/80 border border-white/20'
                      }`}
                    >
                      {btn.icon}
                      {btn.label}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-amber-300 text-sm font-medium">{t('extensionPromo.tutorial.screen2.comingSoon')}</p>
                  <p className="text-white/60 text-xs mt-1">{t('extensionPromo.tutorial.screen2.comingSoonHint')}</p>
                </div>
              )}
            </div>
          </div>
        ),
        description: t('extensionPromo.tutorial.screen2.description'),
        steps: [
          t('extensionPromo.tutorial.screen2.step1'),
          t('extensionPromo.tutorial.screen2.step2'),
          t('extensionPromo.tutorial.screen2.step3'),
        ],
      },
      // Écran 3 : Comment ça marche — mockup navigateur pleine largeur
      {
        title: t('extensionPromo.tutorial.screen3.title'),
        type: 'custom',
        customRender: () => <ExtensionWorkflowMockup t={t} />,
      },
    ];
  }, [t, browser]);

  const handleNext = useCallback(() => {
    setCurrentScreen((prev) => Math.min(prev + 1, screens.length - 1));
  }, [screens.length]);

  const handlePrev = useCallback(() => {
    setCurrentScreen((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleJumpTo = useCallback((idx) => {
    setCurrentScreen(idx);
  }, []);

  const handleClose = useCallback(() => {
    setCurrentScreen(0);
    onClose();
  }, [onClose]);

  const handleComplete = useCallback(() => {
    setCurrentScreen(0);
    onClose();
  }, [onClose]);

  return (
    <OnboardingModal
      open={open}
      screens={screens}
      currentScreen={currentScreen}
      title={t('extensionPromo.tutorial.title')}
      IconComponent="/icons/extension-brain.png"
      iconBg="bg-transparent"
      iconColor=""
      onNext={handleNext}
      onPrev={handlePrev}
      onJumpTo={handleJumpTo}
      onComplete={handleComplete}
      onClose={handleClose}
      showSkipButton={false}
      size="large"
    />
  );
}

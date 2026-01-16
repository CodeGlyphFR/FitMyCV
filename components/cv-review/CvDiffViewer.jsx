'use client';

import React, { useMemo, useCallback, useState } from 'react';
import { Check, X, Save, Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import SectionDiff from './SectionDiff';
import useModificationReview from '@/hooks/useModificationReview';

/**
 * Ordre d'affichage des sections
 */
const SECTION_ORDER = ['summary', 'experiences', 'projects', 'skills', 'extras', 'languages'];

/**
 * Extrait les modifications d'un batchResult
 *
 * @param {Object} batchResults - Résultats de tous les batches
 * @returns {Object} - Modifications groupées par section
 */
function extractModifications(batchResults) {
  const result = {
    summary: [],
    experiences: [],
    projects: [],
    skills: [],
    extras: [],
    languages: [],
  };

  if (!batchResults) return result;

  // Summary - modIndex correspond à l'index dans le tableau de modifications
  if (batchResults.summary?.modifications) {
    result.summary = Array.isArray(batchResults.summary.modifications)
      ? batchResults.summary.modifications.map((mod, modIndex) => ({ ...mod, modIndex }))
      : [];
  }

  // Experiences - peut être un tableau d'expériences adaptées
  // On conserve le modIndex original pour que la clé de décision corresponde à applySelectiveChanges
  if (Array.isArray(batchResults.experiences)) {
    batchResults.experiences.forEach((exp, index) => {
      if (exp.modifications && Array.isArray(exp.modifications)) {
        exp.modifications.forEach((mod, modIndex) => {
          result.experiences.push({
            ...mod,
            field: `${exp.title || exp.company || `Exp ${index + 1}`} - ${mod.field}`,
            modIndex, // Index original dans le tableau de modifications de cette expérience
          });
        });
      }
    });
  }

  // Projects - peut être un tableau de projets adaptés
  // On conserve le modIndex original pour que la clé de décision corresponde à applySelectiveChanges
  if (Array.isArray(batchResults.projects)) {
    batchResults.projects.forEach((proj, index) => {
      if (proj.modifications && Array.isArray(proj.modifications)) {
        proj.modifications.forEach((mod, modIndex) => {
          result.projects.push({
            ...mod,
            field: `${proj.name || `Projet ${index + 1}`} - ${mod.field}`,
            modIndex, // Index original dans le tableau de modifications de ce projet
          });
        });
      }
    });
  }

  // Skills - modifications directes sur l'objet skills
  // Note: skills modifications use {category, skill, action, reason} format
  // We need to transform to {field, action, before, after, reason} for ModificationCard
  // Le format du field doit correspondre à applySelectiveChanges: "category.skillName"
  // modIndex correspond à l'index dans le tableau de modifications skills
  if (batchResults.skills?.modifications) {
    const skillsMods = Array.isArray(batchResults.skills.modifications)
      ? batchResults.skills.modifications
      : [];
    result.skills = skillsMods.map((mod, modIndex) => ({
      // Utiliser mod.field si disponible, sinon construire le format "category.skill"
      field: mod.field || `${mod.category || 'skill'}.${mod.skill}`,
      // Pour l'affichage, on peut garder un label plus lisible
      displayField: `${mod.category || 'skill'}: ${mod.skill}`,
      action: mod.action,
      before: mod.action === 'removed' ? mod.skill : null,
      after: mod.action === 'added' ? mod.skill : null,
      reason: mod.reason,
      modIndex, // Index original dans le tableau de modifications skills
    }));
  }

  // Extras - peut être un tableau ou un objet avec modifications
  // On conserve le modIndex original pour que la clé de décision corresponde à applySelectiveChanges
  if (Array.isArray(batchResults.extras)) {
    batchResults.extras.forEach((extra, index) => {
      if (extra.modifications && Array.isArray(extra.modifications)) {
        extra.modifications.forEach((mod, modIndex) => {
          result.extras.push({
            ...mod,
            field: `${extra.name || `Extra ${index + 1}`} - ${mod.field}`,
            modIndex, // Index original dans le tableau de modifications de cet extra
          });
        });
      }
    });
  } else if (batchResults.extras?.modifications) {
    result.extras = Array.isArray(batchResults.extras.modifications)
      ? batchResults.extras.modifications.map((mod, modIndex) => ({ ...mod, modIndex }))
      : [];
  }

  // Languages - modIndex correspond à l'index dans le tableau adapted
  if (batchResults.languages?.modifications) {
    const langMods = batchResults.languages.modifications;
    if (Array.isArray(langMods.adapted)) {
      langMods.adapted.forEach((lang, modIndex) => {
        result.languages.push({
          field: lang,
          action: 'modified',
          before: '',
          after: lang,
          reason: 'Format adapté selon l\'offre',
          modIndex, // Index original dans le tableau adapted
        });
      });
    }
  }

  return result;
}

/**
 * CvDiffViewer - Affiche toutes les modifications du CV avec accept/reject
 *
 * @param {Object} props
 * @param {Object} props.batchResults - Résultats de tous les batches avec modifications
 * @param {string} props.offerId - ID de l'offre de génération (pour l'API apply-review)
 * @param {string} props.className - Classes CSS additionnelles
 * @param {boolean} props.showActions - Afficher les boutons accept/reject (défaut: true)
 * @param {function} props.onReviewComplete - Callback quand toutes les modifications sont reviewées
 * @param {function} props.onDecisionsChange - Callback quand les décisions changent (decisions, stats)
 * @param {function} props.onValidationSuccess - Callback après validation réussie (stats)
 */
export default function CvDiffViewer({
  batchResults,
  offerId,
  className = '',
  showActions = true,
  onReviewComplete,
  onDecisionsChange,
  onValidationSuccess,
}) {
  const { t } = useLanguage();

  // Extraire et grouper les modifications
  const modificationsBySection = useMemo(
    () => extractModifications(batchResults),
    [batchResults]
  );

  // Calculer le total des modifications
  const totalModifications = useMemo(() => {
    return Object.values(modificationsBySection).reduce(
      (total, mods) => total + mods.length,
      0
    );
  }, [modificationsBySection]);

  // Hook de gestion des décisions
  const {
    acceptModification,
    rejectModification,
    getDecision,
    acceptAll,
    rejectAll,
    acceptAllInSection,
    stats,
    isAllReviewed,
    getDecisionsMap,
  } = useModificationReview(batchResults);

  // Callbacks pour les sections
  const handleAccept = useCallback((section, index, field) => {
    acceptModification(section, index, field);
  }, [acceptModification]);

  const handleReject = useCallback((section, index, field) => {
    rejectModification(section, index, field);
  }, [rejectModification]);

  const handleAcceptAllInSection = useCallback((section, mods) => {
    acceptAllInSection(section, mods);
  }, [acceptAllInSection]);

  // Callbacks pour les boutons globaux
  const handleAcceptAll = useCallback(() => {
    acceptAll(modificationsBySection);
  }, [acceptAll, modificationsBySection]);

  const handleRejectAll = useCallback(() => {
    rejectAll(modificationsBySection);
  }, [rejectAll, modificationsBySection]);

  // État pour la validation
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Handler pour valider et sauvegarder
  const handleValidate = useCallback(async () => {
    if (!offerId) {
      setValidationError('offerId is required');
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      const response = await fetch('/api/cv/apply-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          offerId,
          decisions: getDecisionsMap(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Validation failed');
      }

      // Succès
      onValidationSuccess?.(data.stats);
    } catch (error) {
      console.error('[CvDiffViewer] Validation error:', error);
      setValidationError(error.message);
    } finally {
      setIsValidating(false);
    }
  }, [offerId, getDecisionsMap, onValidationSuccess]);

  // Notifier les changements de décisions
  React.useEffect(() => {
    onDecisionsChange?.(getDecisionsMap(), stats);

    if (isAllReviewed(totalModifications) && totalModifications > 0) {
      onReviewComplete?.(getDecisionsMap());
    }
  }, [stats, totalModifications, isAllReviewed, getDecisionsMap, onDecisionsChange, onReviewComplete]);

  // Aucune modification
  if (totalModifications === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-white/60">
          {t('cvReview.noModificationsFound') || 'Aucune modification trouvée'}
        </p>
      </div>
    );
  }

  const allReviewed = isAllReviewed(totalModifications);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header avec compteur total et progression */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">
          {t('cvReview.title') || 'Modifications IA'}
        </h3>
        <div className="flex items-center gap-3">
          {/* Compteur de review */}
          <span className={`text-sm ${allReviewed ? 'text-emerald-400' : 'text-white/60'}`}>
            {t('cv.review.progress', { reviewed: stats.reviewed, total: totalModifications }) ||
              `${stats.reviewed}/${totalModifications} revues`}
          </span>
          {/* Badge total */}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            allReviewed
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-white/10 text-white/70'
          }`}>
            {allReviewed
              ? (t('cv.review.allReviewed') || 'Toutes revues')
              : `${totalModifications} ${t('cvReview.total') || 'total'}`
            }
          </span>
        </div>
      </div>

      {/* Boutons Accept All / Reject All */}
      {showActions && !allReviewed && (
        <div className="flex items-center gap-3">
          {/* Bouton Accept All - proéminent */}
          <button
            onClick={handleAcceptAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-medium transition-colors"
          >
            <Check className="w-4 h-4" />
            {t('cv.review.acceptAll') || 'Tout accepter'}
          </button>
          {/* Bouton Reject All - moins proéminent */}
          <button
            onClick={handleRejectAll}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            {t('cv.review.rejectAll') || 'Tout refuser'}
          </button>
          {/* Info sur le comportement */}
          {stats.reviewed > 0 && (
            <span className="text-xs text-white/40 ml-2">
              {t('cvReview.preservesPreviousDecisions') || '(préserve vos choix précédents)'}
            </span>
          )}
        </div>
      )}

      {/* Résumé des décisions */}
      {stats.reviewed > 0 && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-emerald-400">
            ✓ {stats.accepted} {t('cv.review.accepted') || 'acceptées'}
          </span>
          <span className="text-red-400">
            ✗ {stats.rejected} {t('cv.review.rejected') || 'refusées'}
          </span>
          {!allReviewed && (
            <span className="text-white/50">
              • {totalModifications - stats.reviewed} {t('cv.review.pending') || 'en attente'}
            </span>
          )}
        </div>
      )}

      {/* Sections dans l'ordre défini */}
      {SECTION_ORDER.map((sectionName) => {
        const modifications = modificationsBySection[sectionName] || [];
        return (
          <SectionDiff
            key={sectionName}
            sectionName={sectionName}
            modifications={modifications}
            defaultExpanded={modifications.length > 0}
            getDecision={getDecision}
            onAccept={handleAccept}
            onReject={handleReject}
            onAcceptAllInSection={handleAcceptAllInSection}
            showActions={showActions}
          />
        );
      })}

      {/* Bouton de validation finale */}
      {showActions && offerId && (
        <div className="pt-4 border-t border-white/10">
          {/* Erreur de validation */}
          {validationError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
              {validationError}
            </div>
          )}

          {/* Avertissement si modifications non reviewées */}
          {!allReviewed && stats.reviewed < totalModifications && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/20 text-amber-400 text-sm">
              {t('cv.review.pendingWarning') ||
                `${totalModifications - stats.reviewed} modification(s) non reviewée(s). Elles seront acceptées par défaut.`}
            </div>
          )}

          <button
            onClick={handleValidate}
            disabled={isValidating}
            className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg font-medium transition-colors ${
              isValidating
                ? 'bg-white/10 text-white/50 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isValidating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('cv.review.validating') || 'Validation en cours...'}
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {t('cv.review.validateAndSave') || 'Valider et sauvegarder'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

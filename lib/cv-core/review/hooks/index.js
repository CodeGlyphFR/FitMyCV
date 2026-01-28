/**
 * Re-exports pour les hooks de review par section
 *
 * Ce module centralise l'exportation de tous les hooks de review.
 *
 * Architecture:
 * - Chaque section du CV a son propre hook de review
 * - Les hooks gèrent leur état localement (pas de state global)
 * - La synchronisation inter-sections se fait via événements
 * - Pas de router.refresh() - mises à jour optimistes locales
 *
 * Usage:
 * import { useSummaryReview, useSkillsReview } from '@/lib/cv-core/review/hooks';
 */

// Contexte et utilitaires
export {
  ReviewContext,
  useReviewContext,
  REVIEW_EVENTS,
  CROSS_SECTION_DEPENDENCIES,
  shouldRefreshForSection,
} from "./useReviewContext";

// Hook factory générique
export {
  useSectionReview,
  useFindSectionChange,
} from "./useSectionReview";

// Hooks par section
export { useSummaryReview } from "./useSummaryReview";

export {
  useSkillsReview,
  useAllSkillsReview,
  SKILL_FIELDS,
} from "./useSkillsReview";

export {
  useExperienceReview,
  useAllExperiencesReview,
} from "./useExperienceReview";

export {
  useEducationReview,
  useEducationHasChanges,
} from "./useEducationReview";

export {
  useLanguagesReview,
  useLanguageHasChanges,
} from "./useLanguagesReview";

export {
  useProjectsReview,
  useProjectHasChanges,
} from "./useProjectsReview";

export {
  useExtrasReview,
  useExtraHasChanges,
} from "./useExtrasReview";

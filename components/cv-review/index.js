/**
 * CV Review Components
 *
 * Composants pour afficher et valider les modifications IA sur un CV généré.
 */

export { default as CvDiffViewer } from './CvDiffViewer';
export { default as SectionDiff } from './SectionDiff';
export { default as ModificationCard } from './ModificationCard';

// Re-export the hook for convenience
export { useModificationReview } from '@/hooks/useModificationReview';

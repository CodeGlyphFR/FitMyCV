/**
 * Data migration: suppression des réglages IA obsolètes
 *
 * Ces réglages ne sont lus par aucune ligne de code :
 * - model_analysis_rapid / model_analysis_medium / model_analysis_deep : ancienne analyse, retirée
 * - model_cv_planning : vide, jamais utilisé
 * - model_optimize_cv / effort_optimize_cv : « Optimisation (Legacy) », l'optimisation passe
 *   désormais par le pipeline d'amélioration (model_improve_*)
 *
 * Les réglages credits_optimize_cv (crédits de la fonction Optimisation) ne sont PAS concernés.
 * Idempotent.
 */

const OBSOLETE_SETTINGS = [
  'model_analysis_rapid',
  'model_analysis_medium',
  'model_analysis_deep',
  'model_cv_planning',
  'model_optimize_cv',
  'effort_optimize_cv',
];

module.exports = async (prisma) => {
  const result = await prisma.setting.deleteMany({
    where: { settingName: { in: OBSOLETE_SETTINGS } },
  });
  console.log(`[remove-obsolete-ai-settings] ${result.count} réglage(s) obsolète(s) supprimé(s).`);
};

/**
 * Data migration: le résumé (cv_batch_summary) passe en raisonnement léger
 *
 * Le résumé doit croiser plusieurs règles (domaine le plus pertinent pour l'offre,
 * regroupement de domaines proches, années vérifiables) : effort 'none' → 'low'.
 * Ne modifie que la valeur par défaut posée par 20261113_1000_ai_models_gpt6.js
 * (un réglage manuel différent de 'none' est conservé). Idempotent.
 */

module.exports = async (prisma) => {
  const result = await prisma.setting.updateMany({
    where: { settingName: 'effort_cv_batch_summary', value: 'none' },
    data: {
      value: 'low',
      description: 'Effort de raisonnement pour model_cv_batch_summary (none | low | medium | high). Raisonnement léger : plus fin, un peu plus lent',
    },
  });
  console.log(`[summary-effort-low] effort_cv_batch_summary : ${result.count} réglage(s) passé(s) en 'low'.`);
};

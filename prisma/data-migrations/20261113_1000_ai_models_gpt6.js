/**
 * Data migration: Renouvellement des modèles OpenAI → famille GPT-6
 *
 * Contexte (page OpenAI "Deprecations", consultée le 2026-11-12) :
 * - o4-mini : coupé le 2026-10-23
 * - gpt-5 / gpt-5-mini / gpt-5-nano : coupure le 2026-12-11
 * - gpt-4o / gpt-4o-mini / gpt-4.1 / gpt-4.1-mini : coupure le 2027-01-14
 *
 * Profils (qualité / rapidité) :
 * - Raisonnement : gpt-6.1-terra, effort low  (classification, compétences, score, pré-traitement, résumé)
 * - Rédaction    : gpt-6.1-terra, effort none (expériences, projets, import PDF…)
 * - Mécanique    : gpt-6-luna,    effort none (langues, traductions, détection…) — low pour l'extraction d'offres
 *
 * Tables impactées :
 * - Setting model_* : remplacé UNIQUEMENT si la valeur actuelle n'est pas déjà un modèle GPT-6
 *   (un choix manuel valide de l'admin n'est jamais écrasé ; les valeurs vides sont ignorées)
 * - Setting effort_* : créé s'il n'existe pas (jamais écrasé)
 * - OpenAIPricing : ajout des 3 modèles GPT-6 ; désactivation des modèles retirés
 *   (ils disparaissent de la liste de l'admin, l'historique des coûts est conservé)
 *
 * Idempotent.
 */

const LUNA = 'gpt-6-luna';
const TERRA = 'gpt-6.1-terra';

// tâche → [modèle, effort]  (effort null = pas de setting effort_*, tâche inutilisée)
const TASKS = {
  // Raisonnement
  cv_classify: [TERRA, 'low'],
  cv_batch_skills: [TERRA, 'low'],
  match_score: [TERRA, 'low'],
  improve_preprocess: [TERRA, 'low'],
  // Rédaction / lecture PDF
  cv_batch_experience: [TERRA, 'none'],
  cv_batch_projects: [TERRA, 'none'],
  cv_batch_summary: [TERRA, 'low'],
  generate_from_job_title: [TERRA, 'none'],
  improve_experience: [TERRA, 'none'],
  improve_project: [TERRA, 'none'],
  improve_summary: [TERRA, 'none'],
  first_import_pdf: [TERRA, 'none'],
  import_pdf: [TERRA, 'none'],
  optimize_cv: [TERRA, 'none'],
  // Mécanique
  extract_job_offer: [LUNA, 'low'],
  detect_language: [LUNA, 'none'],
  cv_batch_languages: [LUNA, 'none'],
  cv_batch_extras: [LUNA, 'none'],
  cv_batch_education: [LUNA, 'none'],
  translate_cv: [LUNA, 'none'],
  cv_generation: [LUNA, 'none'],
  improve_classify_skills: [LUNA, 'none'],
  improve_languages: [LUNA, 'none'],
  improve_extras: [LUNA, 'none'],
  // Réglages présents en base mais non utilisés par le code
  analysis_rapid: [LUNA, null],
  analysis_medium: [TERRA, null],
  analysis_deep: [TERRA, null],
};

const EFFORT_DESCRIPTIONS = {
  none: 'Sans raisonnement : réponse la plus rapide',
  low: 'Raisonnement léger : plus fin, un peu plus lent',
};

// Tarifs Standard ($ / 1M tokens) ; "Priority" = Fast mode (2x)
const GPT6_PRICING = [
  { modelName: LUNA, input: 0.10, output: 0.50, cache: 0.01, description: 'GPT-6 Luna - tâches ciblées et volumineuses' },
  { modelName: TERRA, input: 1.00, output: 5.00, cache: 0.05, description: 'GPT-6.1 Terra - rédaction et raisonnement visuel, rapide' },
  { modelName: 'gpt-6.1-sol', input: 2.00, output: 10.00, cache: 0.10, description: 'GPT-6.1 Sol - travail complexe' },
];

module.exports = async (prisma) => {
  // 1. Modèles
  let modelsUpdated = 0;
  for (const [task, [model]] of Object.entries(TASKS)) {
    const settingName = `model_${task}`;
    const setting = await prisma.setting.findUnique({ where: { settingName } });
    if (!setting || !setting.value || setting.value.startsWith('gpt-6')) continue;
    await prisma.setting.update({ where: { settingName }, data: { value: model } });
    console.log(`[ai-models-gpt6] ${settingName}: ${setting.value} → ${model}`);
    modelsUpdated++;
  }

  // 2. Efforts de raisonnement (création uniquement)
  let effortsCreated = 0;
  for (const [task, [, effort]] of Object.entries(TASKS)) {
    if (!effort) continue;
    const settingName = `effort_${task}`;
    const existing = await prisma.setting.findUnique({ where: { settingName } });
    if (existing) continue;
    await prisma.setting.create({
      data: {
        settingName,
        value: effort,
        category: 'ai_models',
        description: `Effort de raisonnement pour model_${task} (none | low | medium | high). ${EFFORT_DESCRIPTIONS[effort]}`,
      },
    });
    effortsCreated++;
  }

  // 3. Tarifs GPT-6 + désactivation des modèles retirés
  for (const p of GPT6_PRICING) {
    const data = {
      inputPricePerMToken: p.input,
      outputPricePerMToken: p.output,
      cachePricePerMToken: p.cache,
      inputPricePerMTokenPriority: p.input * 2,
      outputPricePerMTokenPriority: p.output * 2,
      cachePricePerMTokenPriority: p.cache * 2,
      description: p.description,
      isActive: true,
    };
    await prisma.openAIPricing.upsert({
      where: { modelName: p.modelName },
      create: { modelName: p.modelName, ...data },
      update: data,
    });
  }
  const deactivated = await prisma.openAIPricing.updateMany({
    where: { isActive: true, NOT: { modelName: { startsWith: 'gpt-6' } } },
    data: { isActive: false },
  });

  console.log(
    `[ai-models-gpt6] ${modelsUpdated} modèle(s) remplacé(s), ${effortsCreated} effort(s) créé(s), ` +
    `${GPT6_PRICING.length} tarif(s) GPT-6, ${deactivated.count} ancien(s) tarif(s) désactivé(s).`
  );
};

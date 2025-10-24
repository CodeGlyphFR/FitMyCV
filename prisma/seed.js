const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding...');

  // Seed des settings de modèles IA
  const aiModelSettings = [
    // Niveaux d'analyse partagés (utilisés par generateCv, improveCv, importPdf, createTemplate)
    {
      settingName: 'model_analysis_rapid',
      value: 'gpt-5-nano-2025-08-07',
      category: 'ai_models',
      description: 'Modèle rapide et économique pour analyse rapide'
    },
    {
      settingName: 'model_analysis_medium',
      value: 'gpt-5-mini-2025-08-07',
      category: 'ai_models',
      description: 'Modèle standard pour analyse équilibrée'
    },
    {
      settingName: 'model_analysis_deep',
      value: 'gpt-5-2025-08-07',
      category: 'ai_models',
      description: 'Modèle avancé pour analyse approfondie'
    },

    // Modèles dédiés pour features spécifiques
    {
      settingName: 'model_match_score',
      value: 'gpt-4o-mini',
      category: 'ai_models',
      description: 'Modèle pour calcul du score de correspondance'
    },
    {
      settingName: 'model_translate_cv',
      value: 'gpt-4o-mini',
      category: 'ai_models',
      description: 'Modèle pour traduction de CV'
    },
    {
      settingName: 'model_extract_job_offer',
      value: 'gpt-4o-mini',
      category: 'ai_models',
      description: 'Modèle pour extraction d\'offres d\'emploi'
    },
    {
      settingName: 'model_generate_from_job_title',
      value: 'gpt-5-mini-2025-08-07',
      category: 'ai_models',
      description: 'Modèle pour génération de CV depuis titre de poste'
    },
    {
      settingName: 'model_import_pdf',
      value: 'gpt-5-nano-2025-08-07',
      category: 'ai_models',
      description: 'Modèle pour import de CV depuis PDF'
    },
    {
      settingName: 'model_optimize_cv',
      value: 'gpt-5-mini-2025-08-07',
      category: 'ai_models',
      description: 'Modèle pour optimisation de CV'
    }
  ];

  console.log('📝 Création des settings de modèles IA...');

  for (const setting of aiModelSettings) {
    await prisma.setting.upsert({
      where: { settingName: setting.settingName },
      update: {
        value: setting.value,
        description: setting.description,
      },
      create: setting,
    });
    console.log(`  ✅ ${setting.settingName} = ${setting.value}`);
  }

  console.log('✨ Seeding terminé avec succès !');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erreur lors du seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

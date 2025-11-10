/**
 * Script de seed pour initialiser les paramètres de configuration dans la table Setting
 * Usage: node prisma/seed-settings.js
 */

// Charger les variables d'environnement depuis .env.local
require('dotenv').config({ path: '.env.local' });

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const defaultSettings = [
  // Système
  {
    settingName: 'registration_enabled',
    value: '1',
    category: 'system',
    description: 'Active ou désactive les inscriptions (1 = activé, 0 = désactivé)',
  },

  // Features
  {
    settingName: 'feature_manual_cv',
    value: '1',
    category: 'features',
    description: 'Permet la création manuelle de CV (bouton Add)',
  },
  {
    settingName: 'feature_ai_generation',
    value: '1',
    category: 'features',
    description: 'Permet la génération de CV avec IA (bouton GPT)',
  },
  {
    settingName: 'feature_import',
    value: '1',
    category: 'features',
    description: 'Permet l\'import de CV depuis PDF',
  },
  {
    settingName: 'feature_export',
    value: '1',
    category: 'features',
    description: 'Permet l\'export de CV en PDF',
  },
  {
    settingName: 'feature_match_score',
    value: '1',
    category: 'features',
    description: 'Affiche le score de correspondance pour les CV',
  },
  {
    settingName: 'feature_optimize',
    value: '1',
    category: 'features',
    description: 'Affiche le bouton d\'optimisation de CV',
  },
  {
    settingName: 'feature_history',
    value: '1',
    category: 'features',
    description: 'Affiche l\'historique des liens dans le générateur',
  },
  {
    settingName: 'feature_search_bar',
    value: '1',
    category: 'features',
    description: 'Affiche la barre de recherche par titre de poste',
  },
  {
    settingName: 'feature_translate',
    value: '1',
    category: 'features',
    description: 'Permet la traduction de CV',
  },
  {
    settingName: 'feature_language_switcher',
    value: '1',
    category: 'features',
    description: 'Affiche le sélecteur de langue du site',
  },
  {
    settingName: 'feature_edit_mode',
    value: '1',
    category: 'features',
    description: 'Permet le mode édition des CV',
  },
  {
    settingName: 'feature_feedback',
    value: '1',
    category: 'features',
    description: 'Affiche le système de feedback utilisateur',
  },
];

async function seed() {
  console.log('🌱 Début du seed des paramètres de configuration...');

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const setting of defaultSettings) {
    try {
      // Vérifier si le setting existe déjà
      const existing = await prisma.setting.findUnique({
        where: { settingName: setting.settingName },
      });

      if (existing) {
        // Ne pas écraser si le setting existe déjà
        console.log(`⏭️  Setting "${setting.settingName}" existe déjà (valeur: ${existing.value})`);
        skipped++;
      } else {
        // Créer le setting
        await prisma.setting.create({
          data: setting,
        });
        console.log(`✅ Setting "${setting.settingName}" créé avec succès`);
        created++;
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la création du setting "${setting.settingName}":`, error.message);
    }
  }

  console.log('\n📊 Résumé:');
  console.log(`   - Créés: ${created}`);
  console.log(`   - Ignorés (déjà existants): ${skipped}`);
  console.log(`   - Total: ${defaultSettings.length}`);
  console.log('\n✨ Seed terminé avec succès!');
}

seed()
  .catch((error) => {
    console.error('❌ Erreur fatale lors du seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

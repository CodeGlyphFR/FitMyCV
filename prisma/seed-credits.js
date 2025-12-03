/**
 * Script standalone pour ajouter les settings de crédits par feature
 *
 * Usage:
 *   node prisma/seed-credits.js           # Ajoute les settings (skip si existants)
 *   node prisma/seed-credits.js --force   # Force la mise à jour des valeurs
 *   node prisma/seed-credits.js --dry-run # Affiche ce qui serait fait sans modifier
 *
 * Ce script peut être exécuté sur une base de données existante sans affecter
 * les autres données. Il utilise upsert pour ne pas écraser les valeurs modifiées
 * sauf si --force est utilisé.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Settings de crédits par feature
const CREDIT_SETTINGS = [
  {
    settingName: 'credits_create_cv_manual',
    value: '1',
    category: 'credits',
    description: 'Crédits pour création manuelle CV',
  },
  {
    settingName: 'credits_edit_cv',
    value: '1',
    category: 'credits',
    description: 'Crédits pour édition CV',
  },
  {
    settingName: 'credits_export_cv',
    value: '1',
    category: 'credits',
    description: 'Crédits pour export PDF',
  },
  {
    settingName: 'credits_match_score',
    value: '1',
    category: 'credits',
    description: 'Crédits pour score de matching',
  },
  {
    settingName: 'credits_translate_cv',
    value: '1',
    category: 'credits',
    description: 'Crédits pour traduction CV',
  },
  {
    settingName: 'credits_gpt_cv_generation_rapid',
    value: '1',
    category: 'credits',
    description: 'Crédits pour génération CV rapide',
  },
  {
    settingName: 'credits_gpt_cv_generation_medium',
    value: '2',
    category: 'credits',
    description: 'Crédits pour génération CV normal',
  },
  {
    settingName: 'credits_gpt_cv_generation_deep',
    value: '0',
    category: 'credits',
    description: '0 = Abonnement Premium requis',
  },
  {
    settingName: 'credits_optimize_cv',
    value: '2',
    category: 'credits',
    description: 'Crédits pour optimisation CV',
  },
  {
    settingName: 'credits_generate_from_job_title',
    value: '3',
    category: 'credits',
    description: 'Crédits pour génération depuis titre',
  },
  {
    settingName: 'credits_import_pdf',
    value: '5',
    category: 'credits',
    description: 'Crédits pour import PDF',
  },
];

async function main() {
  const args = process.argv.slice(2);
  const forceUpdate = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  console.log('💳 Script de migration des settings de crédits par feature');
  console.log('============================================================');

  if (dryRun) {
    console.log('\n🔍 Mode dry-run activé - aucune modification ne sera effectuée\n');
  }

  if (forceUpdate) {
    console.log('\n⚠️  Mode force activé - les valeurs existantes seront écrasées\n');
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const setting of CREDIT_SETTINGS) {
    // Vérifier si le setting existe déjà
    const existing = await prisma.setting.findUnique({
      where: { settingName: setting.settingName },
    });

    if (existing) {
      if (forceUpdate) {
        if (!dryRun) {
          await prisma.setting.update({
            where: { settingName: setting.settingName },
            data: {
              value: setting.value,
              description: setting.description,
            },
          });
        }
        console.log(`  🔄 ${setting.settingName}: ${existing.value} → ${setting.value} (mis à jour)`);
        updated++;
      } else {
        console.log(`  ⏭️  ${setting.settingName}: ${existing.value} (ignoré - déjà existant)`);
        skipped++;
      }
    } else {
      if (!dryRun) {
        await prisma.setting.create({
          data: setting,
        });
      }
      console.log(`  ✅ ${setting.settingName} = ${setting.value} crédit(s) (créé)`);
      created++;
    }
  }

  console.log('\n📊 Résumé :');
  console.log(`   - Créés : ${created}`);
  console.log(`   - Mis à jour : ${updated}`);
  console.log(`   - Ignorés : ${skipped}`);
  console.log(`   - Total : ${CREDIT_SETTINGS.length}`);

  if (dryRun) {
    console.log('\n💡 Pour appliquer les changements, relancez sans --dry-run');
  }

  console.log('\n✨ Terminé !');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erreur:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

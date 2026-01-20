/**
 * Migration script: Rename feature/type names across all analytics tables
 *
 * Tables migrated:
 *   - OpenAICall (featureName)
 *   - OpenAIUsage (featureName)
 *   - BackgroundTask (type)
 *   - TelemetryEvent (type)
 *
 * Usage: node scripts/migrate-feature-names.js [--dry-run]
 *
 * Options:
 *   --dry-run  Show what would be changed without making changes
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Mapping: old featureName → new featureName (OpenAICall, OpenAIUsage)
const FEATURE_NAME_MIGRATIONS = {
  // CV Adaptation (formerly cv_pipeline_v2)
  'cv_pipeline_v2_classify': 'cv_adaptation_classify',
  'cv_pipeline_v2_batch_experience': 'cv_adaptation_experience',
  'cv_pipeline_v2_batch_project': 'cv_adaptation_project',
  'cv_pipeline_v2_batch_extras': 'cv_adaptation_extras',
  'cv_pipeline_v2_batch_skills': 'cv_adaptation_skills',
  'cv_pipeline_v2_batch_summary': 'cv_adaptation_summary',
  'cv_pipeline_v2_recompose_languages': 'cv_adaptation_languages',

  // CV Improvement (formerly cv_improvement_v2)
  'cv_improvement_v2_preprocess': 'cv_improvement_preprocess',
  'cv_improvement_v2_experience': 'cv_improvement_experience',
  'cv_improvement_v2_project': 'cv_improvement_project',
  'cv_improvement_v2_languages': 'cv_improvement_languages',
  'cv_improvement_v2_summary': 'cv_improvement_summary',

  // Classify skills → cv_improvement_classify
  'classify_skills': 'cv_improvement_classify',
};

// Mapping: old type → new type (BackgroundTask)
const BACKGROUND_TASK_TYPE_MIGRATIONS = {
  'cv_generation_v2': 'cv_generation',
};

// Mapping: old type → new type (TelemetryEvent)
const TELEMETRY_TYPE_MIGRATIONS = {
  'CV_GENERATION_V2_STARTED': 'CV_GENERATION_STARTED',
  'CV_GENERATION_V2_COMPLETED': 'CV_GENERATION_COMPLETED',
  'CV_GENERATION_V2_FAILED': 'CV_GENERATION_FAILED',
};

async function migrateFeatureNames(tableName, model, isDryRun) {
  console.log(`\n📋 Table: ${tableName} (featureName)`);
  console.log('────────────────────────────────────────────────');

  let totalUpdated = 0;

  for (const [oldName, newName] of Object.entries(FEATURE_NAME_MIGRATIONS)) {
    const count = await model.count({ where: { featureName: oldName } });

    if (count === 0) continue;

    if (isDryRun) {
      console.log(`  📋 ${oldName} → ${newName} (${count} records)`);
    } else {
      const result = await model.updateMany({
        where: { featureName: oldName },
        data: { featureName: newName }
      });
      console.log(`  ✅ ${oldName} → ${newName} (${result.count} records updated)`);
      totalUpdated += result.count;
    }
  }

  if (totalUpdated === 0 && !isDryRun) {
    console.log('  (aucun enregistrement à migrer)');
  }

  return totalUpdated;
}

async function migrateBackgroundTaskTypes(isDryRun) {
  console.log(`\n📋 Table: BackgroundTask (type)`);
  console.log('────────────────────────────────────────────────');

  let totalUpdated = 0;

  for (const [oldType, newType] of Object.entries(BACKGROUND_TASK_TYPE_MIGRATIONS)) {
    const count = await prisma.backgroundTask.count({ where: { type: oldType } });

    if (count === 0) continue;

    if (isDryRun) {
      console.log(`  📋 ${oldType} → ${newType} (${count} records)`);
    } else {
      const result = await prisma.backgroundTask.updateMany({
        where: { type: oldType },
        data: { type: newType }
      });
      console.log(`  ✅ ${oldType} → ${newType} (${result.count} records updated)`);
      totalUpdated += result.count;
    }
  }

  if (totalUpdated === 0 && !isDryRun) {
    console.log('  (aucun enregistrement à migrer)');
  }

  return totalUpdated;
}

async function migrateTelemetryTypes(isDryRun) {
  console.log(`\n📋 Table: TelemetryEvent (type)`);
  console.log('────────────────────────────────────────────────');

  let totalUpdated = 0;

  for (const [oldType, newType] of Object.entries(TELEMETRY_TYPE_MIGRATIONS)) {
    const count = await prisma.telemetryEvent.count({ where: { type: oldType } });

    if (count === 0) continue;

    if (isDryRun) {
      console.log(`  📋 ${oldType} → ${newType} (${count} records)`);
    } else {
      const result = await prisma.telemetryEvent.updateMany({
        where: { type: oldType },
        data: { type: newType }
      });
      console.log(`  ✅ ${oldType} → ${newType} (${result.count} records updated)`);
      totalUpdated += result.count;
    }
  }

  if (totalUpdated === 0 && !isDryRun) {
    console.log('  (aucun enregistrement à migrer)');
  }

  return totalUpdated;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n🔄 Migration: Standardize feature/type names (remove v2)');
  console.log('════════════════════════════════════════════════════════════');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
  }

  // Migrate all tables
  const callsUpdated = await migrateFeatureNames('OpenAICall', prisma.openAICall, isDryRun);
  const usageUpdated = await migrateFeatureNames('OpenAIUsage', prisma.openAIUsage, isDryRun);
  const tasksUpdated = await migrateBackgroundTaskTypes(isDryRun);
  const telemetryUpdated = await migrateTelemetryTypes(isDryRun);

  const totalUpdated = callsUpdated + usageUpdated + tasksUpdated + telemetryUpdated;

  console.log('\n════════════════════════════════════════════════════════════');

  if (isDryRun) {
    console.log('📋 Dry run complete. Run without --dry-run to apply changes.\n');
  } else {
    console.log(`✨ Migration complete! ${totalUpdated} records updated total.`);
    console.log(`   - OpenAICall: ${callsUpdated}`);
    console.log(`   - OpenAIUsage: ${usageUpdated}`);
    console.log(`   - BackgroundTask: ${tasksUpdated}`);
    console.log(`   - TelemetryEvent: ${telemetryUpdated}\n`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

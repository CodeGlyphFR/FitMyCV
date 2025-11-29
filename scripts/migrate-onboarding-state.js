/**
 * Script de Migration : Onboarding State Refactoring
 *
 * Ce script migre les données d'onboarding des utilisateurs existants vers la nouvelle structure :
 * - completedSteps (Json) → onboardingState.completedSteps
 * - viewedTooltips (String) → onboardingState.tooltips
 * - Initialise onboardingStartedAt pour users ayant commencé l'onboarding
 * - Normalise onboardingState avec DEFAULT_ONBOARDING_STATE
 *
 * ⚠️ IMPORTANT : Exécuter ce script AVANT d'appliquer la migration Prisma qui supprime les colonnes
 *
 * Usage:
 *   node scripts/migrate-onboarding-state.js
 *
 * Options:
 *   --dry-run : Affiche les changements sans les appliquer
 *   --verbose : Logs détaillés
 */

const { PrismaClient } = require('@prisma/client');
const { DEFAULT_ONBOARDING_STATE } = require('../lib/onboarding/onboardingState');

const prisma = new PrismaClient();

// Parse arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');

/**
 * Parse viewedTooltips string (legacy format)
 * @param {string|null} viewedTooltips - JSON string
 * @returns {Object} Tooltips object
 */
function parseViewedTooltips(viewedTooltips) {
  if (!viewedTooltips) return {};

  try {
    const parsed = JSON.parse(viewedTooltips);
    // Convertir vers nouveau format
    const tooltips = {};

    if (Array.isArray(parsed)) {
      // Format: ["1", "2", "3"] → { "1": { closedManually: true }, ... }
      parsed.forEach(stepNumber => {
        tooltips[String(stepNumber)] = { closedManually: true };
      });
    } else if (typeof parsed === 'object') {
      // Format: { "1": true, "2": false } → { "1": { closedManually: true }, ... }
      Object.keys(parsed).forEach(key => {
        tooltips[key] = { closedManually: parsed[key] === true };
      });
    }

    return tooltips;
  } catch (error) {
    console.error('Erreur parsing viewedTooltips:', error.message);
    return {};
  }
}

/**
 * Parse completedSteps (Json/String)
 * @param {any} completedSteps - Json or String
 * @returns {number[]} Array of completed step numbers
 */
function parseCompletedSteps(completedSteps) {
  if (!completedSteps) return [];

  if (Array.isArray(completedSteps)) {
    return completedSteps.filter(s => typeof s === 'number');
  }

  if (typeof completedSteps === 'string') {
    try {
      const parsed = JSON.parse(completedSteps);
      return Array.isArray(parsed) ? parsed.filter(s => typeof s === 'number') : [];
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Parse onboardingState (String)
 * @param {string|null} onboardingState - JSON string
 * @returns {Object} Parsed state
 */
function parseOnboardingState(onboardingState) {
  if (!onboardingState) return {};

  try {
    const parsed = typeof onboardingState === 'string' ? JSON.parse(onboardingState) : onboardingState;
    return parsed || {};
  } catch (error) {
    console.error('Erreur parsing onboardingState:', error.message);
    return {};
  }
}

/**
 * Migre un utilisateur
 * @param {Object} user - User object from Prisma
 * @returns {Object} Migrated onboardingState
 */
function migrateUser(user) {
  // Parse données existantes
  const existingState = parseOnboardingState(user.onboardingState);
  const completedSteps = parseCompletedSteps(user.completedSteps);
  const viewedTooltips = parseViewedTooltips(user.viewedTooltips);

  // Construire nouveau state (merge avec existant si déjà migré partiellement)
  const migratedState = {
    ...DEFAULT_ONBOARDING_STATE,
    ...existingState,

    // Merger completedSteps
    currentStep: existingState.currentStep ?? user.onboardingStep ?? 0,
    completedSteps: completedSteps.length > 0 ? completedSteps : (existingState.completedSteps || []),

    // Merger modals (garder existant si déjà présent)
    modals: {
      ...DEFAULT_ONBOARDING_STATE.modals,
      ...(existingState.modals || {})
    },

    // Merger tooltips (combiner legacy viewedTooltips + existant)
    tooltips: {
      ...DEFAULT_ONBOARDING_STATE.tooltips,
      ...viewedTooltips,
      ...(existingState.tooltips || {})
    },

    // Timestamps
    timestamps: {
      startedAt: existingState.timestamps?.startedAt || (user.onboardingStep > 0 ? user.createdAt.toISOString() : null),
      completedAt: existingState.timestamps?.completedAt || (user.onboardingCompletedAt ? user.onboardingCompletedAt.toISOString() : null),
      lastStepChangeAt: existingState.timestamps?.lastStepChangeAt || (user.updatedAt ? user.updatedAt.toISOString() : null)
    },

    // Step4 preconditions (garder existant si déjà présent)
    step4: {
      ...DEFAULT_ONBOARDING_STATE.step4,
      ...(existingState.step4 || {})
    }
  };

  return migratedState;
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Début de la migration des données d\'onboarding\n');
  console.log(`Mode : ${isDryRun ? 'DRY RUN (aucun changement appliqué)' : 'PRODUCTION'}\n`);

  try {
    // Récupérer tous les utilisateurs
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        onboardingStep: true,
        hasCompletedOnboarding: true,
        onboardingCompletedAt: true,
        onboardingSkippedAt: true,
        completedSteps: true,
        onboardingState: true,
        viewedTooltips: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log(`📊 ${users.length} utilisateur(s) trouvé(s)\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      const userLabel = `User ${user.email || user.id}`;

      try {
        // Migrer l'utilisateur
        const migratedState = migrateUser(user);

        // Déterminer onboardingStartedAt
        const onboardingStartedAt = (user.onboardingStep > 0 && !user.onboardingCompletedAt && !user.onboardingSkippedAt)
          ? user.createdAt
          : null;

        if (isVerbose) {
          console.log(`\n🔄 ${userLabel}`);
          console.log(`   Ancien completedSteps: ${JSON.stringify(user.completedSteps)}`);
          console.log(`   Ancien viewedTooltips: ${user.viewedTooltips}`);
          console.log(`   Ancien onboardingState: ${user.onboardingState}`);
          console.log(`   → Nouveau onboardingState: ${JSON.stringify(migratedState).substring(0, 100)}...`);
          console.log(`   → onboardingStartedAt: ${onboardingStartedAt}`);
        }

        // Appliquer les changements (si pas dry-run)
        if (!isDryRun) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              onboardingState: migratedState,
              onboardingStartedAt
            }
          });
          migratedCount++;
        } else {
          migratedCount++;
        }

        if (!isVerbose) {
          process.stdout.write('.');
        }

      } catch (error) {
        console.error(`\n❌ Erreur pour ${userLabel}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n\n✅ Migration terminée !\n');
    console.log(`📈 Résultats :`);
    console.log(`   - Migrés : ${migratedCount}`);
    console.log(`   - Ignorés : ${skippedCount}`);
    console.log(`   - Erreurs : ${errorCount}`);

    if (isDryRun) {
      console.log('\n⚠️  Mode DRY RUN : Aucun changement n\'a été appliqué en base de données');
      console.log('   Pour appliquer les changements, relancez sans --dry-run');
    } else {
      console.log('\n✅ Changements appliqués en base de données');
      console.log('\n📝 Prochaines étapes :');
      console.log('   1. Vérifier les données migrées');
      console.log('   2. Créer la migration Prisma : npx prisma migrate dev --name refactor_onboarding_state');
      console.log('   3. Appliquer la migration : npx prisma migrate deploy');
    }

  } catch (error) {
    console.error('\n❌ Erreur fatale :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
main()
  .catch(error => {
    console.error('Erreur non gérée:', error);
    process.exit(1);
  });

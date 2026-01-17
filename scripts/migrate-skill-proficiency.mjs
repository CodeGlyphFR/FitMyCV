#!/usr/bin/env node
/**
 * Migration Script: Convert skill proficiency values from strings to numbers (0-5)
 *
 * This script:
 * 1. Fetches all CvFile records from the database
 * 2. Parses the content JSON
 * 3. Converts all string proficiency values to numeric values (0-5)
 * 4. Updates the CvFile records
 *
 * Run with: node scripts/migrate-skill-proficiency.mjs
 * Dry run:  node scripts/migrate-skill-proficiency.mjs --dry-run
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// All known string variants mapped to numeric levels (0-5)
const STRING_TO_LEVEL = {
  // English keys (canonical)
  awareness: 0,
  beginner: 1,
  intermediate: 2,
  proficient: 3,
  advanced: 4,
  expert: 5,

  // French variants
  notions: 0,
  notion: 0,
  connaissance: 0,
  connaissances: 0,
  débutant: 1,
  debutant: 1,
  intermédiaire: 2,
  intermediaire: 2,
  compétent: 3,
  competent: 3,
  confirmé: 3,
  confirme: 3,
  avancé: 4,
  avance: 4,
  maître: 5,
  maitre: 5,
  maîtrise: 5,
  maitrise: 5,

  // German variants
  grundkenntnisse: 0,
  anfänger: 1,
  anfanger: 1,
  mittelstufe: 2,
  kompetent: 3,
  fortgeschritten: 4,
  experte: 5,

  // Spanish variants
  conocimiento: 0,
  principiante: 1,
  intermedio: 2,
  competente: 3,
  avanzado: 4,
  experto: 5,

  // Other common variants
  basic: 0,
  basics: 0,
  bases: 0,
  familiar: 0,
  exposure: 0,
  junior: 1,
  novice: 1,
  standard: 2,
  moyen: 2,
  experienced: 3,
  experience: 3,
  solid: 3,
  senior: 5,
};

/**
 * Convert a proficiency value to a number (0-5)
 * @param {*} value - Raw proficiency value
 * @returns {number|null} - Numeric level (0-5) or null if invalid
 */
function normalizeToNumber(value) {
  // Already a valid number
  if (typeof value === 'number') {
    if (value >= 0 && value <= 5) {
      return Math.round(value);
    }
    return null;
  }

  // Null/undefined
  if (value == null) {
    return null;
  }

  // String - lookup in mapping
  if (typeof value === 'string') {
    const key = value.toLowerCase().trim();
    if (key in STRING_TO_LEVEL) {
      return STRING_TO_LEVEL[key];
    }
    // Try parsing as number
    const parsed = parseInt(key, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 5) {
      return parsed;
    }
  }

  return null;
}

/**
 * Migrate skill arrays in a CV content object
 * @param {Object} content - CV content object
 * @returns {Object} - Object with { modified: boolean, migratedContent: Object }
 */
function migrateSkillsInContent(content) {
  if (!content || typeof content !== 'object') {
    return { modified: false, migratedContent: content };
  }

  let modified = false;
  const migratedContent = JSON.parse(JSON.stringify(content)); // Deep clone

  // Migrate hard_skills
  if (migratedContent.skills?.hard_skills && Array.isArray(migratedContent.skills.hard_skills)) {
    migratedContent.skills.hard_skills = migratedContent.skills.hard_skills.map(skill => {
      if (skill && typeof skill === 'object' && skill.proficiency !== undefined) {
        const numericLevel = normalizeToNumber(skill.proficiency);
        if (numericLevel !== null && numericLevel !== skill.proficiency) {
          modified = true;
          return { ...skill, proficiency: numericLevel };
        }
      }
      return skill;
    });
  }

  // Migrate tools
  if (migratedContent.skills?.tools && Array.isArray(migratedContent.skills.tools)) {
    migratedContent.skills.tools = migratedContent.skills.tools.map(skill => {
      if (skill && typeof skill === 'object' && skill.proficiency !== undefined) {
        const numericLevel = normalizeToNumber(skill.proficiency);
        if (numericLevel !== null && numericLevel !== skill.proficiency) {
          modified = true;
          return { ...skill, proficiency: numericLevel };
        }
      }
      return skill;
    });
  }

  return { modified, migratedContent };
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('========================================');
  console.log('Skill Proficiency Migration Script');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('========================================\n');

  try {
    // Fetch all CvFile records
    console.log('Fetching all CvFile records...');
    const cvFiles = await prisma.cvFile.findMany({
      select: {
        id: true,
        filename: true,
        userId: true,
        content: true,
      },
    });

    console.log(`Found ${cvFiles.length} CV files to process.\n`);

    let totalProcessed = 0;
    let totalModified = 0;
    let totalSkillsMigrated = 0;
    const errors = [];

    for (const cvFile of cvFiles) {
      totalProcessed++;

      try {
        // Parse content JSON
        let content;
        if (typeof cvFile.content === 'string') {
          content = JSON.parse(cvFile.content);
        } else {
          content = cvFile.content;
        }

        // Migrate skills
        const { modified, migratedContent } = migrateSkillsInContent(content);

        if (modified) {
          totalModified++;

          // Count migrated skills for logging
          const hardSkillsBefore = content.skills?.hard_skills?.length || 0;
          const toolsBefore = content.skills?.tools?.length || 0;
          totalSkillsMigrated += hardSkillsBefore + toolsBefore;

          console.log(`[${totalProcessed}/${cvFiles.length}] Migrating: ${cvFile.filename} (ID: ${cvFile.id})`);

          if (!isDryRun) {
            // Update the CvFile record
            await prisma.cvFile.update({
              where: { id: cvFile.id },
              data: { content: migratedContent },
            });
            console.log(`  -> Updated successfully`);
          } else {
            console.log(`  -> Would update (dry run)`);
          }
        }
      } catch (err) {
        errors.push({ id: cvFile.id, filename: cvFile.filename, error: err.message });
        console.error(`[ERROR] Failed to process ${cvFile.filename} (ID: ${cvFile.id}): ${err.message}`);
      }
    }

    // Summary
    console.log('\n========================================');
    console.log('Migration Summary');
    console.log('========================================');
    console.log(`Total CV files processed: ${totalProcessed}`);
    console.log(`Total CV files modified: ${totalModified}`);
    console.log(`Approximate skills migrated: ${totalSkillsMigrated}`);
    if (errors.length > 0) {
      console.log(`Errors encountered: ${errors.length}`);
      console.log('Failed files:');
      errors.forEach(e => console.log(`  - ${e.filename} (ID: ${e.id}): ${e.error}`));
    }

    if (isDryRun) {
      console.log('\nThis was a DRY RUN. No changes were made to the database.');
      console.log('Run without --dry-run to apply changes.');
    } else {
      console.log('\nMigration completed successfully!');
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

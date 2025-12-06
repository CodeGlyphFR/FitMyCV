#!/usr/bin/env node
/**
 * Migration Script: Clean CV Metadata
 *
 * This script removes metadata fields from existing CV JSON content
 * that should only be stored in the CvFile database table:
 * - language (now in CvFile.language)
 * - generated_at (now in CvFile.createdAt)
 * - order_hint (now from Settings cv_section_order)
 * - section_titles (now calculated via getSectionTitles(language))
 * - meta (various metadata now in CvFile.*)
 *
 * Usage:
 *   node scripts/clean-cv-metadata.js --dry-run   # Preview changes without saving
 *   node scripts/clean-cv-metadata.js             # Apply changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Metadata fields to remove from CV JSON
const METADATA_FIELDS = ['language', 'generated_at', 'order_hint', 'section_titles', 'meta'];

// Valid content sections that should remain
const VALID_SECTIONS = ['header', 'summary', 'skills', 'experience', 'education', 'languages', 'extras', 'projects'];

async function cleanCvMetadata(dryRun = false) {
  console.log('='.repeat(60));
  console.log('CV Metadata Cleanup Migration');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be saved)' : 'LIVE (changes will be applied)'}`);
  console.log('');

  try {
    // Fetch all CV files
    const cvFiles = await prisma.cvFile.findMany({
      select: {
        id: true,
        userId: true,
        filename: true,
        content: true,
        language: true,
      },
    });

    console.log(`Found ${cvFiles.length} CV file(s) to process`);
    console.log('');

    let cleanedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const cvFile of cvFiles) {
      const { id, userId, filename, content, language } = cvFile;

      try {
        if (!content || typeof content !== 'object') {
          console.log(`  [SKIP] ${filename} (user: ${userId.slice(0, 8)}...) - No content or invalid format`);
          skippedCount++;
          continue;
        }

        // Check if any metadata fields exist
        const foundMetadata = METADATA_FIELDS.filter(field => field in content);

        if (foundMetadata.length === 0) {
          console.log(`  [OK] ${filename} (user: ${userId.slice(0, 8)}...) - Already clean`);
          skippedCount++;
          continue;
        }

        console.log(`  [CLEAN] ${filename} (user: ${userId.slice(0, 8)}...)`);
        console.log(`          Removing: ${foundMetadata.join(', ')}`);

        // Extract language from JSON if not already in DB
        const jsonLanguage = content.language;
        const shouldUpdateLanguage = !language && jsonLanguage;

        if (shouldUpdateLanguage) {
          console.log(`          Setting CvFile.language to: ${jsonLanguage}`);
        }

        // Create cleaned content (only valid sections)
        const cleanedContent = {};
        for (const section of VALID_SECTIONS) {
          if (section in content) {
            cleanedContent[section] = content[section];
          }
        }

        // Log removed fields for transparency
        const removedFields = Object.keys(content).filter(
          key => !VALID_SECTIONS.includes(key) && key in content
        );
        if (removedFields.length > 0) {
          console.log(`          Removed fields: ${removedFields.join(', ')}`);
        }

        // Update database if not dry run
        if (!dryRun) {
          const updateData = {
            content: cleanedContent,
            updatedAt: new Date(),
          };

          // Also set language in DB if it was in JSON and DB is empty
          if (shouldUpdateLanguage) {
            updateData.language = jsonLanguage;
          }

          await prisma.cvFile.update({
            where: { id },
            data: updateData,
          });
        }

        cleanedCount++;
      } catch (error) {
        console.error(`  [ERROR] ${filename} (user: ${userId.slice(0, 8)}...) - ${error.message}`);
        errorCount++;
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Summary:');
    console.log(`  - Cleaned: ${cleanedCount} CV(s)`);
    console.log(`  - Skipped: ${skippedCount} CV(s) (already clean or no content)`);
    console.log(`  - Errors:  ${errorCount} CV(s)`);
    console.log('='.repeat(60));

    if (dryRun && cleanedCount > 0) {
      console.log('');
      console.log('This was a DRY RUN. To apply changes, run:');
      console.log('  node scripts/clean-cv-metadata.js');
    }

    return { cleanedCount, skippedCount, errorCount };
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-n');

// Run migration
cleanCvMetadata(dryRun)
  .then(({ cleanedCount, skippedCount, errorCount }) => {
    process.exit(errorCount > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

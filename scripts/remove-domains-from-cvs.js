#!/usr/bin/env node
/**
 * Migration Script: Remove summary.domains from CVs
 *
 * This script removes the obsolete `domains` field from the summary section
 * of all existing CVs (CvFile and CvVersion tables).
 *
 * The `domains` field was part of the summary but is no longer used.
 *
 * Usage:
 *   node scripts/remove-domains-from-cvs.js --dry-run   # Preview changes without saving
 *   node scripts/remove-domains-from-cvs.js             # Apply changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function removeDomains(dryRun = false) {
  console.log('='.repeat(60));
  console.log('Remove summary.domains Migration');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be saved)' : 'LIVE (changes will be applied)'}`);
  console.log('');

  try {
    let cvFilesCleaned = 0;
    let cvFilesSkipped = 0;
    let cvVersionsCleaned = 0;
    let cvVersionsSkipped = 0;
    let errorCount = 0;

    // =============================================
    // 1. Process CvFile table
    // =============================================
    console.log('Processing CvFile table...');
    console.log('');

    const cvFiles = await prisma.cvFile.findMany({
      select: {
        id: true,
        userId: true,
        filename: true,
        content: true,
      },
    });

    console.log(`Found ${cvFiles.length} CV file(s) to check`);

    for (const cvFile of cvFiles) {
      const { id, userId, filename, content } = cvFile;

      try {
        if (!content || typeof content !== 'object') {
          cvFilesSkipped++;
          continue;
        }

        // Check if summary.domains exists
        if (content.summary?.domains === undefined) {
          cvFilesSkipped++;
          continue;
        }

        const domainsCount = Array.isArray(content.summary.domains) ? content.summary.domains.length : 0;
        console.log(`  [CLEAN] ${filename} (user: ${userId.slice(0, 8)}...) - Removing ${domainsCount} domain(s)`);

        // Remove domains from summary
        const { domains, ...restSummary } = content.summary;
        const cleanedContent = {
          ...content,
          summary: restSummary,
        };

        // Update database if not dry run
        if (!dryRun) {
          await prisma.cvFile.update({
            where: { id },
            data: {
              content: cleanedContent,
              updatedAt: new Date(),
            },
          });
        }

        cvFilesCleaned++;
      } catch (error) {
        console.error(`  [ERROR] ${filename} (user: ${userId.slice(0, 8)}...) - ${error.message}`);
        errorCount++;
      }
    }

    console.log('');

    // =============================================
    // 2. Process CvVersion table
    // =============================================
    console.log('Processing CvVersion table...');
    console.log('');

    const cvVersions = await prisma.cvVersion.findMany({
      select: {
        id: true,
        cvFileId: true,
        version: true,
        content: true,
      },
    });

    console.log(`Found ${cvVersions.length} CV version(s) to check`);

    for (const cvVersion of cvVersions) {
      const { id, cvFileId, version, content } = cvVersion;

      try {
        if (!content || typeof content !== 'object') {
          cvVersionsSkipped++;
          continue;
        }

        // Check if summary.domains exists
        if (content.summary?.domains === undefined) {
          cvVersionsSkipped++;
          continue;
        }

        const domainsCount = Array.isArray(content.summary.domains) ? content.summary.domains.length : 0;
        console.log(`  [CLEAN] CvFile ${cvFileId.slice(0, 8)}... v${version} - Removing ${domainsCount} domain(s)`);

        // Remove domains from summary
        const { domains, ...restSummary } = content.summary;
        const cleanedContent = {
          ...content,
          summary: restSummary,
        };

        // Update database if not dry run
        if (!dryRun) {
          await prisma.cvVersion.update({
            where: { id },
            data: {
              content: cleanedContent,
            },
          });
        }

        cvVersionsCleaned++;
      } catch (error) {
        console.error(`  [ERROR] CvVersion ${id} - ${error.message}`);
        errorCount++;
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Summary:');
    console.log(`  CvFile:`);
    console.log(`    - Cleaned: ${cvFilesCleaned} CV(s)`);
    console.log(`    - Skipped: ${cvFilesSkipped} CV(s) (no domains or no content)`);
    console.log(`  CvVersion:`);
    console.log(`    - Cleaned: ${cvVersionsCleaned} version(s)`);
    console.log(`    - Skipped: ${cvVersionsSkipped} version(s) (no domains or no content)`);
    console.log(`  Errors: ${errorCount}`);
    console.log('='.repeat(60));

    if (dryRun && (cvFilesCleaned > 0 || cvVersionsCleaned > 0)) {
      console.log('');
      console.log('This was a DRY RUN. To apply changes, run:');
      console.log('  node scripts/remove-domains-from-cvs.js');
    }

    return { cvFilesCleaned, cvFilesSkipped, cvVersionsCleaned, cvVersionsSkipped, errorCount };
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
removeDomains(dryRun)
  .then(({ errorCount }) => {
    process.exit(errorCount > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

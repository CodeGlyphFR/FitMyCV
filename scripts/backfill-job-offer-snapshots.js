/**
 * Backfill script: Populate jobOfferSnapshot for existing CVs
 *
 * This script finds all CvFiles that have a jobOfferId but no jobOfferSnapshot,
 * and copies the JobOffer data into the snapshot field for autonomy.
 *
 * Usage: node scripts/backfill-job-offer-snapshots.js [--dry-run]
 *
 * Options:
 *   --dry-run  Show what would be changed without making changes
 */

const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

async function backfillSnapshots(isDryRun) {
  console.log('\n📋 Finding CVs with jobOfferId but no jobOfferSnapshot...');
  console.log('────────────────────────────────────────────────────────────');

  // Find all CVs that have a jobOfferId but no snapshot
  // For JSON fields, we need to use Prisma.DbNull for null comparison
  const cvsToBackfill = await prisma.cvFile.findMany({
    where: {
      jobOfferId: { not: null },
      jobOfferSnapshot: { equals: Prisma.DbNull },
    },
    select: {
      id: true,
      filename: true,
      jobOfferId: true,
      jobOffer: {
        select: {
          sourceType: true,
          sourceValue: true,
          extractedAt: true,
          content: true,
        },
      },
    },
  });

  console.log(`\n📊 Found ${cvsToBackfill.length} CV(s) to backfill\n`);

  if (cvsToBackfill.length === 0) {
    console.log('  ✅ Nothing to do - all CVs already have snapshots or no jobOffer');
    return { total: 0, updated: 0, skipped: 0, orphaned: 0 };
  }

  let updated = 0;
  let skipped = 0;
  let orphaned = 0;

  for (const cv of cvsToBackfill) {
    const shortFilename = cv.filename.length > 50
      ? cv.filename.substring(0, 47) + '...'
      : cv.filename;

    if (!cv.jobOffer) {
      // JobOffer has been deleted - this CV is orphaned
      console.log(`  ⚠️  ${shortFilename}`);
      console.log(`      └─ JobOffer ${cv.jobOfferId} no longer exists (orphaned)`);
      orphaned++;
      continue;
    }

    if (!cv.jobOffer.content) {
      // JobOffer exists but has no content (shouldn't happen)
      console.log(`  ⚠️  ${shortFilename}`);
      console.log(`      └─ JobOffer has no content (skipped)`);
      skipped++;
      continue;
    }

    const snapshot = {
      sourceType: cv.jobOffer.sourceType || 'url',
      sourceValue: cv.jobOffer.sourceValue,
      extractedAt: cv.jobOffer.extractedAt
        ? new Date(cv.jobOffer.extractedAt).toISOString()
        : new Date().toISOString(),
      content: cv.jobOffer.content,
    };

    if (isDryRun) {
      console.log(`  📋 ${shortFilename}`);
      console.log(`      └─ Would copy snapshot from JobOffer (${cv.jobOffer.sourceType}: ${cv.jobOffer.sourceValue?.substring(0, 40)}...)`);
    } else {
      await prisma.cvFile.update({
        where: { id: cv.id },
        data: { jobOfferSnapshot: snapshot },
      });
      console.log(`  ✅ ${shortFilename}`);
      console.log(`      └─ Snapshot created from JobOffer`);
    }
    updated++;
  }

  return {
    total: cvsToBackfill.length,
    updated,
    skipped,
    orphaned,
  };
}

async function showStats() {
  console.log('\n📊 Current database state:');
  console.log('────────────────────────────────────────────────────────────');

  const totalCvs = await prisma.cvFile.count();
  const withJobOffer = await prisma.cvFile.count({
    where: { jobOfferId: { not: null } },
  });
  const withSnapshot = await prisma.cvFile.count({
    where: { NOT: { jobOfferSnapshot: { equals: Prisma.DbNull } } },
  });
  const withBoth = await prisma.cvFile.count({
    where: {
      jobOfferId: { not: null },
      NOT: { jobOfferSnapshot: { equals: Prisma.DbNull } },
    },
  });
  const needsBackfill = await prisma.cvFile.count({
    where: {
      jobOfferId: { not: null },
      jobOfferSnapshot: { equals: Prisma.DbNull },
    },
  });

  console.log(`  Total CVs:              ${totalCvs}`);
  console.log(`  With jobOfferId:        ${withJobOffer}`);
  console.log(`  With jobOfferSnapshot:  ${withSnapshot}`);
  console.log(`  With both:              ${withBoth}`);
  console.log(`  Needs backfill:         ${needsBackfill}`);
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('\n🔄 Backfill: Populate jobOfferSnapshot for existing CVs');
  console.log('════════════════════════════════════════════════════════════');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
  }

  // Show current stats
  await showStats();

  // Run backfill
  const result = await backfillSnapshots(isDryRun);

  console.log('\n════════════════════════════════════════════════════════════');

  if (isDryRun) {
    console.log('📋 Dry run complete. Run without --dry-run to apply changes.');
    console.log(`   - Would update: ${result.updated} CV(s)`);
    console.log(`   - Skipped (no content): ${result.skipped}`);
    console.log(`   - Orphaned (JobOffer deleted): ${result.orphaned}\n`);
  } else {
    console.log(`✨ Backfill complete!`);
    console.log(`   - Updated: ${result.updated} CV(s)`);
    console.log(`   - Skipped (no content): ${result.skipped}`);
    console.log(`   - Orphaned (JobOffer deleted): ${result.orphaned}\n`);

    // Show updated stats
    if (result.updated > 0) {
      await showStats();
      console.log('');
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

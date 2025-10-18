#!/usr/bin/env node

/**
 * Cleanup inactive sessions
 * Closes sessions that have been inactive for more than 10 minutes
 *
 * Usage:
 *   node scripts/cleanup-sessions.mjs
 *
 * Can be scheduled with cron (every 5 minutes):
 *   star-slash-5 star star star star cd /path/to/cv-site && node scripts/cleanup-sessions.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupInactiveSessions() {
  console.log('[Cleanup] Starting session cleanup...');

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

    // Find sessions that are still open but inactive for > 10 minutes
    const inactiveSessions = await prisma.userSession.findMany({
      where: {
        endedAt: null,
        lastActivityAt: { lt: tenMinutesAgo },
      },
      select: {
        id: true,
        userId: true,
        lastActivityAt: true,
      },
    });

    if (inactiveSessions.length === 0) {
      console.log('[Cleanup] No inactive sessions found');
      return { closed: 0, total: 0 };
    }

    console.log(`[Cleanup] Found ${inactiveSessions.length} inactive sessions`);

    // Close all inactive sessions
    const result = await prisma.userSession.updateMany({
      where: {
        id: { in: inactiveSessions.map(s => s.id) },
      },
      data: {
        endedAt: new Date(),
      },
    });

    console.log(`[Cleanup] ✅ Closed ${result.count} inactive sessions`);

    // Show some details
    const userCounts = inactiveSessions.reduce((acc, s) => {
      acc[s.userId] = (acc[s.userId] || 0) + 1;
      return acc;
    }, {});

    console.log('[Cleanup] Sessions per user:');
    Object.entries(userCounts).forEach(([userId, count]) => {
      console.log(`  - User ${userId}: ${count} session(s)`);
    });

    return { closed: result.count, total: inactiveSessions.length };
  } catch (err) {
    console.error('[Cleanup] ❌ Error:', err);
    return { closed: 0, total: 0, error: err.message };
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupInactiveSessions()
  .then(result => {
    if (result.error) {
      console.error('[Cleanup] Failed with error:', result.error);
      process.exit(1);
    } else {
      console.log(`[Cleanup] Done: ${result.closed}/${result.total} sessions closed`);
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('[Cleanup] Unexpected error:', err);
    process.exit(1);
  });

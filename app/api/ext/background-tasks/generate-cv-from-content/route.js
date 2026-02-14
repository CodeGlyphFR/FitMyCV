/**
 * POST /api/ext/background-tasks/generate-cv-from-content
 *
 * Accept pre-extracted job offer content from the browser extension.
 * Creates tasks immediately (like the SaaS URL flow) and delegates
 * AI extraction to the job queue for parallel processing.
 *
 * Body JSON:
 * {
 *   "baseFile": "filename.json",
 *   "offers": [{ "title": "...", "content": "...", "sourceUrl": "https://..." }],
 *   "deviceId": "ext-uuid",
 *   "userInterfaceLanguage": "fr"
 * }
 */

import { NextResponse } from 'next/server';
import { withExtensionAuth } from '@/lib/api/withExtensionAuth';
import prisma from '@/lib/prisma';
import { registerTaskTypeStart, enqueueJob } from '@/lib/background-jobs/jobQueue';
import { startSingleOfferGeneration } from '@/lib/features/cv-adaptation';
import { incrementFeatureCounter, refundFeatureUsage } from '@/lib/subscription/featureUsage';
import { ExtensionErrors, CommonErrors } from '@/lib/api/apiErrors';

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'extension';
  }
}

export const POST = withExtensionAuth(async (request, { userId }) => {
  try {
    const body = await request.json();
    const { baseFile, offers, deviceId = 'ext-unknown', userInterfaceLanguage = 'fr' } = body || {};

    // Validate input
    if (!baseFile || typeof baseFile !== 'string') {
      return ExtensionErrors.baseFileRequired();
    }

    if (!Array.isArray(offers) || offers.length === 0) {
      return ExtensionErrors.offersRequired();
    }

    // Validate each offer
    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      if (!offer?.content || typeof offer.content !== 'string' || offer.content.trim().length < 50) {
        return ExtensionErrors.offerContentInsufficient(i);
      }
    }

    // Verify the source CV exists
    const cvFile = await prisma.cvFile.findUnique({
      where: { userId_filename: { userId, filename: baseFile } },
      select: { id: true, filename: true },
    });

    if (!cvFile) {
      return ExtensionErrors.sourceCvNotFound();
    }

    const totalOffers = offers.length;

    // Debit credits for all offers upfront
    const usageResults = [];
    for (let i = 0; i < totalOffers; i++) {
      const usageResult = await incrementFeatureCounter(userId, 'gpt_cv_generation');

      if (!usageResult.success) {
        // Refund previously debited credits
        for (const prev of usageResults) {
          if (prev.transactionId) {
            await refundFeatureUsage(prev.transactionId);
          }
        }

        return NextResponse.json({
          error: usageResult.error,
          actionRequired: usageResult.actionRequired,
          redirectUrl: usageResult.redirectUrl,
        }, { status: 403 });
      }

      usageResults.push(usageResult);
    }

    // Create tasks for each offer (extraction deferred to job queue)
    let createdTasks;
    try {
      createdTasks = await createTasksForOffers(offers, usageResults, userId, cvFile, deviceId, totalOffers, userInterfaceLanguage);
    } catch (taskError) {
      // Refund all debited credits if task creation fails
      console.error('[generate-cv-from-content] Task creation failed, refunding credits:', taskError.message);
      for (const prev of usageResults) {
        if (prev.transactionId) {
          try { await refundFeatureUsage(prev.transactionId); } catch { /* best effort */ }
        }
      }
      throw taskError;
    }

    console.log(`[generate-cv-from-content] ${createdTasks.length} task(s) created for user ${userId}`);

    return NextResponse.json({
      success: true,
      queued: true,
      tasks: createdTasks,
      totalTasks: createdTasks.length,
    }, { status: 202 });

  } catch (error) {
    console.error('[generate-cv-from-content] Error:', error);
    return CommonErrors.serverError();
  }
});

async function createTasksForOffers(offers, usageResults, userId, cvFile, deviceId, totalOffers, userInterfaceLanguage) {
  const createdTasks = [];

  for (let i = 0; i < offers.length; i++) {
    const offerData = offers[i];
    const usageResult = usageResults[i];
    const rawTitle = offerData.title || extractDomain(offerData.sourceUrl || '');
    const sourceUrl = offerData.sourceUrl || '';

    const task = await prisma.cvGenerationTask.create({
      data: {
        userId,
        sourceCvFileId: cvFile.id,
        mode: 'adapt',
        status: 'pending',
        totalOffers: 1,
        completedOffers: 0,
        creditsDebited: usageResult.usedCredit ? 1 : 0,
        creditsRefunded: 0,
      },
    });

    const offer = await prisma.cvGenerationOffer.create({
      data: {
        taskId: task.id,
        sourceUrl: sourceUrl || `extension://${task.id}`,
        jobOfferId: null, // Will be set after extraction in the job queue
        offerIndex: 0,
        status: 'pending',
      },
    });

    await prisma.backgroundTask.create({
      data: {
        id: task.id,
        userId,
        type: 'cv_generation',
        title: rawTitle,
        status: 'queued',
        createdAt: BigInt(Date.now() + i),
        shouldUpdateCvList: true,
        deviceId,
        payload: JSON.stringify({
          taskId: task.id,
          offerId: offer.id,
          sourceCvFile: cvFile.filename,
          url: sourceUrl,
          offerIndex: i,
          totalOffersInBatch: totalOffers,
          userInterfaceLanguage,
          fromExtension: true,
          markdownContent: offerData.content,
          markdownTitle: rawTitle,
        }),
      },
    });

    registerTaskTypeStart(userId, 'cv_generation');
    enqueueJob(() => startSingleOfferGeneration(task.id, offer.id));

    createdTasks.push({
      taskId: task.id,
      offerId: offer.id,
      title: rawTitle,
      sourceUrl,
    });

    console.log(`[generate-cv-from-content] Task ${task.id} queued for extension offer: ${rawTitle}`);
  }

  return createdTasks;
}

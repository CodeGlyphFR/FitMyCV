import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import prisma from '@/lib/prisma';
import { CommonErrors, apiError } from '@/lib/api/apiErrors';
import { applySelectiveChanges } from '@/lib/cv-pipeline-v2/applySelectiveChanges';
import { createCvVersionWithTracking } from '@/lib/cv/versioning';
import dbEmitter from '@/lib/events/dbEmitter';
import { trackCvChangesReviewed } from '@/lib/telemetry/server';
import { hasConsentForCategory } from '@/lib/cookies/consentLogger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cv/apply-review
 *
 * Applique les modifications acceptées/rejetées au CV généré.
 * Crée une nouvelle version avec origin 'user_review'.
 *
 * Body:
 * - offerId: ID de la CvGenerationOffer
 * - decisions: Map { "section:index:field": "accepted"|"rejected" }
 */
export async function POST(request) {
  try {
    // Vérifier l'authentification
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const userId = session.user.id;
    const body = await request.json();
    const { offerId, decisions } = body;

    if (!offerId) {
      return apiError({
        error: 'missing_offer_id',
        message: 'offerId is required',
        status: 400,
      });
    }

    if (!decisions || typeof decisions !== 'object') {
      return apiError({
        error: 'invalid_decisions',
        message: 'decisions map is required',
        status: 400,
      });
    }

    // Récupérer l'offre de génération avec le CV généré et le CV source
    const offer = await prisma.cvGenerationOffer.findUnique({
      where: { id: offerId },
      select: {
        id: true,
        jobOfferId: true,
        batchResults: true,
        generatedCvFileId: true,
        generatedCvFileName: true,
        task: {
          select: {
            id: true,
            userId: true,
            sourceCvFileId: true,
            sourceCvFile: {
              select: {
                filename: true,
                content: true,
              },
            },
          },
        },
      },
    });

    if (!offer) {
      return apiError({
        error: 'offer_not_found',
        message: 'CvGenerationOffer not found',
        status: 404,
      });
    }

    // Vérifier que l'utilisateur est propriétaire
    if (offer.task.userId !== userId) {
      return CommonErrors.forbidden();
    }

    // Vérifier que le CV a été généré
    if (!offer.generatedCvFileId) {
      return apiError({
        error: 'cv_not_generated',
        message: 'CV has not been generated yet',
        status: 400,
      });
    }

    // Récupérer le CV généré
    const generatedCvFile = await prisma.cvFile.findUnique({
      where: { id: offer.generatedCvFileId },
      select: {
        id: true,
        filename: true,
        content: true,
        contentVersion: true,
      },
    });

    if (!generatedCvFile) {
      return apiError({
        error: 'generated_cv_not_found',
        message: 'Generated CV file not found',
        status: 404,
      });
    }

    // Récupérer le titre de l'offre d'emploi
    let jobOfferTitle = null;
    if (offer.jobOfferId) {
      const jobOffer = await prisma.jobOffer.findUnique({
        where: { id: offer.jobOfferId },
        select: { title: true },
      });
      jobOfferTitle = jobOffer?.title;
    }

    // Récupérer les données nécessaires
    const sourceCv = offer.task.sourceCvFile?.content;
    const batchResults = offer.batchResults || {};

    if (!sourceCv) {
      return apiError({
        error: 'source_cv_not_found',
        message: 'Source CV not found',
        status: 400,
      });
    }

    // Appliquer les changements sélectifs
    const { cv: finalCv, stats } = applySelectiveChanges({
      sourceCv,
      batchResults,
      decisions,
      jobOffer: { title: jobOfferTitle },
    });

    // Créer une version avant modification (sauvegarde de l'état actuel)
    await createCvVersionWithTracking(
      userId,
      generatedCvFile.filename,
      `Review utilisateur: ${stats.accepted} acceptées, ${stats.rejected} refusées`,
      'review',
      offer.task.sourceCvFile?.filename
    );

    // Mettre à jour le CvFile avec le contenu final
    await prisma.cvFile.update({
      where: { id: generatedCvFile.id },
      data: {
        content: finalCv,
        // Réinitialiser les scores car le contenu a changé
        matchScore: null,
        matchScoreUpdatedAt: null,
        scoreBreakdown: null,
        improvementSuggestions: null,
        missingSkills: null,
        matchingSkills: null,
      },
    });

    // Mettre à jour l'offre avec les informations de review dans batchResults
    const updatedBatchResults = {
      ...batchResults,
      review: {
        decisions,
        stats,
        reviewedAt: new Date().toISOString(),
      },
    };

    await prisma.cvGenerationOffer.update({
      where: { id: offerId },
      data: {
        batchResults: updatedBatchResults,
      },
    });

    // Émettre un événement SSE pour la mise à jour du CV
    dbEmitter.emitCvUpdate(generatedCvFile.filename, userId, {
      action: 'reviewed',
      stats,
    });

    // Télémétrie CV_CHANGES_REVIEWED (Story 5.2)
    // Vérifier le consentement analytics avant d'envoyer l'event
    const hasAnalyticsConsent = await hasConsentForCategory(userId, 'analytics');
    if (hasAnalyticsConsent) {
      await trackCvChangesReviewed({
        userId,
        taskId: offer.task?.id,
        offerId,
        stats: {
          total: stats.total,
          accepted: stats.accepted,
          rejected: stats.rejected,
        },
      });
    }

    return NextResponse.json({
      success: true,
      cvFileId: generatedCvFile.id,
      filename: generatedCvFile.filename,
      stats,
    });
  } catch (error) {
    console.error('[API /cv/apply-review] Error:', error);
    return apiError({
      error: 'apply_review_error',
      message: error.message || 'Failed to apply review',
      status: 500,
    });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/session';
import { getReviewState, processReviewAction, processBatchReviewAction } from '@/lib/cv-core/changeTracking';
import { CommonErrors } from '@/lib/api/apiErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cvs/changes?file=xxx.json
 * Récupère l'état de review des modifications d'un CV
 *
 * Response:
 * {
 *   filename: "xxx.json",
 *   pendingChanges: [...],
 *   pendingSourceVersion: 1,
 *   progress: { total, reviewed, pending, percentComplete }
 * }
 */
export async function GET(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');

    if (!filename) {
      return NextResponse.json(
        { error: 'errors.api.cv.missingFilename' },
        { status: 400 }
      );
    }

    const reviewState = await getReviewState(session.user.id, filename);

    console.log(`[API /cvs/changes] GET ${filename}: reviewState=${reviewState ? `${reviewState.pendingChanges?.length || 0} changes` : 'null'}`);

    if (!reviewState) {
      return NextResponse.json({
        filename,
        pendingChanges: [],
        pendingSourceVersion: null,
        progress: { total: 0, reviewed: 0, pending: 0, percentComplete: 100 },
      });
    }

    return NextResponse.json({
      filename,
      ...reviewState,
    });
  } catch (error) {
    console.error('[changes] GET Error:', error);
    return NextResponse.json(
      { error: 'errors.api.common.serverError' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cvs/changes
 * Traite une action de review (accept/reject) sur une ou plusieurs modifications
 *
 * Body (single):
 * {
 *   filename: "xxx.json",
 *   changeId: "change_abc123",
 *   action: "accept" | "reject"
 * }
 *
 * Body (batch):
 * {
 *   filename: "xxx.json",
 *   changeIds: ["change_abc123", "change_def456", ...],
 *   action: "accept" | "reject"
 * }
 *
 * Response:
 * {
 *   success: true,
 *   updatedChanges: [...],
 *   cvUpdated: boolean,
 *   allReviewed: boolean,
 *   progress: { total, reviewed, pending, percentComplete }
 * }
 */
export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return CommonErrors.notAuthenticated();
    }

    const body = await request.json();
    const { filename, changeId, changeIds, action } = body;

    // Validation des paramètres
    if (!filename) {
      return NextResponse.json(
        { error: 'errors.api.cv.missingFilename' },
        { status: 400 }
      );
    }

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'errors.api.cv.invalidAction' },
        { status: 400 }
      );
    }

    // Mode batch si changeIds est fourni
    if (changeIds && Array.isArray(changeIds) && changeIds.length > 0) {
      console.log(`[API /cvs/changes] Batch ${action} for ${changeIds.length} changes on ${filename}`);

      const result = await processBatchReviewAction(
        session.user.id,
        filename,
        changeIds,
        action
      );

      return NextResponse.json(result);
    }

    // Mode single (rétrocompatibilité)
    if (!changeId) {
      return NextResponse.json(
        { error: 'errors.api.cv.missingChangeId' },
        { status: 400 }
      );
    }

    const result = await processReviewAction(
      session.user.id,
      filename,
      changeId,
      action
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[changes] POST Error:', error);

    // Erreurs métier connues
    if (error.message.includes('No pending changes')) {
      return NextResponse.json(
        { error: 'errors.api.cv.noPendingChanges' },
        { status: 404 }
      );
    }

    if (error.message.includes('Change not found')) {
      return NextResponse.json(
        { error: 'errors.api.cv.changeNotFound' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'errors.api.common.serverError' },
      { status: 500 }
    );
  }
}

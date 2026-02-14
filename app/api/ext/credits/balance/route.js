/**
 * GET /api/ext/credits/balance
 *
 * Extension proxy for credit balance.
 */

import { withExtensionAuth } from '@/lib/api/withExtensionAuth';
import { getCreditBalance } from '@/lib/subscription/credits';
import { CommonErrors } from '@/lib/api/apiErrors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withExtensionAuth(async (request, { userId }) => {
  try {
    const balance = await getCreditBalance(userId);
    return Response.json(balance);
  } catch (error) {
    console.error('[ext/credits/balance] Error:', error);
    return CommonErrors.serverError();
  }
});

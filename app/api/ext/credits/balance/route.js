/**
 * GET /api/ext/credits/balance
 *
 * Extension proxy for credit balance.
 */

import { NextResponse } from 'next/server';
import { withExtensionAuth } from '@/lib/api/withExtensionAuth';
import { getCreditBalance } from '@/lib/subscription/credits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withExtensionAuth(async (request, { userId }) => {
  try {
    const balance = await getCreditBalance(userId);
    return NextResponse.json(balance);
  } catch (error) {
    console.error('[ext/credits/balance] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credit balance' },
      { status: 500 }
    );
  }
});

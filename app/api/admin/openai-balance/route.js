import { NextResponse } from 'next/server';

// Simple in-memory cache
let cachedBalance = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/admin/openai-balance
 * Returns the current OpenAI account balance
 *
 * Supports two types of accounts:
 * 1. Pay-as-you-go: Uses credit_grants to get prepaid credit balance
 * 2. Monthly subscription: Uses hard_limit - current_month_usage
 */
export async function GET() {
  try {
    // Check cache first
    if (cachedBalance !== null && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION_MS) {
      return NextResponse.json({
        success: true,
        balance: cachedBalance,
        cached: true,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // ===== OPTION 1: Try credit_grants first (Pay-as-you-go accounts) =====
    try {
      const creditGrantsResponse = await fetch('https://api.openai.com/v1/dashboard/billing/credit_grants', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (creditGrantsResponse.ok) {
        const creditGrantsData = await creditGrantsResponse.json();
        let totalBalance = 0;

        if (creditGrantsData.data && Array.isArray(creditGrantsData.data)) {
          const now = Date.now() / 1000; // Current time in seconds

          for (const grant of creditGrantsData.data) {
            // Only count grants that are still valid (not expired)
            const expiresAt = grant.expires_at || Infinity;

            if (expiresAt > now || expiresAt === null) {
              const grantAmount = grant.grant_amount || 0;
              const usedAmount = grant.used_amount || 0;
              const remaining = grantAmount - usedAmount;

              if (remaining > 0) {
                totalBalance += remaining;
              }
            }
          }
        }

        // Cache and return
        cachedBalance = totalBalance;
        cacheTimestamp = Date.now();

        return NextResponse.json({
          success: true,
          balance: totalBalance,
          cached: false,
          accountType: 'pay-as-you-go',
        });
      }
      // Credit grants not available, fall through to subscription method
    } catch (creditError) {
      // Credit grants error, fall through to subscription method
    }

    // ===== OPTION 2: Fallback to subscription/usage (Monthly subscription accounts) =====

    // Get subscription info (hard limit)
    const subscriptionResponse = await fetch('https://api.openai.com/v1/dashboard/billing/subscription', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!subscriptionResponse.ok) {
      // Return null balance if billing API not accessible (not a critical error)
      return NextResponse.json({
        success: true,
        balance: null,
        error: `Billing API not accessible (${subscriptionResponse.status})`,
      });
    }

    const subscriptionData = await subscriptionResponse.json();
    const hardLimit = subscriptionData.hard_limit_usd || 0;

    // Get current month usage
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // Last day of current month

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const usageResponse = await fetch(
      `https://api.openai.com/v1/dashboard/billing/usage?start_date=${startDateStr}&end_date=${endDateStr}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!usageResponse.ok) {
      // Fallback: return hard limit as balance if we can't get usage
      const fallbackBalance = hardLimit;
      cachedBalance = fallbackBalance;
      cacheTimestamp = Date.now();

      return NextResponse.json({
        success: true,
        balance: fallbackBalance,
        cached: false,
        warning: 'Could not fetch usage, showing hard limit',
      });
    }

    const usageData = await usageResponse.json();
    const totalUsage = (usageData.total_usage || 0) / 100; // Convert from cents to dollars

    // Calculate remaining balance
    const remainingBalance = Math.max(0, hardLimit - totalUsage);

    // Cache the result
    cachedBalance = remainingBalance;
    cacheTimestamp = Date.now();

    return NextResponse.json({
      success: true,
      balance: remainingBalance,
      cached: false,
      accountType: 'monthly-subscription',
      details: {
        hardLimit,
        totalUsage,
      },
    });
  } catch (error) {
    // Return graceful error - don't fail the whole dashboard
    return NextResponse.json({
      success: true,
      balance: null,
      error: error.message,
    });
  }
}

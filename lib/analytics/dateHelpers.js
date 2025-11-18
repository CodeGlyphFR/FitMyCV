/**
 * Date utility functions for analytics
 * Centralizes common date calculations used across analytics routes
 */

/**
 * Get start of day in UTC
 * @param {Date} [date=new Date()] - Optional date to use as base
 * @returns {Date} Date object set to start of day (00:00:00.000) in UTC
 */
export function getStartOfDayUTC(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get date N days ago at start of day UTC
 * @param {number} days - Number of days to go back
 * @param {Date} [fromDate=new Date()] - Optional date to calculate from
 * @returns {Date} Date object N days ago at start of day in UTC
 */
export function getDaysAgo(days, fromDate = new Date()) {
  const d = getStartOfDayUTC(fromDate);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Get start and end dates for a given period
 * @param {string} period - Period string: '24h', '7d', '30d', 'all'
 * @returns {{ startDate: Date | null, endDate: Date }} Date range for the period
 */
export function getPeriodDates(period) {
  const endDate = getStartOfDayUTC();
  let startDate = null;

  switch (period) {
    case '24h':
      startDate = getDaysAgo(1);
      break;
    case '7d':
      startDate = getDaysAgo(7);
      break;
    case '30d':
      startDate = getDaysAgo(30);
      break;
    case 'all':
      startDate = null; // No start date filter
      break;
    default:
      startDate = getDaysAgo(30); // Default to 30 days
  }

  return { startDate, endDate };
}

/**
 * Get user's current billing period from their Stripe subscription
 * @param {string} userId - User ID
 * @returns {Promise<{ start: Date, end: Date } | null>} Billing period or null if no subscription
 */
export async function getUserBillingPeriod(userId) {
  const { default: prisma } = await import('@/lib/prisma');

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });

  if (!subscription) return null;

  const start = new Date(subscription.currentPeriodStart);
  start.setUTCHours(0, 0, 0, 0);  // Normalize to midnight UTC

  const end = new Date(subscription.currentPeriodEnd);
  end.setUTCHours(23, 59, 59, 999);  // End of day to include full billing period

  return { start, end };
}

/**
 * Get start of current calendar month in UTC
 * @param {Date} [date=new Date()] - Optional date to use as base
 * @returns {Date} First day of month at midnight UTC
 */
export function getStartOfMonthUTC(date = new Date()) {
  const d = new Date(date);
  d.setUTCDate(1);  // First day of month
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get user's monthly period - HYBRID logic
 * Uses Stripe billing period if available AND if it covers user's usage,
 * otherwise uses calendar month
 * @param {string} userId - User ID
 * @returns {Promise<{ start: Date, end: Date, type: 'stripe' | 'calendar' } | null>} Monthly period with type
 */
export async function getUserMonthlyPeriod(userId) {
  const { default: prisma } = await import('@/lib/prisma');

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });

  if (subscription) {
    // User has Stripe subscription
    const billingStart = new Date(subscription.currentPeriodStart);
    billingStart.setUTCHours(0, 0, 0, 0);

    // Check if user has any usage BEFORE their subscription started
    const oldestUsage = await prisma.openAIUsage.findFirst({
      where: { userId },
      orderBy: { date: 'asc' },
      select: { date: true },
    });

    // If user has usage before subscription started, use calendar month
    if (oldestUsage && oldestUsage.date < billingStart) {
      const start = getStartOfMonthUTC();
      const end = new Date();
      end.setUTCHours(23, 59, 59, 999);

      return { start, end, type: 'calendar' };
    }

    // Otherwise use Stripe billing period
    const end = new Date(subscription.currentPeriodEnd);
    end.setUTCHours(23, 59, 59, 999);

    return { start: billingStart, end, type: 'stripe' };
  } else {
    // No subscription - use calendar month
    const start = getStartOfMonthUTC();
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);

    return { start, end, type: 'calendar' };
  }
}

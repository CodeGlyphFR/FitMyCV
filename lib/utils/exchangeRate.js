/**
 * Exchange Rate Service
 * Fetches USD/EUR rates from frankfurter.app with 1-hour cache
 */

// In-memory cache structure
const exchangeRateCache = {
  rate: null,
  timestamp: null,
  CACHE_TTL: 60 * 60 * 1000, // 1 hour in milliseconds
  FALLBACK_RATE: 0.92, // Fallback if API unavailable
};

/**
 * Get USD to EUR exchange rate (cached)
 * @returns {Promise<{rate: number, cached: boolean, error?: string}>}
 */
export async function getUsdToEurRate() {
  // Check cache validity
  const now = Date.now();
  if (
    exchangeRateCache.rate !== null &&
    exchangeRateCache.timestamp !== null &&
    now - exchangeRateCache.timestamp < exchangeRateCache.CACHE_TTL
  ) {
    return {
      rate: exchangeRateCache.rate,
      cached: true,
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=EUR',
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const rate = data.rates?.EUR;

    if (!rate || typeof rate !== 'number') {
      throw new Error('Invalid rate data');
    }

    // Update cache
    exchangeRateCache.rate = rate;
    exchangeRateCache.timestamp = now;

    console.log(`[exchangeRate] Fresh rate fetched: ${rate}`);

    return {
      rate,
      cached: false,
    };
  } catch (error) {
    console.warn(
      '[exchangeRate] Failed to fetch rate, using fallback:',
      error.message
    );

    return {
      rate: exchangeRateCache.FALLBACK_RATE,
      cached: false,
      error: error.message,
    };
  }
}

/**
 * Convert USD to EUR
 * @param {number} usdAmount - Amount in USD
 * @returns {Promise<number>} Amount in EUR
 */
export async function convertUsdToEur(usdAmount) {
  const { rate } = await getUsdToEurRate();
  return usdAmount * rate;
}

/**
 * Clear the exchange rate cache (for testing or forced refresh)
 */
export function clearExchangeRateCache() {
  exchangeRateCache.rate = null;
  exchangeRateCache.timestamp = null;
  console.log('[exchangeRate] Cache cleared');
}

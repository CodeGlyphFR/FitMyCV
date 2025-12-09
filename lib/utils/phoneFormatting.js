/**
 * Phone formatting utilities with country-specific conventions
 * @module lib/utils/phoneFormatting
 */

/**
 * Mapping ISO 2-letter country codes to calling codes (without +)
 */
export const COUNTRY_CALLING_CODES = {
  // Europe - Western
  FR: '33', BE: '32', CH: '41', LU: '352', MC: '377',
  GB: '44', UK: '44', IE: '353',
  DE: '49', AT: '43', NL: '31',
  IT: '39', ES: '34', PT: '351', AD: '376',

  // Europe - Northern
  SE: '46', NO: '47', DK: '45', FI: '358', IS: '354',

  // Europe - Eastern
  PL: '48', CZ: '420', SK: '421', HU: '36',
  RO: '40', BG: '359', HR: '385', SI: '386',
  UA: '380', BY: '375', RU: '7',

  // Europe - Southern
  GR: '30', TR: '90', CY: '357', MT: '356',

  // North America
  US: '1', CA: '1', MX: '52',

  // South America
  BR: '55', AR: '54', CL: '56', CO: '57', PE: '51', VE: '58',

  // Africa
  MA: '212', DZ: '213', TN: '216', EG: '20',
  SN: '221', CI: '225', ZA: '27', NG: '234',

  // Asia
  JP: '81', CN: '86', KR: '82', IN: '91',
  SG: '65', HK: '852', TW: '886', TH: '66', VN: '84',

  // Oceania
  AU: '61', NZ: '64',
};

/**
 * Country-specific phone formatting rules
 * trunk: leading digit to remove (usually 0)
 * format: function that formats the national number (without country code)
 */
const COUNTRY_FORMATS = {
  // France: +33 6 12 34 56 78 (blocks of 2, first block is 1 digit for mobile)
  FR: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 9) {
        // Mobile/standard: X XX XX XX XX
        return `${digits[0]} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
      }
      return formatGenericBlocks(digits, 2);
    }
  },

  // Belgium: +32 4XX XX XX XX (mobile) or +32 2 XXX XX XX (landline)
  BE: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 9) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
      }
      return formatGenericBlocks(digits, 2);
    }
  },

  // Switzerland: +41 XX XXX XX XX
  CH: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 9) {
        return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
      }
      return formatGenericBlocks(digits, 3);
    }
  },

  // Germany: +49 XXX XXXXXXXX (variable length)
  DE: {
    trunk: '0',
    format: (digits) => {
      // Mobile: 15X, 16X, 17X (11 digits total with 0)
      if (digits.length >= 10 && /^1[567]/.test(digits)) {
        return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      }
      // Landline: area code (2-5 digits) + subscriber
      if (digits.length >= 7) {
        return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      }
      return digits;
    }
  },

  // Netherlands: +31 6 XX XX XX XX (mobile) or +31 XX XXX XX XX
  NL: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 9 && digits[0] === '6') {
        // Mobile: 6 XX XX XX XX
        return `${digits[0]} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
      }
      return formatGenericBlocks(digits, 3);
    }
  },

  // UK: +44 XXXX XXXXXX or +44 XXX XXXX XXXX
  GB: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 10) {
        // Most common: XXXX XXXXXX
        return `${digits.slice(0, 4)} ${digits.slice(4)}`;
      }
      if (digits.length === 11) {
        return `${digits.slice(0, 5)} ${digits.slice(5)}`;
      }
      return formatGenericBlocks(digits, 4);
    }
  },

  // UK alias
  UK: {
    trunk: '0',
    format: (digits) => COUNTRY_FORMATS.GB.format(digits)
  },

  // Spain: +34 XXX XXX XXX (no trunk prefix)
  ES: {
    trunk: null,
    format: (digits) => {
      if (digits.length === 9) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
      }
      return formatGenericBlocks(digits, 3);
    }
  },

  // Italy: +39 XXX XXX XXXX
  IT: {
    trunk: null, // Italy includes trunk in international format
    format: (digits) => {
      if (digits.length === 10) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
      }
      return formatGenericBlocks(digits, 3);
    }
  },

  // Portugal: +351 XXX XXX XXX
  PT: {
    trunk: null,
    format: (digits) => {
      if (digits.length === 9) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
      }
      return formatGenericBlocks(digits, 3);
    }
  },

  // Austria: +43 XXX XXXXXXX
  AT: {
    trunk: '0',
    format: (digits) => {
      if (digits.length >= 10) {
        return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      }
      return formatGenericBlocks(digits, 3);
    }
  },

  // USA/Canada: +1 (XXX) XXX-XXXX
  US: {
    trunk: null,
    format: (digits) => {
      if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      return digits;
    }
  },

  // Canada uses same format as USA
  CA: {
    trunk: null,
    format: (digits) => COUNTRY_FORMATS.US.format(digits)
  },

  // Mexico: +52 XX XXXX XXXX
  MX: {
    trunk: null,
    format: (digits) => {
      if (digits.length === 10) {
        return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
      }
      return formatGenericBlocks(digits, 4);
    }
  },

  // Brazil: +55 XX XXXXX-XXXX (mobile) or +55 XX XXXX-XXXX
  BR: {
    trunk: null,
    format: (digits) => {
      if (digits.length === 11) {
        // Mobile with 9: XX 9XXXX-XXXX
        return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
      }
      if (digits.length === 10) {
        return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
      }
      return formatGenericBlocks(digits, 4);
    }
  },

  // Argentina: +54 XX XXXX-XXXX
  AR: {
    trunk: null,
    format: (digits) => {
      if (digits.length === 10) {
        return `${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`;
      }
      return formatGenericBlocks(digits, 4);
    }
  },

  // Australia: +61 X XXXX XXXX
  AU: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 9) {
        return `${digits[0]} ${digits.slice(1, 5)} ${digits.slice(5)}`;
      }
      return formatGenericBlocks(digits, 4);
    }
  },

  // Japan: +81 XX-XXXX-XXXX
  JP: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 10) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
      }
      if (digits.length === 9) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
      }
      return digits;
    }
  },

  // China: +86 XXX XXXX XXXX
  CN: {
    trunk: null,
    format: (digits) => {
      if (digits.length === 11) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
      }
      return formatGenericBlocks(digits, 4);
    }
  },

  // South Korea: +82 XX-XXXX-XXXX
  KR: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 10) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
      }
      if (digits.length === 9) {
        return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
      }
      return digits;
    }
  },

  // India: +91 XXXXX XXXXX
  IN: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 10) {
        return `${digits.slice(0, 5)} ${digits.slice(5)}`;
      }
      return formatGenericBlocks(digits, 5);
    }
  },

  // Poland: +48 XXX XXX XXX
  PL: {
    trunk: null,
    format: (digits) => {
      if (digits.length === 9) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
      }
      return formatGenericBlocks(digits, 3);
    }
  },

  // Sweden: +46 XX XXX XX XX
  SE: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 9) {
        return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
      }
      return formatGenericBlocks(digits, 3);
    }
  },

  // Norway: +47 XXX XX XXX (no trunk)
  NO: {
    trunk: null,
    format: (digits) => {
      if (digits.length === 8) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
      }
      return formatGenericBlocks(digits, 3);
    }
  },

  // Denmark: +45 XX XX XX XX (no trunk)
  DK: {
    trunk: null,
    format: (digits) => {
      if (digits.length === 8) {
        return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`;
      }
      return formatGenericBlocks(digits, 2);
    }
  },

  // Morocco: +212 X XX XX XX XX
  MA: {
    trunk: '0',
    format: (digits) => {
      if (digits.length === 9) {
        return `${digits[0]} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
      }
      return formatGenericBlocks(digits, 2);
    }
  },
};

/**
 * Generic block formatter for unknown formats
 */
function formatGenericBlocks(digits, blockSize) {
  const blocks = [];
  for (let i = 0; i < digits.length; i += blockSize) {
    blocks.push(digits.slice(i, i + blockSize));
  }
  return blocks.join(' ');
}

/**
 * Normalize phone number - keep only digits and leading +
 * @param {string} phone - Raw phone number
 * @returns {string} Normalized phone (digits only, with optional leading +)
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';

  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');

  return hasPlus ? `+${digits}` : digits;
}

/**
 * Get country calling code from ISO code
 * @param {string} isoCode - ISO 2-letter country code (e.g., "FR", "US")
 * @returns {string} Calling code without + (e.g., "33", "1") or empty string
 */
export function getCountryCallingCode(isoCode) {
  if (!isoCode) return '';
  return COUNTRY_CALLING_CODES[isoCode.toUpperCase()] || '';
}

/**
 * Detect country from phone number starting with +
 * @param {string} normalizedPhone - Phone starting with + followed by digits
 * @returns {{countryCode: string, callingCode: string, nationalNumber: string} | null}
 */
function detectCountryFromPhone(normalizedPhone) {
  if (!normalizedPhone.startsWith('+')) return null;

  const digits = normalizedPhone.slice(1); // Remove +

  // Try longest calling codes first (4 digits, then 3, 2, 1)
  for (let len = 4; len >= 1; len--) {
    const potentialCode = digits.slice(0, len);

    // Find matching country
    for (const [iso, code] of Object.entries(COUNTRY_CALLING_CODES)) {
      if (code === potentialCode) {
        return {
          countryCode: iso,
          callingCode: code,
          nationalNumber: digits.slice(len)
        };
      }
    }
  }

  return null;
}

/**
 * Formats a phone number according to native country conventions
 *
 * @param {string|null|undefined} phone - Raw phone number
 * @param {string|null|undefined} countryCode - ISO 2-letter country code (e.g., "FR", "US")
 * @returns {string} Formatted phone number or original if cannot format
 *
 * @example
 * formatPhoneNumber("0612345678", "FR")     // "+33 6 12 34 56 78"
 * formatPhoneNumber("6123456789", "US")     // "+1 (612) 345-6789"
 * formatPhoneNumber("+33612345678", "FR")   // "+33 6 12 34 56 78"
 * formatPhoneNumber("+33612345678", null)   // "+33 6 12 34 56 78" (auto-detected)
 */
export function formatPhoneNumber(phone, countryCode) {
  // Handle empty/null
  if (!phone || typeof phone !== 'string') return '';

  const normalized = normalizePhone(phone);
  if (!normalized) return '';

  // If phone starts with +, try to detect country and format
  if (normalized.startsWith('+')) {
    const detected = detectCountryFromPhone(normalized);

    if (detected) {
      const format = COUNTRY_FORMATS[detected.countryCode];
      if (format) {
        let nationalNumber = detected.nationalNumber;

        // Remove trunk prefix if present (shouldn't be in international format, but handle it)
        if (format.trunk && nationalNumber.startsWith(format.trunk)) {
          nationalNumber = nationalNumber.slice(format.trunk.length);
        }

        const formatted = format.format(nationalNumber);
        return `+${detected.callingCode} ${formatted}`;
      }

      // Country detected but no format rules - use generic
      return `+${detected.callingCode} ${formatGenericBlocks(detected.nationalNumber, 3)}`;
    }

    // Could not detect country - return with minimal formatting
    return `+${formatGenericBlocks(normalized.slice(1), 3)}`;
  }

  // Phone doesn't start with + - use provided country code
  const isoCode = countryCode?.toUpperCase();
  const callingCode = getCountryCallingCode(isoCode);
  const format = COUNTRY_FORMATS[isoCode];

  if (!callingCode) {
    // No country info - return with minimal formatting
    return formatGenericBlocks(normalized, 3);
  }

  let nationalNumber = normalized;

  // Remove trunk prefix if present
  if (format?.trunk && nationalNumber.startsWith(format.trunk)) {
    nationalNumber = nationalNumber.slice(format.trunk.length);
  }

  if (format) {
    const formatted = format.format(nationalNumber);
    return `+${callingCode} ${formatted}`;
  }

  // Country known but no format rules - use generic
  return `+${callingCode} ${formatGenericBlocks(nationalNumber, 3)}`;
}

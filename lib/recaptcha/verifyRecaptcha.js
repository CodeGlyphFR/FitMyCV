/**
 * Fonction utilitaire centralisée pour vérifier les tokens reCAPTCHA v3
 *
 * @param {string|null} token - Le token reCAPTCHA à vérifier (peut être null)
 * @param {object} options - Options de configuration
 * @param {string} options.callerName - Nom du caller pour le logging (ex: 'import-pdf', 'register')
 * @param {number} options.scoreThreshold - Seuil minimum de score (défaut: 0.5)
 * @param {string} options.expectedAction - Action attendue (optionnel)
 *
 * @returns {Promise<{success: boolean, score?: number, error?: string, errorType?: string, statusCode?: number, bypassed?: boolean}>}
 */
export async function verifyRecaptcha(token, options = {}) {
  const {
    callerName = 'unknown',
    scoreThreshold = 0.5,
    expectedAction = null,
  } = options;

  const logPrefix = `[${callerName}]`;

  // BYPASS MODE - Vérifier en premier avant toute validation
  if (process.env.BYPASS_RECAPTCHA === 'true') {
    console.log(`${logPrefix} BYPASS MODE ENABLED - Skipping reCAPTCHA verification`);
    return {
      success: true,
      score: 1.0,
      bypassed: true,
    };
  }

  // Si pas de token fourni, retourner une erreur
  if (!token) {
    console.warn(`${logPrefix} reCAPTCHA token missing`);
    return {
      success: false,
      error: 'Token reCAPTCHA manquant',
      errorType: 'MISSING_TOKEN',
      statusCode: 400,
    };
  }

  // Vérifier que la clé secrète est configurée
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    console.error(`${logPrefix} RECAPTCHA_SECRET_KEY not configured`);
    return {
      success: false,
      error: 'Configuration serveur manquante',
      errorType: 'SERVER_CONFIG',
      statusCode: 500,
    };
  }

  try {
    // Vérifier le token auprès de Google
    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const verificationData = new URLSearchParams({
      secret: secretKey,
      response: token,
    });

    const verificationResponse = await fetch(verificationUrl, {
      method: 'POST',
      body: verificationData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const verificationResult = await verificationResponse.json();

    // Log le résultat pour debug
    console.log(`${logPrefix} reCAPTCHA verification result:`, {
      success: verificationResult.success,
      score: verificationResult.score,
      action: verificationResult.action,
      hostname: verificationResult.hostname,
    });

    // Vérifier que la vérification a réussi
    if (!verificationResult.success) {
      console.warn(`${logPrefix} reCAPTCHA verification failed`, {
        errorCodes: verificationResult['error-codes'],
      });
      return {
        success: false,
        error: 'Échec de la vérification reCAPTCHA',
        errorType: 'VERIFICATION_FAILED',
        statusCode: 400,
        errorCodes: verificationResult['error-codes'],
      };
    }

    // Vérifier l'action si fournie
    if (expectedAction && verificationResult.action !== expectedAction) {
      console.warn(`${logPrefix} reCAPTCHA action mismatch`, {
        expected: expectedAction,
        received: verificationResult.action,
      });
      return {
        success: false,
        error: 'Action reCAPTCHA non correspondante',
        errorType: 'ACTION_MISMATCH',
        statusCode: 400,
      };
    }

    // Vérifier le score
    const score = verificationResult.score || 0;
    if (score < scoreThreshold) {
      console.warn(`${logPrefix} reCAPTCHA score too low`, {
        score,
        threshold: scoreThreshold,
      });
      return {
        success: false,
        score,
        error: `Score reCAPTCHA trop faible (${score} < ${scoreThreshold})`,
        errorType: 'SCORE_TOO_LOW',
        statusCode: 403,
      };
    }

    // Vérification réussie
    console.log(`${logPrefix} reCAPTCHA verification successful`, { score });
    return {
      success: true,
      score,
    };

  } catch (error) {
    console.error(`${logPrefix} Error verifying reCAPTCHA:`, error);
    return {
      success: false,
      error: 'Erreur serveur lors de la vérification reCAPTCHA',
      errorType: 'SERVER_ERROR',
      statusCode: 500,
    };
  }
}

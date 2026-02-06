import { NextResponse } from 'next/server';

/**
 * Create an API error response with translation key
 * @param {string} translationKey - The i18n key (e.g., 'errors.api.auth.emailRequired')
 * @param {Object} options - Additional options
 * @param {Object} options.params - Dynamic parameters for translation
 * @param {boolean} options.actionRequired - Whether user action is needed
 * @param {string} options.redirectUrl - URL to redirect for action
 * @param {number} options.status - HTTP status code (default: 400)
 * @returns {NextResponse}
 */
export function apiError(translationKey, options = {}) {
  const {
    params = {},
    actionRequired = false,
    redirectUrl = null,
    status = 400
  } = options;

  const response = {
    error: translationKey,
    ...(Object.keys(params).length > 0 && { params }),
    ...(actionRequired && { actionRequired }),
    ...(redirectUrl && { redirectUrl })
  };

  return NextResponse.json(response, { status });
}

// Pre-defined common errors for convenience
export const CommonErrors = {
  notAuthenticated: (options = {}) =>
    apiError('errors.api.common.notAuthenticated', { status: 401, ...options }),

  invalidPayload: (options = {}) =>
    apiError('errors.api.common.invalidPayload', { status: 400, ...options }),

  serverError: (options = {}) =>
    apiError('errors.api.common.serverError', { status: 500, ...options }),

  notFound: (resource, options = {}) =>
    apiError('errors.api.common.notFound', { params: { resource }, status: 404, ...options }),

  forbidden: (options = {}) =>
    apiError('errors.api.common.forbidden', { status: 403, ...options }),

  unknownError: (options = {}) =>
    apiError('errors.api.common.unknownError', { status: 500, ...options }),
};

// Auth-specific errors
export const AuthErrors = {
  emailRequired: () => apiError('errors.api.auth.emailRequired'),
  passwordRequired: () => apiError('errors.api.auth.passwordRequired'),
  emailAndPasswordRequired: () => apiError('errors.api.auth.emailAndPasswordRequired'),
  nameRequired: () => apiError('errors.api.auth.nameRequired'),
  firstNameRequired: () => apiError('errors.api.auth.firstNameRequired'),
  lastNameRequired: () => apiError('errors.api.auth.lastNameRequired'),
  emailInvalid: () => apiError('errors.api.auth.emailInvalid'),
  nameInvalid: () => apiError('errors.api.auth.nameInvalid'),
  firstNameInvalid: () => apiError('errors.api.auth.firstNameInvalid'),
  lastNameInvalid: () => apiError('errors.api.auth.lastNameInvalid'),
  passwordWeak: () => apiError('errors.api.auth.passwordWeak'),
  accountCreateFailed: () => apiError('errors.api.auth.accountCreateFailed'),
  recaptchaFailed: () => apiError('errors.api.auth.recaptchaFailed', { status: 403 }),
  tokenRequired: () => apiError('errors.api.auth.tokenRequired'),
  tokenInvalid: () => apiError('errors.api.auth.tokenInvalid'),
  tokenExpired: () => apiError('errors.api.auth.tokenExpired'),
  oauthOnly: () => apiError('errors.api.auth.oauthOnly'),
  passwordIncorrect: () => apiError('errors.api.auth.passwordIncorrect'),
  providerRequired: () => apiError('errors.api.auth.providerRequired'),
  providerInvalid: () => apiError('errors.api.auth.providerInvalid'),
  providerNotConfigured: () => apiError('errors.api.auth.providerNotConfigured'),
  providerAlreadyLinked: () => apiError('errors.api.auth.providerAlreadyLinked'),
  providerNotLinked: () => apiError('errors.api.auth.providerNotLinked', { status: 404 }),
  cannotUnlinkLastProvider: () => apiError('errors.api.auth.cannotUnlinkLastProvider'),
  registrationDisabled: () => apiError('errors.api.auth.registrationDisabled', { status: 403 }),
  privacyPolicyRequired: () => apiError('errors.api.auth.privacyPolicyRequired'),
};

// CV-specific errors
export const CvErrors = {
  notFound: () => apiError('errors.api.cv.notFound', { status: 404 }),
  invalidFilename: () => apiError('errors.api.cv.invalidFilename'),
  missingFilename: () => apiError('errors.api.cv.missingFilename'),
  readError: () => apiError('errors.api.cv.readError', { status: 500 }),
  deleteError: () => apiError('errors.api.cv.deleteError', { status: 500 }),
  createError: () => apiError('errors.api.cv.createError', { status: 500 }),
  verifyError: () => apiError('errors.api.cv.verifyError', { status: 500 }),
  debitError: () => apiError('errors.api.cv.debitError', { status: 500 }),
  sourceError: () => apiError('errors.api.cv.sourceError', { status: 500 }),
  metadataError: () => apiError('errors.api.cv.metadataError', { status: 500 }),
  improveError: () => apiError('errors.api.cv.improveError', { status: 500 }),
};

// Background task errors
export const BackgroundErrors = {
  noSourceProvided: () => apiError('errors.api.background.noSourceProvided'),
  invalidLinksFormat: () => apiError('errors.api.background.invalidLinksFormat'),
  noPdfProvided: () => apiError('errors.api.background.noPdfProvided'),
  pdfSaveError: () => apiError('errors.api.background.pdfSaveError', { status: 500 }),
  queueError: () => apiError('errors.api.background.queueError', { status: 500 }),
  invalidTargetLanguage: () => apiError('errors.api.background.invalidTargetLanguage'),
  cvFileMissing: () => apiError('errors.api.background.cvFileMissing'),
  noJobOfferAnalysis: () => apiError('errors.api.background.noJobOfferAnalysis'),
  jobOfferUrlNotFound: () => apiError('errors.api.background.jobOfferUrlNotFound'),
  noJobTitleProvided: () => apiError('errors.api.background.noJobTitleProvided'),
  noReferenceCvProvided: () => apiError('errors.api.background.noReferenceCvProvided'),
};

// Account errors
export const AccountErrors = {
  updateFailed: () => apiError('errors.api.account.updateFailed', { status: 500 }),
  passwordUpdateFailed: () => apiError('errors.api.account.passwordUpdateFailed', { status: 500 }),
  deleteFailed: () => apiError('errors.api.account.deleteFailed', { status: 500 }),
  unlinkFailed: () => apiError('errors.api.account.unlinkFailed', { status: 500 }),
  emailChangeFailed: () => apiError('errors.api.account.emailChangeFailed', { status: 500 }),
};

// Subscription errors
export const SubscriptionErrors = {
  limitReached: (feature, options = {}) =>
    apiError('errors.api.subscription.limitReached', {
      params: { feature },
      actionRequired: true,
      redirectUrl: '/subscription',
      ...options
    }),
  invalidPlan: () => apiError('errors.api.subscription.invalidPlan'),
  planRequired: () => apiError('errors.api.subscription.planRequired'),
  invalidBillingPeriod: () => apiError('errors.api.subscription.invalidBillingPeriod'),
  packRequired: () => apiError('errors.api.subscription.packRequired'),
  sessionRequired: () => apiError('errors.api.subscription.sessionRequired'),
  checkoutError: () => apiError('errors.api.subscription.checkoutError', { status: 500 }),
};

// Other errors
export const OtherErrors = {
  feedbackFailed: () => apiError('errors.api.other.feedbackFailed', { status: 500 }),
  exportPdfFailed: () => apiError('errors.api.other.exportPdfFailed', { status: 500 }),
  consentRequired: () => apiError('errors.api.other.consentRequired'),
  consentInvalidAction: () => apiError('errors.api.other.consentInvalidAction'),
  onboardingInvalidStep: () => apiError('errors.api.other.onboardingInvalidStep'),
  onboardingInvalidBody: () => apiError('errors.api.other.onboardingInvalidBody'),
  onboardingInvalidAction: () => apiError('errors.api.other.onboardingInvalidAction'),
};

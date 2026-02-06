/**
 * Telemetry event type constants
 */
export const EventTypes = {
  // CV Management
  CV_GENERATED_URL: 'CV_GENERATED_URL',
  CV_GENERATED_PDF: 'CV_GENERATED_PDF',
  CV_TEMPLATE_CREATED_URL: 'CV_TEMPLATE_CREATED_URL',
  CV_TEMPLATE_CREATED_PDF: 'CV_TEMPLATE_CREATED_PDF',
  CV_GENERATED_FROM_JOB_TITLE: 'CV_GENERATED_FROM_JOB_TITLE',
  CV_IMPORTED: 'CV_IMPORTED',
  CV_FIRST_IMPORTED: 'CV_FIRST_IMPORTED',
  CV_EXPORTED: 'CV_EXPORTED',
  CV_CREATED_MANUAL: 'CV_CREATED_MANUAL',
  CV_EDITED: 'CV_EDITED',
  CV_DELETED: 'CV_DELETED',
  CV_TRANSLATED: 'CV_TRANSLATED',
  CV_RESTORED: 'CV_RESTORED',

  // Match Score & Optimization
  MATCH_SCORE_CALCULATED: 'MATCH_SCORE_CALCULATED',
  CV_OPTIMIZED: 'CV_OPTIMIZED',
  CV_CHANGES_REVIEWED: 'CV_CHANGES_REVIEWED',

  // CV Generation Pipeline
  CV_GENERATION_STARTED: 'CV_GENERATION_STARTED',
  CV_GENERATION_COMPLETED: 'CV_GENERATION_COMPLETED',
  CV_GENERATION_FAILED: 'CV_GENERATION_FAILED',

  // Job Processing
  JOB_QUEUED: 'JOB_QUEUED',
  JOB_STARTED: 'JOB_STARTED',
  JOB_COMPLETED: 'JOB_COMPLETED',
  JOB_FAILED: 'JOB_FAILED',
  JOB_CANCELLED: 'JOB_CANCELLED',

  // Auth
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  PASSWORD_RESET: 'PASSWORD_RESET',

  // Navigation & Interaction (Frontend)
  PAGE_VIEW: 'PAGE_VIEW',
  BUTTON_CLICK: 'BUTTON_CLICK',
  MODAL_OPENED: 'MODAL_OPENED',
  MODAL_CLOSED: 'MODAL_CLOSED',
  FORM_SUBMITTED: 'FORM_SUBMITTED',
};

/**
 * Event categories for grouping
 */
export const EventCategories = {
  CV_MANAGEMENT: 'cv_management',
  AUTH: 'auth',
  JOB_PROCESSING: 'job_processing',
  NAVIGATION: 'navigation',
  INTERACTION: 'interaction',
};

/**
 * Get category from event type
 */
export function getCategoryFromType(type) {
  if (type.startsWith('CV_')) return EventCategories.CV_MANAGEMENT;
  if (type.startsWith('USER_') || type.includes('LOGIN') || type.includes('LOGOUT') || type.includes('EMAIL') || type.includes('PASSWORD')) {
    return EventCategories.AUTH;
  }
  if (type.startsWith('JOB_') || type.includes('MATCH_SCORE') || type.includes('OPTIMIZED')) {
    return EventCategories.JOB_PROCESSING;
  }
  if (type === 'PAGE_VIEW') return EventCategories.NAVIGATION;
  return EventCategories.INTERACTION;
}

/**
 * Feature event types for usage tracking
 */
export const FEATURE_EVENTS = [
  'CV_GENERATED', 'CV_IMPORTED', 'CV_FIRST_IMPORTED', 'CV_EXPORTED',
  'CV_CREATED_MANUAL', 'CV_EDITED', 'MATCH_SCORE_CALCULATED',
  'CV_OPTIMIZED', 'CV_TRANSLATED'
];

/**
 * Check if event type represents a feature usage
 */
export function isFeatureEvent(type) {
  return FEATURE_EVENTS.includes(type);
}

/**
 * Get feature name from event type
 */
export function getFeatureNameFromEventType(type) {
  const mapping = {
    'CV_GENERATED': 'generate_cv',
    'CV_IMPORTED': 'import_pdf',
    'CV_FIRST_IMPORTED': 'first_import_pdf',
    'CV_EXPORTED': 'export_cv',
    'CV_CREATED_MANUAL': 'create_cv_manual',
    'CV_EDITED': 'edit_cv',
    'MATCH_SCORE_CALCULATED': 'match_score',
    'CV_OPTIMIZED': 'optimize_cv',
    'CV_TRANSLATED': 'translate_cv',
  };
  return mapping[type] || type.toLowerCase();
}

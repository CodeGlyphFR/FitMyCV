/**
 * Job Title Generation Feature
 *
 * This feature allows generating a CV template from a job title.
 * The user provides a job title and the system generates a professional
 * CV example that can be customized.
 */

// Service - Core generation logic
export { generateCvFromJobTitle } from './service';

// Job - Background task runner
export {
  scheduleGenerateCvFromJobTitleJob,
  runGenerateCvFromJobTitleJob
} from './job';

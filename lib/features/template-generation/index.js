/**
 * Template Generation Feature
 *
 * Creates template CVs from job offers using OpenAI.
 */

// Service exports
export { createTemplateCv } from './service.js';

// Job exports
export { scheduleCreateTemplateCvJob, runCreateTemplateCvJob } from './job.js';

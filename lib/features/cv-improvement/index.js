/**
 * CV Improvement Feature
 *
 * This module provides the CV improvement pipeline functionality.
 * It includes stages for skill classification, suggestion preprocessing,
 * experience/project/language/extras improvement, and summary updates.
 *
 * @module features/cv-improvement
 */

// Main orchestrator
export { runImprovementPipeline } from './orchestrator.js';

// Background job
export { scheduleImproveCvJob, runImproveCvJob } from './job.js';

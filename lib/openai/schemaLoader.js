/**
 * Schema Loader for OpenAI Structured Outputs
 *
 * Loads JSON schemas for response_format: { type: 'json_schema', json_schema: schema }
 */

import { promises as fs } from 'fs';
import path from 'path';

// Cache for loaded schemas (in production)
const schemaCache = new Map();

/**
 * Load a JSON schema from file
 * @param {string} schemaPath - Relative path to schema file from project root
 * @returns {Promise<Object>} - Parsed JSON schema
 */
async function loadSchema(schemaPath) {
  // Check cache in production
  if (process.env.NODE_ENV === 'production' && schemaCache.has(schemaPath)) {
    return schemaCache.get(schemaPath);
  }

  const fullPath = path.join(process.cwd(), schemaPath);

  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    const schema = JSON.parse(content);

    // Cache in production
    if (process.env.NODE_ENV === 'production') {
      schemaCache.set(schemaPath, schema);
    }

    return schema;
  } catch (error) {
    console.error(`[schemaLoader] Failed to load schema: ${schemaPath}`, error.message);
    throw new Error(`Schema not found: ${schemaPath}`);
  }
}

/**
 * Load the Job Offer Extraction schema
 * @returns {Promise<Object>} - Job offer extraction schema
 */
export async function loadJobOfferSchema() {
  return loadSchema('lib/openai/schemas/jobOfferExtractionSchema.json');
}

/**
 * Load the CV Modifications schema
 * @returns {Promise<Object>} - CV modifications schema
 */
export async function loadCvModificationsSchema() {
  return loadSchema('lib/openai/schemas/cvModificationsSchema.json');
}

/**
 * Load the CV Extraction schema (for import PDF)
 * @returns {Promise<Object>} - CV extraction schema
 */
export async function loadCvExtractionSchema() {
  return loadSchema('lib/openai/schemas/cvExtractionSchema.json');
}

/**
 * Clear the schema cache (useful for testing)
 */
export function clearSchemaCache() {
  schemaCache.clear();
}

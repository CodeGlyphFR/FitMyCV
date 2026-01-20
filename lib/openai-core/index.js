/**
 * OpenAI Core - Infrastructure OpenAI partagée
 *
 * Contient les fonctionnalités de base pour l'intégration OpenAI :
 * - Client : configuration et instanciation du client OpenAI
 * - PromptLoader : chargement des prompts depuis les fichiers markdown
 * - SchemaLoader : chargement des schémas JSON
 * - PdfToImages : conversion PDF vers images pour extraction
 */

// Client
export {
  getOpenAIClient,
  getCvModel,
  addTemperatureIfSupported,
  addTopPIfSupported,
  addSeedIfSet,
  addCacheRetentionIfSupported,
  checkOpenAICredits
} from './client.js';

// Prompt Loader
export {
  loadPrompt,
  loadPromptWithVars,
  clearPromptCache,
  getPromptCacheStats
} from './promptLoader.js';

// Schema Loader
export {
  loadSchema,
  loadJobOfferSchema,
  clearSchemaCache
} from './schemaLoader.js';

// PDF to Images
export {
  convertPdfToImages,
  getPdfPageCount,
  getPdfImageConfig,
  invalidatePdfConfigCache,
  PDF_CONFIG
} from './pdfToImages.js';

/**
 * Prompts Shared - Prompts communs partagés entre features
 *
 * Ce dossier contient les prompts réutilisables :
 * - system-base.md : Préfixe commun (rôle + schema)
 * - cv-adaptation-rules.md : Règles d'adaptation CV
 * - json-instructions.md : Instructions template CV
 * - scoring-rules.md : Format scoring unifié
 * - language-policy.md : Politique de langue
 * - response-format.md : Format réponse JSON
 *
 * Ces prompts sont inclus via la directive {INCLUDE:_shared/xxx.md}
 * dans les prompts spécifiques aux features.
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PROMPTS_SHARED_DIR = __dirname;

export function getSharedPromptPath(filename) {
  return resolve(__dirname, filename);
}

/**
 * Features - Fonctionnalités métier CV
 *
 * Chaque feature est un module autonome contenant :
 * - service.js : logique métier principale
 * - job.js : tâche background (si applicable)
 * - prompts/ : prompts OpenAI spécifiques
 * - schemas/ : schémas JSON spécifiques
 * - index.js : point d'entrée et exports publics
 *
 * Features disponibles :
 * - import-pdf : Import et extraction de CV depuis PDF
 * - template-generation : Génération de CV template
 * - job-title-generation : Génération de CV depuis un titre de poste
 * - cv-adaptation : Adaptation de CV à une offre d'emploi (Pipeline V2)
 * - cv-improvement : Amélioration de CV avec suggestions IA
 */

// Les features sont importées individuellement pour éviter le chargement inutile
// Exemple: import { importPdfFromFile } from '@/lib/features/import-pdf';

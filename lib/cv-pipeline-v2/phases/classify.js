/**
 * Phase Classification - Pipeline CV v2
 *
 * Classifie chaque experience et projet du CV source:
 * - Experiences: KEEP, REMOVE, ou MOVE_TO_PROJECTS
 * - Projets: KEEP ou REMOVE
 *
 * Utilise le setting `model_cv_classify` pour le modele IA.
 * Cree une CvGenerationSubtask de type `classify`.
 * Sauvegarde le resultat dans CvGenerationOffer.classificationResult.
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient } from '@/lib/openai/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

// Chemins des fichiers de prompts et schema
const PROMPTS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/schemas');

/**
 * Charge un prompt depuis un fichier
 * @param {string} filename - Nom du fichier (ex: 'classify-system.md')
 * @returns {Promise<string>}
 */
async function loadPrompt(filename) {
  const fullPath = path.join(PROMPTS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return content.trim();
}

/**
 * Charge un schema JSON depuis un fichier
 * @param {string} filename - Nom du fichier (ex: 'classificationSchema.json')
 * @returns {Promise<Object>}
 */
async function loadSchema(filename) {
  const fullPath = path.join(SCHEMAS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Remplace les variables dans un template de prompt
 * @param {string} template - Template avec placeholders {variable}
 * @param {Object} variables - Variables a remplacer
 * @returns {string}
 */
function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  return result;
}

/**
 * Execute la phase de classification
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Object} params.sourceCv - CV source (JSON)
 * @param {Object} params.jobOffer - Offre d'emploi extraite (JSON)
 * @param {string} params.userId - ID de l'utilisateur (pour telemetrie)
 * @param {AbortSignal} [params.signal] - Signal pour annulation
 * @returns {Promise<Object>} - Resultat de la classification
 */
export async function executeClassification({
  offerId,
  sourceCv,
  jobOffer,
  userId,
  signal = null,
}) {
  const startTime = Date.now();

  // 1. Creer la subtask en status 'running'
  const subtask = await prisma.cvGenerationSubtask.create({
    data: {
      offerId,
      type: 'classify',
      status: 'running',
      input: {
        experienceCount: sourceCv.experience?.length || 0,
        projectCount: sourceCv.projects?.length || 0,
      },
      startedAt: new Date(),
    },
  });

  try {
    // 2. Charger le modele depuis les settings
    const model = await getAiModelSetting('model_cv_classify');
    console.log(`[classify] Using model: ${model}`);

    // 3. Charger les prompts et le schema
    const systemPrompt = await loadPrompt('classify-system.md');
    const userPromptTemplate = await loadPrompt('classify-user.md');
    const schema = await loadSchema('classificationSchema.json');

    // 4. Preparer les donnees pour le prompt
    const experiences = sourceCv.experience || [];
    const projects = sourceCv.projects || [];

    const userPrompt = replaceVariables(userPromptTemplate, {
      experiencesJson: JSON.stringify(experiences, null, 2),
      projectsJson: JSON.stringify(projects, null, 2),
      jobOfferJson: JSON.stringify(jobOffer, null, 2),
    });

    // 5. Appeler OpenAI avec Structured Outputs
    const client = getOpenAIClient();

    const requestOptions = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
      temperature: 0.1, // Faible temperature pour coherence
      max_completion_tokens: 2000,
    };

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    // 6. Verifier si annule
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const duration = Date.now() - startTime;

    // 7. Parser la reponse
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const classification = JSON.parse(content);

    // 8. Tracker l'usage OpenAI
    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;

    if (userId) {
      await trackOpenAIUsage({
        userId,
        featureName: 'cv_pipeline_v2_classify',
        model,
        promptTokens,
        completionTokens,
        duration,
      });
    }

    // 9. Mettre a jour la subtask avec succes
    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'completed',
        output: classification,
        modelUsed: model,
        promptTokens,
        completionTokens,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    // 10. Sauvegarder le resultat dans CvGenerationOffer
    await prisma.cvGenerationOffer.update({
      where: { id: offerId },
      data: {
        classificationResult: classification,
      },
    });

    console.log(`[classify] Completed in ${duration}ms:`, {
      experiences: {
        total: experiences.length,
        keep: classification.experiences.filter(e => e.action === 'KEEP').length,
        remove: classification.experiences.filter(e => e.action === 'REMOVE').length,
        moveToProjects: classification.experiences.filter(e => e.action === 'MOVE_TO_PROJECTS').length,
      },
      projects: {
        total: projects.length,
        keep: classification.projects.filter(p => p.action === 'KEEP').length,
        remove: classification.projects.filter(p => p.action === 'REMOVE').length,
      },
    });

    return {
      success: true,
      classification,
      subtaskId: subtask.id,
      duration,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Mettre a jour la subtask avec erreur
    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'failed',
        error: error.message,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    console.error(`[classify] Failed after ${duration}ms:`, error.message);

    return {
      success: false,
      error: error.message,
      subtaskId: subtask.id,
      duration,
    };
  }
}

/**
 * Applique la classification pour filtrer les experiences et projets
 *
 * @param {Object} sourceCv - CV source
 * @param {Object} classification - Resultat de la classification
 * @returns {Object} - { experiences, projects, movedToProjects }
 */
export function applyClassification(sourceCv, classification) {
  const experiences = sourceCv.experience || [];
  const projects = sourceCv.projects || [];

  // Filtrer les experiences KEEP
  // Note: Valider que l'index existe pour éviter les expériences fantômes
  const keptExperiences = classification.experiences
    .filter(c => c.action === 'KEEP' && c.index >= 0 && c.index < experiences.length && experiences[c.index])
    .map(c => ({
      ...experiences[c.index],
      _classificationReason: c.reason,
    }));

  // Experiences a deplacer vers projets
  // Note: Valider que l'index existe
  const movedToProjects = classification.experiences
    .filter(c => c.action === 'MOVE_TO_PROJECTS' && c.index >= 0 && c.index < experiences.length && experiences[c.index])
    .map(c => {
      const exp = experiences[c.index];
      // Convertir experience en format projet avec toutes les infos pour l'IA
      return {
        // Nom du projet: titre de l'experience ou nom entreprise/contexte
        name: exp.title || exp.company || 'Projet',
        // Role initial (l'IA affinera)
        role: '',
        // Dates de l'experience
        start_date: exp.start_date || '',
        end_date: exp.end_date || '',
        // Summary initial: description ou responsabilites
        summary: exp.description || exp.responsibilities?.join('. ') || '',
        // Tech stack depuis skills_used
        tech_stack: exp.skills_used || [],
        url: null,
        // Marqueur pour l'IA
        _fromExperience: true,
        _classificationReason: c.reason,
        // Conserver toutes les infos originales pour l'IA
        _originalExperience: {
          title: exp.title || '',
          company: exp.company || '',
          start_date: exp.start_date || '',
          end_date: exp.end_date || '',
          description: exp.description || '',
          responsibilities: exp.responsibilities || [],
          deliverables: exp.deliverables || [],
          skills_used: exp.skills_used || [],
        },
      };
    });

  // Filtrer les projets KEEP + ajouter les experiences converties
  // Note: Valider que l'index existe pour éviter les projets fantômes
  const keptProjects = [
    ...classification.projects
      .filter(c => c.action === 'KEEP' && c.index >= 0 && c.index < projects.length && projects[c.index])
      .map(c => ({
        ...projects[c.index],
        _classificationReason: c.reason,
      })),
    ...movedToProjects,
  ];

  return {
    experiences: keptExperiences,
    projects: keptProjects,
    movedToProjects,
    stats: {
      originalExperiences: experiences.length,
      keptExperiences: keptExperiences.length,
      removedExperiences: classification.experiences.filter(c => c.action === 'REMOVE').length,
      movedExperiences: movedToProjects.length,
      originalProjects: projects.length,
      keptProjects: classification.projects.filter(c => c.action === 'KEEP').length,
      removedProjects: classification.projects.filter(c => c.action === 'REMOVE').length,
    },
  };
}

/**
 * Phase Recomposition - Pipeline CV v2
 *
 * Assemble le CV final a partir de tous les batch results:
 * - header.current_title = titre de l'offre
 * - summary = batch summary result
 * - experience = batch experiences results
 * - projects = batch projects results
 * - skills = batch skills result
 * - extras = batch extras result
 * - languages = adaptes si mentionnes dans l'offre
 * - education = conserve tel quel
 *
 * Cree un CvFile avec le contenu JSON.
 * Cree une CvVersion avec origin gpt_cv_generation_v2.
 * Met a jour CvGenerationOffer.generatedCvFileId.
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient } from '@/lib/openai/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { initializeReviewState, generateChangeId } from '@/lib/cv-core/changeTracking';
import { sanitizeForPostgres } from '../utils/sanitize.js';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/schemas');

async function loadPrompt(filename) {
  const fullPath = path.join(PROMPTS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return content.trim();
}

async function loadSchema(filename) {
  const fullPath = path.join(SCHEMAS_DIR, filename);
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  return result;
}

/**
 * Detecte les mentions de langues dans l'offre d'emploi
 */
function detectLanguageMentions(jobOffer) {
  const text = [
    jobOffer.title || '',
    jobOffer.description || '',
    ...(jobOffer.skills?.required || []),
    ...(jobOffer.skills?.nice_to_have || []),
  ].join(' ').toLowerCase();

  const mentions = [];

  // Patterns courants pour les langues
  const languagePatterns = [
    { lang: 'Francais', patterns: ['français', 'francais', 'french', 'fr'] },
    { lang: 'Anglais', patterns: ['anglais', 'english', 'en', 'fluent english', 'anglais courant'] },
    { lang: 'Allemand', patterns: ['allemand', 'german', 'deutsch', 'de'] },
    { lang: 'Espagnol', patterns: ['espagnol', 'spanish', 'español', 'es'] },
    { lang: 'Italien', patterns: ['italien', 'italian', 'italiano', 'it'] },
    { lang: 'Portugais', patterns: ['portugais', 'portuguese', 'português', 'pt'] },
    { lang: 'Neerlandais', patterns: ['néerlandais', 'neerlandais', 'dutch', 'nl'] },
    { lang: 'Chinois', patterns: ['chinois', 'chinese', 'mandarin', 'zh'] },
    { lang: 'Japonais', patterns: ['japonais', 'japanese', 'ja'] },
    { lang: 'Arabe', patterns: ['arabe', 'arabic', 'ar'] },
  ];

  for (const { lang, patterns } of languagePatterns) {
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        mentions.push(lang);
        break;
      }
    }
  }

  return mentions;
}

/**
 * Adapte les langues si elles sont mentionnees dans l'offre
 */
async function adaptLanguages({
  languages,
  jobOffer,
  targetLanguage,
  userId,
  signal,
}) {
  if (!languages || languages.length === 0) {
    return { languages: [], modifications: { adapted: [], unchanged: [] } };
  }

  const languageMentions = detectLanguageMentions(jobOffer);

  // Si aucune langue n'est mentionnee dans l'offre, retourner les langues telles quelles
  if (languageMentions.length === 0) {
    return {
      languages,
      modifications: {
        adapted: [],
        unchanged: languages.map(l => l.name),
      },
    };
  }

  // Verifier si au moins une langue du CV est mentionnee dans l'offre
  const cvLanguageNames = languages.map(l => l.name.toLowerCase());
  const hasMatchingLanguage = languageMentions.some(mention =>
    cvLanguageNames.some(cvLang =>
      cvLang.includes(mention.toLowerCase()) || mention.toLowerCase().includes(cvLang)
    )
  );

  if (!hasMatchingLanguage) {
    return {
      languages,
      modifications: {
        adapted: [],
        unchanged: languages.map(l => l.name),
      },
    };
  }

  // Appeler l'IA pour adapter les langues
  try {
    const model = await getAiModelSetting('model_cv_batch_summary'); // Utiliser le meme modele que summary
    const systemPrompt = await loadPrompt('recompose-languages-system.md');
    const userPromptTemplate = await loadPrompt('recompose-languages-user.md');
    const schema = await loadSchema('recomposeLanguagesSchema.json');

    const userPrompt = replaceVariables(userPromptTemplate, {
      languagesJson: JSON.stringify(languages, null, 2),
      jobTitle: jobOffer.title || 'Non specifie',
      jobDescription: (jobOffer.description || '').substring(0, 500),
      languageMentions: languageMentions.join(', '),
      targetLanguage,
    });

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
      temperature: 0.1,
      max_completion_tokens: 500,
    };

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response for languages');
    }

    // Sanitize result for PostgreSQL (remove \u0000 characters)
    const result = sanitizeForPostgres(JSON.parse(content));

    const promptTokens = response.usage?.prompt_tokens || 0;
    const completionTokens = response.usage?.completion_tokens || 0;
    const cachedTokens = response.usage?.prompt_tokens_details?.cached_tokens || 0;

    if (userId) {
      await trackOpenAIUsage({
        userId,
        featureName: 'cv_pipeline_v2_recompose_languages',
        model,
        promptTokens,
        completionTokens,
        cachedTokens,
        duration: 0,
      });
    }

    return result;
  } catch (error) {
    console.error('[recompose] Language adaptation failed, keeping originals:', error.message);
    return {
      languages,
      modifications: {
        adapted: [],
        unchanged: languages.map(l => l.name),
      },
    };
  }
}

/**
 * Extrait les modifications de l'IA depuis batchResults
 *
 * Cree des changements pour TOUS les champs modifies par l'IA:
 * - title, description: valeurs texte directes
 * - responsibilities, deliverables: tableaux de strings
 * - skills_used: tableau de skills
 *
 * @returns {{ aiChanges: Array, aiReasons: Map<string, string> }}
 */
function extractChangesFromBatchResults(batchResults, sourceCv) {
  const changes = [];
  const aiReasons = new Map();

  // Helper pour formater un tableau en bullets pour l'affichage
  const formatBullets = (arr) => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return '';
    return arr.map(item => `• ${typeof item === 'string' ? item : item.name || item}`).join('\n');
  };

  // Helper pour comparer deux tableaux
  const arraysAreDifferent = (a, b) => {
    if (!a && !b) return false;
    if (!a || !b) return true;
    if (a.length !== b.length) return true;
    return JSON.stringify(a) !== JSON.stringify(b);
  };

  // Extraire les modifications des experiences
  if (batchResults.experiences && Array.isArray(batchResults.experiences)) {
    batchResults.experiences.forEach((adaptedExp, expIndex) => {
      if (!adaptedExp.modifications || !Array.isArray(adaptedExp.modifications)) return;

      const originalExp = sourceCv.experience?.[expIndex];
      const expTitle = adaptedExp.title || originalExp?.title || `Experience ${expIndex + 1}`;

      for (const mod of adaptedExp.modifications) {
        if (!mod.field) continue;

        // Stocker la raison IA
        const reasonKey = `exp.${expIndex}.${mod.field}`;
        if (mod.reason) {
          aiReasons.set(reasonKey, mod.reason);
        }

        // Champs TEXTE (description)
        if (mod.field === 'description' && mod.action === 'modified') {
          const beforeValue = originalExp?.[mod.field] || '';
          const afterValue = adaptedExp[mod.field] || '';

          if (beforeValue !== afterValue) {
            changes.push({
              id: generateChangeId(),
              section: 'experience',
              field: mod.field,
              path: `experience[${expIndex}].${mod.field}`,
              expIndex,
              changeType: 'modified',
              itemName: 'Description',
              beforeValue,
              afterValue,
              beforeDisplay: beforeValue,
              afterDisplay: afterValue,
              change: `Description modifiee dans "${expTitle}"`,
              reason: mod.reason || 'Adaptation au poste cible',
              status: 'pending',
            });
          }
        }

        // Champs ARRAY (responsibilities, deliverables)
        if (['responsibilities', 'deliverables'].includes(mod.field) && mod.action === 'modified') {
          const beforeValue = originalExp?.[mod.field] || [];
          const afterValue = adaptedExp[mod.field] || [];

          if (arraysAreDifferent(beforeValue, afterValue)) {
            const fieldLabel = mod.field === 'responsibilities' ? 'Responsabilites' : 'Resultats';
            changes.push({
              id: generateChangeId(),
              section: 'experience',
              field: mod.field,
              path: `experience[${expIndex}].${mod.field}`,
              expIndex,
              changeType: 'modified',
              itemName: fieldLabel,
              beforeValue,
              afterValue,
              beforeDisplay: formatBullets(beforeValue),
              afterDisplay: formatBullets(afterValue),
              change: `${fieldLabel} modifies dans "${expTitle}"`,
              reason: mod.reason || 'Adaptation au poste cible',
              status: 'pending',
            });
          }
        }

        // Champ skills_used
        if (mod.field === 'skills_used' && mod.action === 'modified') {
          const beforeValue = originalExp?.skills_used || [];
          const afterValue = adaptedExp.skills_used || [];

          if (arraysAreDifferent(beforeValue, afterValue)) {
            changes.push({
              id: generateChangeId(),
              section: 'experience',
              field: 'skills_used',
              path: `experience[${expIndex}].skills_used`,
              expIndex,
              changeType: 'modified',
              itemName: 'Competences utilisees',
              beforeValue,
              afterValue,
              beforeDisplay: beforeValue.join(', '),
              afterDisplay: afterValue.join(', '),
              change: `Competences modifiees dans "${expTitle}"`,
              reason: mod.reason || 'Adaptation au poste cible',
              status: 'pending',
            });
          }
        }
      }
    });
  }

  // Extraire les modifications du summary
  if (batchResults.summary?.modifications && Array.isArray(batchResults.summary.modifications)) {
    for (const mod of batchResults.summary.modifications) {
      if (!mod.field) continue;

      if (mod.field === 'description' && mod.action === 'generated') {
        const beforeValue = sourceCv.summary?.description || '';
        const afterValue = batchResults.summary?.description || mod.after || '';

        if (beforeValue !== afterValue) {
          changes.push({
            id: generateChangeId(),
            section: 'summary',
            field: 'description',
            path: 'summary.description',
            changeType: 'modified',
            beforeValue,
            afterValue,
            beforeDisplay: beforeValue,
            afterDisplay: afterValue,
            change: 'Description du profil adaptee',
            reason: mod.reason || 'Adaptation au poste cible',
            status: 'pending',
          });
        }
      }

    }
  }

  // Extraire les modifications des skills
  if (batchResults.skills?.modifications && Array.isArray(batchResults.skills.modifications)) {
    for (const mod of batchResults.skills.modifications) {
      if (!mod.skill || !mod.action) continue;

      const category = mod.category || 'skills';
      changes.push({
        id: generateChangeId(),
        section: 'skills',
        field: category,
        path: `skills.${category}`,
        changeType: mod.action === 'removed' ? 'removed' : 'added',
        itemName: mod.skill,
        beforeValue: mod.action === 'removed' ? mod.skill : null,
        afterValue: mod.action === 'added' ? mod.skill : null,
        beforeDisplay: mod.action === 'removed' ? mod.skill : '',
        afterDisplay: mod.action === 'added' ? mod.skill : '',
        change: mod.action === 'removed' ? `"${mod.skill}" supprime` : `"${mod.skill}" ajoute`,
        reason: mod.reason || 'Adaptation au poste cible',
        status: 'pending',
      });
    }
  }

  return { aiChanges: changes, aiReasons };
}

/**
 * Genere un nom de fichier unique pour le CV genere
 */
function generateCvFileName(sourceCvFileName, jobOfferTitle) {
  // Utiliser un timestamp precis (YYYYMMDDHHmmss) + suffixe aleatoire pour garantir l'unicite
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const sanitizedTitle = (jobOfferTitle || 'offer')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30);
  const baseName = sourceCvFileName.replace(/\.json$/, '');
  return `${baseName}_adapted_${sanitizedTitle}_${timestamp}_${randomSuffix}.json`;
}

/**
 * Execute la phase de recomposition
 *
 * @param {Object} params
 * @param {string} params.offerId - ID de la CvGenerationOffer
 * @param {Object} params.sourceCv - CV source complet
 * @param {string} params.sourceCvFileName - Nom du fichier CV source
 * @param {Object} params.batchResults - Resultats de tous les batches
 * @param {Object} params.jobOffer - Offre d'emploi (contenu JSON)
 * @param {string} params.jobOfferId - ID de la JobOffer dans la base de données
 * @param {string} params.targetLanguage - Langue cible
 * @param {string} params.userId - ID utilisateur
 * @param {AbortSignal} params.signal - Signal d'annulation
 * @returns {Promise<Object>}
 */
export async function executeRecomposition({
  offerId,
  sourceCv,
  sourceCvFileName,
  batchResults,
  jobOffer,
  jobOfferId = null,
  targetLanguage = 'francais',
  userId,
  signal = null,
}) {
  const startTime = Date.now();

  console.log(`[recompose] Assembling final CV for offer ${offerId}`);

  // Note: jobOffer vient de Prisma, le contenu est dans .content (JSON)
  // Les fonctions internes (detectLanguageMentions, adaptLanguages) attendent la structure plate
  const jobOfferContent = jobOffer?.content || jobOffer || {};

  // Creer la subtask
  const subtask = await prisma.cvGenerationSubtask.create({
    data: {
      offerId,
      type: 'recompose',
      status: 'running',
      input: {
        sourceCvFileName,
        hasExperiences: !!batchResults.experiences?.length,
        hasProjects: !!batchResults.projects?.length,
        hasSkills: !!batchResults.skills,
        hasSummary: !!batchResults.summary,
        hasExtras: !!batchResults.extras?.length,
      },
      startedAt: new Date(),
    },
  });

  try {
    // 1. Adapter les langues si necessaire
    const languagesResult = await adaptLanguages({
      languages: sourceCv.languages || [],
      jobOffer: jobOfferContent,
      targetLanguage,
      userId,
      signal,
    });

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    // 2. Assembler le CV final
    const jobTitle = jobOfferContent?.title || '';

    // Sanitize all adapted data for PostgreSQL (remove \u0000 characters)
    const adaptedCv = sanitizeForPostgres({
      generated_at: new Date().toISOString(),
      header: {
        ...sourceCv.header,
        current_title: jobTitle || sourceCv.header?.current_title,
      },
      summary: batchResults.summary || sourceCv.summary,
      skills: batchResults.skills || sourceCv.skills,
      experience: batchResults.experiences || sourceCv.experience || [],
      projects: batchResults.projects || sourceCv.projects || [],
      education: sourceCv.education || [],
      languages: languagesResult.languages,
      extras: batchResults.extras || sourceCv.extras || [],
      section_order: sourceCv.section_order,
    });

    // 3. Generer le nom du fichier
    const generatedFileName = generateCvFileName(sourceCvFileName, jobTitle);

    // 4. Creer le CvFile
    // sourceType doit etre 'link' pour que les icones info/score s'affichent
    // sourceValue doit etre l'URL de l'offre
    // jobOfferId doit etre defini pour que hasJobOffer soit true (necessaire pour MatchScore)
    const cvFile = await prisma.cvFile.create({
      data: {
        userId,
        filename: generatedFileName,
        content: adaptedCv,
        contentVersion: 1, // 1 = version actuelle, v0 est la source pour le diff
        sourceType: 'link',
        sourceValue: jobOffer?.url || offerId,
        jobOfferId: jobOfferId || null,
        language: targetLanguage === 'francais' ? 'fr' :
                  targetLanguage === 'anglais' ? 'en' :
                  targetLanguage === 'allemand' ? 'de' :
                  targetLanguage === 'espagnol' ? 'es' : 'fr',
        createdBy: 'generate-cv', // Important: doit etre 'generate-cv' pour le logo IA dans la liste
        originalCreatedBy: sourceCv.header?.name || 'User',
      },
    });

    // 5. Creer la CvVersion 0 (source de reference) pour le systeme de diff/review
    // Note: v0 est filtree dans l'API versions, elle sert uniquement pour les comparaisons
    // Le contenu adapte est dans CvFile.content (version actuelle)
    await prisma.cvVersion.create({
      data: {
        cvFileId: cvFile.id,
        version: 0,
        content: sourceCv,
        changelog: `Version source (reference)`,
        changeType: 'import',
        sourceFile: sourceCvFileName,
      },
    });

    // 6. Initialiser le systeme de review avec les modifications de l'IA uniquement
    // Note: On n'utilise plus computeCvDiff car il genere trop de modifications invisibles
    try {
      // Extraire les modifications de l'IA depuis batchResults
      const { aiChanges } = extractChangesFromBatchResults(batchResults, sourceCv);
      console.log(`[recompose] Extracted ${aiChanges.length} AI change(s) from batchResults`);

      const changesMade = aiChanges;
      console.log(`[recompose] Total changes for review: ${changesMade.length} (AI only, no programmatic diff)`);

      // Initialiser l'etat de review (version source = 0)
      await initializeReviewState(userId, generatedFileName, changesMade, 0);
      console.log(`[recompose] Review state initialized for ${generatedFileName}`);
    } catch (reviewError) {
      // Ne pas faire echouer la generation si le review echoue
      console.error(`[recompose] Error initializing review state:`, reviewError.message);
    }

    // 7. Mettre a jour CvGenerationOffer (batchResults already sanitized in each phase)
    await prisma.cvGenerationOffer.update({
      where: { id: offerId },
      data: {
        generatedCvFileId: cvFile.id,
        generatedCvFileName: generatedFileName,
        batchResults: sanitizeForPostgres({
          experiences: batchResults.experiences,
          projects: batchResults.projects,
          skills: batchResults.skills,
          summary: batchResults.summary,
          extras: batchResults.extras,
          languages: languagesResult,
        }),
      },
    });

    const duration = Date.now() - startTime;

    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'completed',
        output: {
          cvFileId: cvFile.id,
          filename: generatedFileName,
          languageModifications: languagesResult.modifications,
        },
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    console.log(`[recompose] Completed in ${duration}ms:`, {
      cvFileId: cvFile.id,
      filename: generatedFileName,
      languagesAdapted: languagesResult.modifications.adapted.length,
    });

    return {
      success: true,
      cvFileId: cvFile.id,
      filename: generatedFileName,
      adaptedCv,
      languageModifications: languagesResult.modifications,
      subtaskId: subtask.id,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    await prisma.cvGenerationSubtask.update({
      where: { id: subtask.id },
      data: {
        status: 'failed',
        error: error.message,
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    console.error(`[recompose] Failed after ${duration}ms:`, error.message);

    return {
      success: false,
      error: error.message,
      subtaskId: subtask.id,
      duration,
    };
  }
}

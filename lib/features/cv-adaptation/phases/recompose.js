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
 * Cree une CvVersion avec origin gpt_cv_generation.
 * Met a jour CvGenerationOffer.generatedCvFileId.
 */

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getOpenAIClient } from '@/lib/openai-core/client';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage, calculateCost } from '@/lib/telemetry/openai';
import { initializeReviewState, generateChangeId } from '@/lib/cv-core/changeTracking';
import { computeCvDiff, computeArrayItemDiff } from '@/lib/cv-core/modifications/diff';
import { sanitizeForPostgres } from '../utils/sanitize.js';

const PROMPTS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/features/cv-adaptation/schemas');

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
        featureName: 'cv_adaptation_languages',
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

        // Champ skills_used - génère des changements individuels pour chaque skill
        // Priorité : utiliser skills_modifications si fourni par l'IA (correspondance before/after)
        if (mod.field === 'skills_used' && mod.action === 'modified') {
          // skills_modifications sera traité en dehors de la boucle modifications
          // pour éviter la duplication
        }
      }

      // Traiter skills_modifications si fourni par l'IA (priorité sur computeArrayItemDiff)
      if (adaptedExp.skills_modifications && Array.isArray(adaptedExp.skills_modifications)) {
        for (const skillMod of adaptedExp.skills_modifications) {
          // Ignorer les skills conservés sans modification
          if (skillMod.action === 'kept') continue;

          let changeType = skillMod.action; // 'modified', 'removed', ou 'added'
          let itemName = skillMod.after || skillMod.before;
          let beforeValue = skillMod.before;
          let afterValue = skillMod.after;
          let beforeDisplay = skillMod.before || '';
          let afterDisplay = skillMod.after || '';
          let changeDescription = '';

          if (skillMod.action === 'modified') {
            // Skill traduit/reformulé
            changeDescription = `Skill reformule: "${skillMod.before}" → "${skillMod.after}"`;
          } else if (skillMod.action === 'removed') {
            // Skill supprimé - utiliser la traduction si disponible
            const translatedName = skillMod.translated || skillMod.before;
            itemName = translatedName;
            beforeValue = translatedName;
            beforeDisplay = skillMod.before; // Nom original pour la déduplication
            changeDescription = `Skill supprime: "${translatedName}"`;
          } else {
            // Skill ajouté
            changeDescription = `Skill ajoute: "${skillMod.after}"`;
          }

          changes.push({
            id: generateChangeId(),
            section: 'experience',
            field: 'skills_used',
            path: `experience[${expIndex}].skills_used`,
            expIndex,
            changeType,
            itemName,
            beforeValue,
            afterValue,
            beforeDisplay,
            afterDisplay,
            change: changeDescription,
            reason: skillMod.reason || 'Adaptation au poste cible',
            status: 'pending',
          });
        }
      } else {
        // Fallback : utiliser computeArrayItemDiff si skills_modifications non fourni
        const beforeValue = originalExp?.skills_used || [];
        const afterValue = adaptedExp.skills_used || [];

        if (arraysAreDifferent(beforeValue, afterValue)) {
          const skillChanges = computeArrayItemDiff(
            afterValue,
            beforeValue,
            'experience',
            'skills_used',
            `experience[${expIndex}].skills_used`
          );
          // Ajouter expIndex et id à chaque changement
          skillChanges.forEach(c => {
            c.id = generateChangeId();
            c.expIndex = expIndex;
            c.status = 'pending';
          });
          changes.push(...skillChanges);
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

  // Extraire les modifications des skills (format before/after aligné sur experience)
  if (batchResults.skills?.modifications && Array.isArray(batchResults.skills.modifications)) {
    // Créer un Set des skills qui ont une action "modified" pour éviter les doublons avec "removed"
    // L'IA génère parfois both modified ET removed pour le même skill (incohérent)
    const modifiedSkills = new Set(
      batchResults.skills.modifications
        .filter(m => m.action === 'modified' && m.before)
        .map(m => `${m.category}|${m.before.toLowerCase()}`)
    );

    for (const mod of batchResults.skills.modifications) {
      // Ignorer les skills conservés sans modification
      if (mod.action === 'kept') continue;

      // Vérifier qu'on a au moins before ou after
      if (!mod.before && !mod.after) continue;

      // Si c'est un "removed" mais qu'il existe déjà un "modified" pour ce skill, ignorer
      // (l'IA génère parfois les deux de manière incohérente)
      if (mod.action === 'removed' && mod.before) {
        const key = `${mod.category}|${mod.before.toLowerCase()}`;
        if (modifiedSkills.has(key)) {
          console.log(`[recompose] Ignoring duplicate removed for skill already modified: ${mod.before}`);
          continue;
        }
      }

      // category est obligatoire selon le schéma, mais fallback par sécurité
      const category = mod.category || 'hard_skills';
      const sourceCategory = sourceCv.skills?.[category] || [];
      const adaptedCategory = batchResults.skills?.[category] || [];

      // Récupérer l'objet complet depuis sourceCv (pour proficiency)
      const sourceSkillObj = mod.before ? sourceCategory.find(s => {
        const sName = typeof s === 'string' ? s : s.name || '';
        return sName.toLowerCase() === mod.before.toLowerCase();
      }) : null;

      // Récupérer le skill adapté (avec le nouveau proficiency) depuis batchResults
      const adaptedSkillObj = mod.after ? adaptedCategory.find(s => {
        const sName = typeof s === 'string' ? s : s.name || '';
        return sName.toLowerCase() === mod.after.toLowerCase();
      }) : null;

      // Déterminer le changeType et les valeurs selon l'action de l'IA
      let changeType;
      let itemName;
      let itemValue = null;
      let beforeValue = null;
      let afterValue = null;
      let beforeDisplay = '';
      let afterDisplay = '';
      let changeDescription = '';

      if (mod.action === 'modified') {
        // Skill traduit/reformulé : before → after
        changeType = 'modified';
        itemName = mod.after;
        beforeValue = mod.before;
        afterValue = mod.after;
        beforeDisplay = mod.before;
        afterDisplay = mod.after;
        changeDescription = `"${mod.before}" → "${mod.after}"`;
      } else if (mod.action === 'removed') {
        // Skill vraiment supprimé
        changeType = 'removed';
        // Utiliser la traduction si disponible pour le rollback (dans la langue cible)
        const translatedName = mod.translated || mod.before;
        // Pour itemValue, créer un objet avec le nom traduit mais conserver le proficiency du source
        if (sourceSkillObj && typeof sourceSkillObj === 'object') {
          itemValue = { ...sourceSkillObj, name: translatedName };
        } else {
          itemValue = translatedName;
        }
        // beforeValue = traduction (pour le rollback dans la langue cible)
        // beforeDisplay = nom original (pour l'affichage et la déduplication avec le diff)
        // itemName = traduction (ce qui sera affiché comme élément supprimé)
        beforeValue = translatedName;
        beforeDisplay = mod.before;
        itemName = translatedName;
        changeDescription = `"${translatedName}" supprime`;
      } else if (mod.action === 'level_adjusted') {
        // Niveau ajusté
        changeType = 'level_adjusted';
        itemName = mod.after || mod.before;
        // Pour level_adjusted, beforeValue/afterValue sont les niveaux de proficiency
        const oldProficiency = typeof sourceSkillObj === 'object' ? sourceSkillObj.proficiency : null;
        const newProficiency = typeof adaptedSkillObj === 'object' ? adaptedSkillObj.proficiency : null;
        itemValue = sourceSkillObj;
        beforeValue = oldProficiency;
        afterValue = newProficiency;
        beforeDisplay = oldProficiency !== null ? `Niveau ${oldProficiency}` : '';
        afterDisplay = newProficiency !== null ? `Niveau ${newProficiency}` : '';
        changeDescription = `"${mod.after || mod.before}" niveau ajuste (${oldProficiency} → ${newProficiency})`;
      } else {
        // added, inferred, split, moved, merged
        changeType = 'added';
        itemName = mod.after;
        afterValue = mod.after;
        afterDisplay = mod.after;
        changeDescription = `"${mod.after}" ajoute`;
      }

      changes.push({
        id: generateChangeId(),
        section: 'skills',
        field: category,
        path: `skills.${category}`,
        changeType,
        itemName,
        itemValue,
        beforeValue,
        afterValue,
        beforeDisplay,
        afterDisplay,
        change: changeDescription,
        reason: mod.reason || 'Adaptation au poste cible',
        status: 'pending',
      });
    }
  }

  // Extraire les modifications des extras (mapping before/after)
  if (batchResults.extras_modifications && Array.isArray(batchResults.extras_modifications)) {
    for (const extraMod of batchResults.extras_modifications) {
      // Ignorer les extras conservés sans modification
      if (extraMod.action === 'kept') continue;

      let changeType = extraMod.action; // 'modified', 'removed', ou 'added'

      // Trouver l'extra source et l'extra adapté
      const sourceExtra = sourceCv.extras?.find(e =>
        e.name?.toLowerCase() === extraMod.before_name?.toLowerCase()
      );
      const adaptedExtra = batchResults.extras?.find(e =>
        e.name?.toLowerCase() === extraMod.after_name?.toLowerCase()
      );

      // Déterminer le nom à afficher
      const itemName = extraMod.after_name || extraMod.before_name;

      // Construire la description du changement
      let changeDescription = '';
      if (changeType === 'modified') {
        if (extraMod.before_name !== extraMod.after_name) {
          changeDescription = `Extra "${extraMod.before_name}" → "${extraMod.after_name}"`;
        } else {
          changeDescription = `Extra "${extraMod.before_name}" modifié`;
        }
      } else if (changeType === 'removed') {
        changeDescription = `« ${extraMod.before_name} » supprimé`;
      } else {
        changeDescription = `${extraMod.after_name} ajouté`;
      }

      changes.push({
        id: generateChangeId(),
        section: 'extras',
        field: 'extras',
        path: 'extras',
        itemName,
        changeType,
        beforeValue: sourceExtra || { name: extraMod.before_name },
        afterValue: adaptedExtra || { name: extraMod.after_name },
        change: changeDescription,
        reason: extraMod.reason || 'Adaptation au poste cible',
        status: 'pending',
      });
    }
  }

  return { aiChanges: changes, aiReasons };
}

/**
 * Detecte si deux strings sont probablement des traductions l'une de l'autre
 */
function isLikelyTranslation(str1, str2) {
  if (!str1 || !str2) return false;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Cas identique (meme langue) - pas une traduction
  if (s1 === s2) return false;

  // Mapping connu EN→FR pour skills courants
  const knownTranslations = {
    'multicultural adaptability': 'adaptabilite multiculturelle',
    'project management': 'gestion de projet',
    'change management': 'gestion du changement',
    'team player': 'esprit d\'equipe',
    'data analytics': 'analyse de donnees',
    'data analysis': 'analyse de donnees',
    'customer success': 'succes client',
    'business transformation': 'transformation d\'entreprise',
    'digital transformation': 'transformation digitale',
    'strategic analysis': 'analyse strategique',
    'customer-oriented': 'orientation client',
    'problem solving': 'resolution de problemes',
    'communication': 'communication',
    'leadership': 'leadership',
    'teamwork': 'travail d\'equipe',
    'adaptability': 'adaptabilite',
    'creativity': 'creativite',
    'time management': 'gestion du temps',
    'critical thinking': 'esprit critique',
    'attention to detail': 'rigueur',
    'self-motivated': 'autonomie',
    'work ethic': 'ethique professionnelle',
  };

  // Verifier mapping direct (EN→FR ou FR→EN)
  if (knownTranslations[s1] === s2 || knownTranslations[s2] === s1) {
    return true;
  }

  // Similarite basique : mots en commun pour skills courts
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  // Ne pas comparer des strings trop longues
  if (words1.length > 4 || words2.length > 4) return false;

  // Chercher des sous-chaines communes significatives (>3 chars)
  const commonWords = words1.filter(w =>
    w.length > 3 && words2.some(w2 =>
      w2.length > 3 && (w2.includes(w) || w.includes(w2))
    )
  );

  return commonWords.length >= 1;
}

/**
 * Fusionne les paires removed+added qui sont en fait des traductions
 * en une seule entree modified
 */
function mergeTranslationPairs(changes) {
  const removed = changes.filter(c => c.changeType === 'removed');
  const added = changes.filter(c => c.changeType === 'added');
  const others = changes.filter(c => !['removed', 'added'].includes(c.changeType));

  const merged = [];
  const usedRemovedIds = new Set();
  const usedAddedIds = new Set();

  for (const addedChange of added) {
    // Chercher un removed correspondant (meme section, meme field)
    const matchingRemoved = removed.find(r =>
      r.section === addedChange.section &&
      r.field === addedChange.field &&
      r.expIndex === addedChange.expIndex && // Meme experience si applicable
      !usedRemovedIds.has(r.id) &&
      isLikelyTranslation(r.itemName || r.beforeValue, addedChange.itemName || addedChange.afterValue)
    );

    if (matchingRemoved) {
      // Fusionner en modified
      merged.push({
        ...addedChange,
        id: matchingRemoved.id, // Garder l'id du removed
        changeType: 'modified',
        beforeValue: matchingRemoved.beforeValue || matchingRemoved.itemName,
        afterValue: addedChange.afterValue || addedChange.itemName,
        beforeDisplay: matchingRemoved.beforeDisplay || matchingRemoved.itemName,
        afterDisplay: addedChange.afterDisplay || addedChange.itemName,
        itemName: addedChange.itemName, // Langue cible
        change: `"${matchingRemoved.itemName}" → "${addedChange.itemName}"`,
        reason: addedChange.reason || matchingRemoved.reason || 'Traduction',
      });
      usedRemovedIds.add(matchingRemoved.id);
      usedAddedIds.add(addedChange.id);
    }
  }

  // Ajouter les removed et added non fusionnes
  const unusedRemoved = removed.filter(r => !usedRemovedIds.has(r.id));
  const unusedAdded = added.filter(a => !usedAddedIds.has(a.id));

  return [...others, ...merged, ...unusedRemoved, ...unusedAdded];
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

    // 6. Initialiser le systeme de review avec les modifications de l'IA + suppressions detectees
    try {
      // Extraire les modifications de l'IA depuis batchResults
      const { aiChanges } = extractChangesFromBatchResults(batchResults, sourceCv);
      console.log(`[recompose] Extracted ${aiChanges.length} AI change(s) from batchResults`);

      // Detecter les changements via diff programmatique
      const programmaticChanges = computeCvDiff(adaptedCv, sourceCv);

      // Filtrer pour les suppressions (removed, experience_removed)
      const removedItems = programmaticChanges.filter(c =>
        c.changeType === 'removed' ||
        c.changeType === 'experience_removed'
      );
      console.log(`[recompose] Detected ${removedItems.length} removed item(s) via programmatic diff`);

      // Filtrer pour les ajouts (added) - pour les skills que l'IA n'a pas documentés
      const addedItems = programmaticChanges.filter(c => c.changeType === 'added');
      console.log(`[recompose] Detected ${addedItems.length} added item(s) via programmatic diff`);

      // Créer un Set des clés déjà présentes dans aiChanges pour éviter les doublons
      const aiChangeKeys = new Set(
        aiChanges.map(c => {
          const key = `${c.section}|${c.field}|${c.itemName || ''}|${c.expIndex ?? ''}`;
          return key.toLowerCase();
        })
      );

      // Créer un Set des beforeValue des changements "modified" pour les skills
      // Ces beforeValue correspondent aux skills qui seront détectées comme "supprimées" par le diff
      // mais qui sont en fait des traductions/reformulations
      // Inclut: skills_used (experience) + hard_skills, soft_skills, tools, methodologies (section skills)
      const skillFields = ['skills_used', 'hard_skills', 'soft_skills', 'tools', 'methodologies'];
      const modifiedBeforeValues = new Set(
        aiChanges
          .filter(c => c.changeType === 'modified' && skillFields.includes(c.field) && c.beforeValue)
          .map(c => {
            const key = `${c.section}|${c.field}|${c.beforeValue}|${c.expIndex ?? ''}`;
            return key.toLowerCase();
          })
      );

      // Créer un Set des noms originaux (beforeDisplay) des skills supprimés par l'IA
      // Pour les skills supprimés, l'IA génère itemName = traduction, mais beforeDisplay = nom original
      // Le diff programmatique détecte le nom original comme manquant, il faut donc l'exclure
      const removedOriginalNames = new Set(
        aiChanges
          .filter(c => c.changeType === 'removed' && skillFields.includes(c.field) && c.beforeDisplay)
          .map(c => {
            const key = `${c.section}|${c.field}|${c.beforeDisplay}|${c.expIndex ?? ''}`;
            return key.toLowerCase();
          })
      );

      // Filtrer removedItems pour exclure :
      // 1. Ceux déjà présents dans aiChanges (même itemName)
      // 2. Ceux dont l'itemName correspond au beforeValue d'un changement modified (traductions)
      // 3. Ceux dont l'itemName correspond au nom original d'un skill supprimé par l'IA
      const uniqueRemovedItems = removedItems.filter(c => {
        const key = `${c.section}|${c.field}|${c.itemName || ''}|${c.expIndex ?? ''}`.toLowerCase();
        // Exclure si déjà dans aiChanges, si c'est une valeur "avant" d'une modification,
        // ou si c'est le nom original d'un skill supprimé par l'IA
        return !aiChangeKeys.has(key) && !modifiedBeforeValues.has(key) && !removedOriginalNames.has(key);
      });
      console.log(`[recompose] After dedup: ${uniqueRemovedItems.length} unique removed item(s)`);

      // Filtrer addedItems pour exclure ceux déjà présents dans aiChanges
      const uniqueAddedItems = addedItems.filter(c => {
        const key = `${c.section}|${c.field}|${c.itemName || ''}|${c.expIndex ?? ''}`.toLowerCase();
        return !aiChangeKeys.has(key);
      });
      console.log(`[recompose] After dedup: ${uniqueAddedItems.length} unique added item(s)`);

      // Fusionner : changements IA + suppressions + ajouts detectes (sans doublons)
      const deduplicatedChanges = [...aiChanges, ...uniqueRemovedItems, ...uniqueAddedItems];
      console.log(`[recompose] Before translation merge: ${deduplicatedChanges.length} changes (${aiChanges.length} AI + ${uniqueRemovedItems.length} removed + ${uniqueAddedItems.length} added)`);

      // Fusionner les paires removed+added qui sont en fait des traductions
      const changesMade = mergeTranslationPairs(deduplicatedChanges);
      const mergeCount = deduplicatedChanges.length - changesMade.length;
      if (mergeCount > 0) {
        console.log(`[recompose] Merged ${mergeCount} translation pair(s) into modified changes`);
      }
      console.log(`[recompose] Total changes for review: ${changesMade.length}`);

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

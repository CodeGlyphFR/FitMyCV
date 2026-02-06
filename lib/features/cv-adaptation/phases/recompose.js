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

import prisma from '@/lib/prisma';
import { initializeReviewState, generateChangeId } from '@/lib/cv-core/changeTracking';
import { computeCvDiff, computeArrayItemDiff } from '@/lib/cv-core/modifications/diff';
import { sanitizeForPostgres } from '../utils/sanitize.js';


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

  // Extraire les modifications des experiences (nouveau format v3)
  // Les raisons sont stockees dans _description_reason, _responsibilities_reason, _deliverables_reason
  if (batchResults.experiences && Array.isArray(batchResults.experiences)) {
    batchResults.experiences.forEach((adaptedExp, expIndex) => {
      const originalExp = sourceCv.experience?.[expIndex];
      const expTitle = adaptedExp.title || originalExp?.title || `Experience ${expIndex + 1}`;

      // Détecter les modifications sur title (si raison presente = modifie par l'IA)
      if (adaptedExp._title_reason) {
        const beforeValue = originalExp?.title || '';
        const afterValue = adaptedExp.title || '';

        if (beforeValue !== afterValue) {
          changes.push({
            id: generateChangeId(),
            section: 'experience',
            field: 'title',
            path: `experience[${expIndex}].title`,
            expIndex,
            changeType: 'modified',
            itemName: 'Titre',
            beforeValue,
            afterValue,
            beforeDisplay: beforeValue,
            afterDisplay: afterValue,
            change: `Titre modifie dans "${expTitle}"`,
            reason: adaptedExp._title_reason,
            status: 'pending',
          });
        }
      }

      // Détecter les modifications sur description (si raison presente = modifie)
      if (adaptedExp._description_reason) {
        const beforeValue = originalExp?.description || '';
        const afterValue = adaptedExp.description || '';

        if (beforeValue !== afterValue) {
          changes.push({
            id: generateChangeId(),
            section: 'experience',
            field: 'description',
            path: `experience[${expIndex}].description`,
            expIndex,
            changeType: 'modified',
            itemName: 'Description',
            beforeValue,
            afterValue,
            beforeDisplay: beforeValue,
            afterDisplay: afterValue,
            change: `Description modifiee dans "${expTitle}"`,
            reason: adaptedExp._description_reason,
            status: 'pending',
          });
        }
      }

      // Détecter les modifications sur responsibilities (si raison presente = modifie)
      if (adaptedExp._responsibilities_reason) {
        const beforeValue = originalExp?.responsibilities || [];
        const afterValue = adaptedExp.responsibilities || [];

        if (arraysAreDifferent(beforeValue, afterValue)) {
          changes.push({
            id: generateChangeId(),
            section: 'experience',
            field: 'responsibilities',
            path: `experience[${expIndex}].responsibilities`,
            expIndex,
            changeType: 'modified',
            itemName: 'Responsabilites',
            beforeValue,
            afterValue,
            beforeDisplay: formatBullets(beforeValue),
            afterDisplay: formatBullets(afterValue),
            change: `Responsabilites modifiees dans "${expTitle}"`,
            reason: adaptedExp._responsibilities_reason,
            status: 'pending',
          });
        }
      }

      // Détecter les modifications sur deliverables (si raison presente = modifie)
      if (adaptedExp._deliverables_reason) {
        const beforeValue = originalExp?.deliverables || [];
        const afterValue = adaptedExp.deliverables || [];

        if (arraysAreDifferent(beforeValue, afterValue)) {
          changes.push({
            id: generateChangeId(),
            section: 'experience',
            field: 'deliverables',
            path: `experience[${expIndex}].deliverables`,
            expIndex,
            changeType: 'modified',
            itemName: 'Resultats',
            beforeValue,
            afterValue,
            beforeDisplay: formatBullets(beforeValue),
            afterDisplay: formatBullets(afterValue),
            change: `Resultats modifies dans "${expTitle}"`,
            reason: adaptedExp._deliverables_reason,
            status: 'pending',
          });
        }
      }

      // Traiter skill_changes (nouveau format v2)
      // skill_changes contient UNIQUEMENT les skills modified ou removed (pas les kept)
      if (adaptedExp.skill_changes && Array.isArray(adaptedExp.skill_changes)) {
        for (const skillChange of adaptedExp.skill_changes) {
          const isRemoved = skillChange.after === null;
          const changeType = isRemoved ? 'removed' : 'modified';
          const itemName = skillChange.after || skillChange.before;

          let changeDescription = '';
          if (isRemoved) {
            changeDescription = `Skill supprime: "${skillChange.before}"`;
          } else {
            changeDescription = `Skill reformule: "${skillChange.before}" → "${skillChange.after}"`;
          }

          changes.push({
            id: generateChangeId(),
            section: 'experience',
            field: 'skills_used',
            path: `experience[${expIndex}].skills_used`,
            expIndex,
            changeType,
            itemName,
            beforeValue: skillChange.before,
            afterValue: skillChange.after,
            beforeDisplay: skillChange.before || '',
            afterDisplay: skillChange.after || '',
            change: changeDescription,
            reason: skillChange.reason || 'Adaptation au poste cible',
            status: 'pending',
          });
        }
      } else {
        // Fallback : utiliser computeArrayItemDiff si skill_changes non fourni
        const beforeValue = originalExp?.skills_used || [];
        const afterValue = adaptedExp.skills_used || [];

        if (arraysAreDifferent(beforeValue, afterValue)) {
          const skillChangesComputed = computeArrayItemDiff(
            afterValue,
            beforeValue,
            'experience',
            'skills_used',
            `experience[${expIndex}].skills_used`
          );
          // Ajouter expIndex et id à chaque changement
          skillChangesComputed.forEach(c => {
            c.id = generateChangeId();
            c.expIndex = expIndex;
            c.status = 'pending';
          });
          changes.push(...skillChangesComputed);
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

  // Extraire les modifications des skills (nouveau format CoT v2)
  // Le nouveau format a _raw contenant les données brutes de l'IA avec review intégré
  const skillsRaw = batchResults.skills?._raw || batchResults.skills?.modifications;

  // DEBUG: Vérifier la structure de skillsRaw
  console.log('[recompose] DEBUG skillsRaw disponible:', !!skillsRaw);
  if (skillsRaw) {
    const categories = ['hard_skills', 'soft_skills', 'tools', 'methodologies'];
    for (const cat of categories) {
      const consolidated = (skillsRaw[cat] || []).find(s => s.consolidated_from);
      if (consolidated) {
        console.log(`[recompose] DEBUG Skill consolidé dans _raw.${cat}:`, JSON.stringify(consolidated, null, 2));
      }
    }
  }

  if (skillsRaw) {
    // Traiter chaque catégorie de skills
    const categories = ['hard_skills', 'soft_skills', 'tools', 'methodologies'];

    for (const category of categories) {
      const skillItems = skillsRaw[category];
      if (!Array.isArray(skillItems)) continue;

      for (const item of skillItems) {
        // Cas spécial: skill consolidé (plusieurs skills CV → même skill offre)
        // Créer un changement de type "multi_renamed" avec tous les originaux
        if (item.consolidated_from && Array.isArray(item.consolidated_from) && item.consolidated_from.length >= 2) {
          // DEBUG: Log détaillé du skill consolidé
          console.log('[recompose] DEBUG Skill consolidé détecté:', {
            skill_final: item.skill_final,
            consolidated_from: item.consolidated_from,
            reasons: item.consolidated_from?.map(c => ({ original: c.original_value, reason: c.reason })),
          });
          const consolidatedNames = item.consolidated_from.map(c => c.original_value).join(', ');
          changes.push({
            id: generateChangeId(),
            section: 'skills',
            field: category,
            path: `skills.${category}`,
            changeType: 'multi_renamed',
            itemName: item.skill_final,
            // afterValue contient le skill final consolidé
            afterValue: {
              name: item.skill_final,
              proficiency: item.proficiency,
            },
            // items contient les informations de tous les skills originaux
            items: item.consolidated_from.map(c => {
              // Récupérer le skill source pour avoir le proficiency original
              const sourceCategory = sourceCv.skills?.[category] || [];
              const sourceSkillObj = sourceCategory.find((s, idx) => {
                if (c.original_position !== undefined && idx === c.original_position) {
                  return true;
                }
                const sName = typeof s === 'string' ? s : s.name || '';
                return sName.toLowerCase() === c.original_value?.toLowerCase();
              });
              return {
                original_value: c.original_value,
                proficiency: sourceSkillObj?.proficiency || c.proficiency,
                reason: c.reason,
                score: c.score,
                original_position: c.original_position,
              };
            }),
            change: `${item.consolidated_from.length} compétences consolidées en "${item.skill_final}"`,
            reason: item.reason || 'Consolidation de compétences similaires',
            status: 'pending',
            originalPosition: item.original_position,
            matchingProbability: item.probability,
          });
          continue;
        }

        // Ignorer les skills sans review requis et qui ne sont pas deleted
        // (les kept sans traduction n'ont pas besoin de review)
        if (!item.review?.required && item.action !== 'deleted') continue;

        // Récupérer les infos du skill source pour le rollback
        const sourceCategory = sourceCv.skills?.[category] || [];
        const sourceSkillObj = sourceCategory.find((s, idx) => {
          // Matcher par position si available, sinon par nom
          if (item.original_position !== undefined && idx === item.original_position) {
            return true;
          }
          const sName = typeof s === 'string' ? s : s.name || '';
          return sName.toLowerCase() === item.original_value?.toLowerCase();
        });

        // Déterminer le changeType selon l'action CoT
        let changeType;
        let itemName;
        let itemValue = null;
        let beforeValue = null;
        let afterValue = null;
        let beforeDisplay = '';
        let afterDisplay = '';
        let changeDescription = '';

        if (item.action === 'renamed') {
          // Skill renommé pour correspondre à l'offre
          changeType = 'modified';
          itemName = item.skill_final;
          beforeValue = item.original_value;
          afterValue = item.skill_final;
          beforeDisplay = item.original_value;
          afterDisplay = item.skill_final;
          changeDescription = `"${item.original_value}" → "${item.skill_final}"`;
        } else if (item.action === 'kept' && item.review?.required) {
          // Skill conservé mais traduit ou séparé (nécessite review)
          changeType = 'modified';
          itemName = item.skill_final;
          beforeValue = item.original_value;
          afterValue = item.skill_final;
          beforeDisplay = item.original_value;
          afterDisplay = item.skill_final;
          changeDescription = item.separated
            ? `Séparé depuis "${item.separated_from}"`
            : `"${item.original_value}" → "${item.skill_final}"`;
        } else if (item.action === 'deleted') {
          // Skill supprimé
          changeType = 'removed';
          // Pour itemValue, créer un objet avec le nom original et le proficiency du source
          if (sourceSkillObj && typeof sourceSkillObj === 'object') {
            itemValue = { ...sourceSkillObj, name: item.original_value };
          } else if (category === 'hard_skills' || category === 'tools') {
            itemValue = { name: item.original_value, proficiency: item.proficiency };
          } else {
            itemValue = item.original_value;
          }
          beforeValue = item.original_value;
          beforeDisplay = item.original_value;
          itemName = item.original_value;
          changeDescription = `"${item.original_value}" supprimé`;
        } else {
          // Pas de changement significatif, ignorer
          continue;
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
          reason: item.reason || item.review?.popover_content?.reason || 'Adaptation au poste cible',
          status: 'pending',
          // Nouveaux champs pour le système de review CoT
          originalPosition: item.original_position,
          reviewColor: item.review?.color || null,
          popoverContent: item.review?.popover_content || null,
          separatedFrom: item.separated_from || null,
          matchingProbability: item.matching_probability,
        });
      }
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

  // Extraire les modifications des formations (education_modifications)
  if (batchResults.education_modifications && Array.isArray(batchResults.education_modifications)) {
    for (const eduMod of batchResults.education_modifications) {
      // Ignorer les formations conservées sans modification
      if (eduMod.action === 'kept') continue;

      const eduIndex = eduMod.education_index;
      const sourceEdu = sourceCv.education?.[eduIndex];
      const itemName = sourceEdu?.institution || `Formation ${eduIndex + 1}`;

      // Vérifier si degree a changé
      if (eduMod.degree_before !== eduMod.degree_after) {
        changes.push({
          id: generateChangeId(),
          section: 'education',
          field: 'degree',
          path: `education[${eduIndex}].degree`,
          changeType: 'modified',
          itemName,
          beforeValue: eduMod.degree_before,
          afterValue: eduMod.degree_after,
          beforeDisplay: eduMod.degree_before,
          afterDisplay: eduMod.degree_after,
          change: `Diplôme traduit: "${eduMod.degree_before}" → "${eduMod.degree_after}"`,
          reason: eduMod.reason || 'Traduction vers la langue cible',
          status: 'pending',
        });
      }

      // Vérifier si field_of_study a changé
      if (eduMod.field_before !== eduMod.field_after) {
        changes.push({
          id: generateChangeId(),
          section: 'education',
          field: 'field_of_study',
          path: `education[${eduIndex}].field_of_study`,
          changeType: 'modified',
          itemName,
          beforeValue: eduMod.field_before,
          afterValue: eduMod.field_after,
          beforeDisplay: eduMod.field_before,
          afterDisplay: eduMod.field_after,
          change: `Domaine traduit: "${eduMod.field_before}" → "${eduMod.field_after}"`,
          reason: eduMod.reason || 'Traduction vers la langue cible',
          status: 'pending',
        });
      }
    }
  }

  // Extraire les modifications des langues (language_modifications)
  if (batchResults.language_modifications && Array.isArray(batchResults.language_modifications)) {
    for (const langMod of batchResults.language_modifications) {
      // Ignorer les langues conservées sans modification
      if (langMod.action === 'kept') continue;

      const hasNameChange = langMod.name_before !== langMod.name_after;
      const hasLevelChange = langMod.level_before !== langMod.level_after;

      // Ne créer un changement que s'il y a vraiment eu une modification
      if (!hasNameChange && !hasLevelChange) continue;

      changes.push({
        id: generateChangeId(),
        section: 'languages',
        field: 'languages',
        changeType: 'modified',
        itemName: langMod.name_after || langMod.name_before,
        beforeValue: { name: langMod.name_before, level: langMod.level_before },
        afterValue: { name: langMod.name_after, level: langMod.level_after },
        beforeDisplay: `${langMod.name_before}: ${langMod.level_before}`,
        afterDisplay: `${langMod.name_after}: ${langMod.level_after}`,
        change: hasNameChange && hasLevelChange
          ? `"${langMod.name_before}" (${langMod.level_before}) → "${langMod.name_after}" (${langMod.level_after})`
          : hasNameChange
            ? `"${langMod.name_before}" → "${langMod.name_after}"`
            : `Niveau: "${langMod.level_before}" → "${langMod.level_after}"`,
        reason: langMod.reason || 'Traduction/alignement vers la langue cible',
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
    // 1. Assembler le CV final (languages et education viennent des batchResults)
    const jobTitle = jobOfferContent?.title || '';

    // Extraire les skills sans les données de review (_raw)
    const cleanSkills = batchResults.skills ? {
      hard_skills: batchResults.skills.hard_skills,
      soft_skills: batchResults.skills.soft_skills,
      tools: batchResults.skills.tools,
      methodologies: batchResults.skills.methodologies,
    } : sourceCv.skills;

    // Collecter les raisons des skills "kept" pour affichage informatif (bouton "i")
    // Ces skills ne sont pas dans pendingChanges car ils n'ont pas besoin de review
    const keptSkillReasons = {};
    const skillsRawForKept = batchResults.skills?._raw || batchResults.skills?.modifications;

    if (skillsRawForKept) {
      const categories = ['hard_skills', 'soft_skills', 'tools', 'methodologies'];
      for (const category of categories) {
        const skillItems = skillsRawForKept[category];
        if (!Array.isArray(skillItems)) continue;

        keptSkillReasons[category] = [];

        for (const item of skillItems) {
          // Collecter uniquement les "kept" avec une raison et SANS review requis
          // (les "kept" avec review requis sont dans pendingChanges)
          if (item.action === 'kept' && item.reason && !item.review?.required) {
            keptSkillReasons[category].push({
              name: item.skill_final || item.original_value,
              reason: item.reason,
            });
          }
        }
      }
    }

    // Sanitize all adapted data for PostgreSQL (remove \u0000 characters)
    const adaptedCv = sanitizeForPostgres({
      generated_at: new Date().toISOString(),
      header: {
        ...sourceCv.header,
        current_title: jobTitle || sourceCv.header?.current_title,
      },
      summary: batchResults.summary || sourceCv.summary,
      skills: cleanSkills,
      experience: batchResults.experiences || sourceCv.experience || [],
      projects: batchResults.projects || sourceCv.projects || [],
      education: batchResults.education || sourceCv.education || [],
      languages: batchResults.languages || sourceCv.languages || [],
      extras: batchResults.extras || sourceCv.extras || [],
      section_order: sourceCv.section_order,
      // Raisons des skills "kept" pour le bouton info (i)
      _keptSkillReasons: keptSkillReasons,
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
        // Snapshot de l'offre pour autonomie si l'offre est supprimée
        jobOfferSnapshot: jobOfferContent ? {
          sourceType: jobOffer?.sourceType || 'url',
          sourceValue: jobOffer?.sourceValue || jobOffer?.url || offerId,
          extractedAt: jobOffer?.extractedAt ? new Date(jobOffer.extractedAt).toISOString() : new Date().toISOString(),
          content: jobOfferContent,
        } : null,
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
          education: batchResults.education,
          languages: batchResults.languages,
          education_modifications: batchResults.education_modifications,
          language_modifications: batchResults.language_modifications,
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
          educationModifications: batchResults.education_modifications?.length || 0,
          languageModifications: batchResults.language_modifications?.length || 0,
        },
        durationMs: duration,
        completedAt: new Date(),
      },
    });

    const educationModified = (batchResults.education_modifications || []).filter(m => m.action === 'modified').length;
    const languagesModified = (batchResults.language_modifications || []).filter(m => m.action === 'modified').length;
    console.log(`[recompose] Completed in ${duration}ms:`, {
      cvFileId: cvFile.id,
      filename: generatedFileName,
      educationModified,
      languagesModified,
    });

    return {
      success: true,
      cvFileId: cvFile.id,
      filename: generatedFileName,
      adaptedCv,
      educationModifications: batchResults.education_modifications || [],
      languageModifications: batchResults.language_modifications || [],
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

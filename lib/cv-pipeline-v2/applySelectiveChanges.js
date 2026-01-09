/**
 * Application Sélective des Changements - Pipeline CV v2
 *
 * Applique uniquement les modifications acceptées au CV final.
 * Pour les modifications rejetées, conserve les valeurs originales.
 */

/**
 * Parse une clé de décision pour extraire section, index et field
 * Format: "section:index:field"
 */
function parseDecisionKey(key) {
  const parts = key.split(':');
  if (parts.length < 3) return null;
  return {
    section: parts[0],
    index: parseInt(parts[1], 10),
    field: parts.slice(2).join(':'), // Le field peut contenir des ":"
  };
}

/**
 * Vérifie si une modification est acceptée
 */
function isModificationAccepted(decisions, section, index, field) {
  const key = `${section}:${index}:${field}`;
  return decisions[key] === 'accepted';
}

/**
 * Applique les modifications sélectives aux expériences
 */
function applyExperienceChanges(sourceExperiences, batchExperiences, decisions) {
  if (!batchExperiences || batchExperiences.length === 0) {
    return sourceExperiences || [];
  }

  return batchExperiences.map((adaptedExp, expIndex) => {
    const sourceExp = sourceExperiences?.[expIndex] || {};
    const modifications = adaptedExp.modifications || [];

    // Créer une copie de l'expérience adaptée
    const finalExp = { ...adaptedExp };
    delete finalExp.modifications; // Ne pas inclure les modifications dans le résultat

    // Pour chaque modification, vérifier si elle est acceptée ou rejetée
    modifications.forEach((mod, modIndex) => {
      // La clé combine le contexte de l'expérience avec le field
      const fieldWithContext = `${adaptedExp.title || adaptedExp.company || `Exp ${expIndex + 1}`} - ${mod.field}`;
      const isAccepted = isModificationAccepted(decisions, 'experiences', modIndex, fieldWithContext);

      if (!isAccepted) {
        // Restaurer la valeur originale
        const field = mod.field.toLowerCase();

        if (field === 'title' && sourceExp.title !== undefined) {
          finalExp.title = sourceExp.title;
        } else if (field === 'description' && sourceExp.description !== undefined) {
          finalExp.description = sourceExp.description;
        } else if (field === 'responsibilities' && sourceExp.responsibilities !== undefined) {
          finalExp.responsibilities = sourceExp.responsibilities;
        } else if (field === 'deliverables' && sourceExp.deliverables !== undefined) {
          finalExp.deliverables = sourceExp.deliverables;
        } else if (field === 'skills_used' && sourceExp.skills_used !== undefined) {
          finalExp.skills_used = sourceExp.skills_used;
        }
      }
    });

    return finalExp;
  });
}

/**
 * Applique les modifications sélectives aux projets
 */
function applyProjectChanges(sourceProjects, batchProjects, decisions) {
  if (!batchProjects || batchProjects.length === 0) {
    return sourceProjects || [];
  }

  return batchProjects.map((adaptedProj, projIndex) => {
    const sourceProj = sourceProjects?.[projIndex] || {};
    const modifications = adaptedProj.modifications || [];

    const finalProj = { ...adaptedProj };
    delete finalProj.modifications;

    modifications.forEach((mod, modIndex) => {
      const fieldWithContext = `${adaptedProj.name || `Projet ${projIndex + 1}`} - ${mod.field}`;
      const isAccepted = isModificationAccepted(decisions, 'projects', modIndex, fieldWithContext);

      if (!isAccepted) {
        const field = mod.field.toLowerCase();

        if (field === 'summary' && sourceProj.summary !== undefined) {
          finalProj.summary = sourceProj.summary;
        } else if (field === 'tech_stack' && sourceProj.tech_stack !== undefined) {
          finalProj.tech_stack = sourceProj.tech_stack;
        } else if (field === 'description' && sourceProj.description !== undefined) {
          finalProj.description = sourceProj.description;
        }
      }
    });

    return finalProj;
  });
}

/**
 * Applique les modifications sélectives aux skills
 * Gère les actions: added, removed, adjusted
 */
function applySkillsChanges(sourceSkills, batchSkills, decisions) {
  if (!batchSkills) {
    return sourceSkills || {};
  }

  const modifications = batchSkills.modifications || [];
  const finalSkills = {
    hard_skills: [...(batchSkills.hard_skills || [])],
    soft_skills: [...(batchSkills.soft_skills || [])],
    tools: [...(batchSkills.tools || [])],
    methodologies: [...(batchSkills.methodologies || [])],
  };

  // Traiter chaque modification
  modifications.forEach((mod, modIndex) => {
    const isAccepted = isModificationAccepted(decisions, 'skills', modIndex, mod.field);

    if (!isAccepted) {
      // Parser le field pour extraire la catégorie et le nom
      // Format: "hard_skills.JavaScript" ou "soft_skills.Leadership"
      const [category, ...nameParts] = mod.field.split('.');
      const skillName = nameParts.join('.');

      switch (mod.action) {
        case 'added':
          // Skill ajouté mais rejeté → le retirer du résultat
          if (category === 'hard_skills') {
            finalSkills.hard_skills = finalSkills.hard_skills.filter(
              (s) => s.name !== skillName
            );
          } else if (category === 'soft_skills') {
            finalSkills.soft_skills = finalSkills.soft_skills.filter(
              (s) => s !== skillName
            );
          } else if (category === 'tools') {
            finalSkills.tools = finalSkills.tools.filter(
              (s) => s.name !== skillName
            );
          } else if (category === 'methodologies') {
            finalSkills.methodologies = finalSkills.methodologies.filter(
              (s) => s !== skillName
            );
          }
          break;

        case 'removed':
          // Skill supprimé mais rejet de la suppression → le restaurer
          if (category === 'hard_skills') {
            const originalSkill = sourceSkills?.hard_skills?.find(
              (s) => s.name === skillName
            );
            if (originalSkill) {
              finalSkills.hard_skills.push(originalSkill);
            }
          } else if (category === 'soft_skills') {
            if (sourceSkills?.soft_skills?.includes(skillName)) {
              finalSkills.soft_skills.push(skillName);
            }
          } else if (category === 'tools') {
            const originalTool = sourceSkills?.tools?.find(
              (s) => s.name === skillName
            );
            if (originalTool) {
              finalSkills.tools.push(originalTool);
            }
          } else if (category === 'methodologies') {
            if (sourceSkills?.methodologies?.includes(skillName)) {
              finalSkills.methodologies.push(skillName);
            }
          }
          break;

        case 'adjusted':
          // Niveau ajusté mais rejeté → restaurer le niveau original
          if (category === 'hard_skills') {
            const idx = finalSkills.hard_skills.findIndex(
              (s) => s.name === skillName
            );
            const originalSkill = sourceSkills?.hard_skills?.find(
              (s) => s.name === skillName
            );
            if (idx !== -1 && originalSkill) {
              finalSkills.hard_skills[idx] = originalSkill;
            }
          } else if (category === 'tools') {
            const idx = finalSkills.tools.findIndex(
              (s) => s.name === skillName
            );
            const originalTool = sourceSkills?.tools?.find(
              (s) => s.name === skillName
            );
            if (idx !== -1 && originalTool) {
              finalSkills.tools[idx] = originalTool;
            }
          }
          break;
      }
    }
  });

  return finalSkills;
}

/**
 * Applique les modifications sélectives au summary
 */
function applySummaryChanges(sourceSummary, batchSummary, decisions) {
  if (!batchSummary) {
    return sourceSummary || {};
  }

  const modifications = batchSummary.modifications || [];
  const finalSummary = { ...batchSummary };
  delete finalSummary.modifications;

  modifications.forEach((mod, modIndex) => {
    const isAccepted = isModificationAccepted(decisions, 'summary', modIndex, mod.field);

    if (!isAccepted) {
      const field = mod.field.toLowerCase();

      if (field === 'description' && sourceSummary?.description !== undefined) {
        finalSummary.description = sourceSummary.description;
      } else if (field === 'domains' && sourceSummary?.domains !== undefined) {
        finalSummary.domains = sourceSummary.domains;
      } else if (field === 'key_strengths' && sourceSummary?.key_strengths !== undefined) {
        finalSummary.key_strengths = sourceSummary.key_strengths;
      }
    }
  });

  return finalSummary;
}

/**
 * Applique les modifications sélectives aux extras
 */
function applyExtrasChanges(sourceExtras, batchExtras, decisions) {
  if (!batchExtras) {
    return sourceExtras || [];
  }

  // Si batchExtras est un tableau d'extras avec modifications
  if (Array.isArray(batchExtras)) {
    return batchExtras.map((adaptedExtra, extraIndex) => {
      const sourceExtra = sourceExtras?.[extraIndex] || {};
      const modifications = adaptedExtra.modifications || [];

      const finalExtra = { ...adaptedExtra };
      delete finalExtra.modifications;

      modifications.forEach((mod, modIndex) => {
        const fieldWithContext = `${adaptedExtra.name || `Extra ${extraIndex + 1}`} - ${mod.field}`;
        const isAccepted = isModificationAccepted(decisions, 'extras', modIndex, fieldWithContext);

        if (!isAccepted && sourceExtra[mod.field] !== undefined) {
          finalExtra[mod.field] = sourceExtra[mod.field];
        }
      });

      return finalExtra;
    });
  }

  // Si batchExtras est un objet avec modifications
  if (batchExtras.modifications) {
    const finalExtras = { ...batchExtras };
    delete finalExtras.modifications;

    batchExtras.modifications.forEach((mod, modIndex) => {
      const isAccepted = isModificationAccepted(decisions, 'extras', modIndex, mod.field);

      if (!isAccepted && sourceExtras?.[mod.field] !== undefined) {
        finalExtras[mod.field] = sourceExtras[mod.field];
      }
    });

    return finalExtras;
  }

  return batchExtras;
}

/**
 * Applique les modifications sélectives aux langues
 */
function applyLanguagesChanges(sourceLanguages, batchLanguages, decisions) {
  if (!batchLanguages?.modifications?.adapted?.length) {
    return sourceLanguages || [];
  }

  const adaptedLanguages = batchLanguages.languages || sourceLanguages || [];
  const adaptedNames = batchLanguages.modifications.adapted || [];

  // Vérifier chaque langue adaptée
  return adaptedLanguages.map((lang, index) => {
    const langName = lang.name || lang;
    const wasAdapted = adaptedNames.some(
      (name) => name.toLowerCase() === langName.toLowerCase()
    );

    if (wasAdapted) {
      // Trouver la modification correspondante
      const modIndex = adaptedNames.findIndex(
        (name) => name.toLowerCase() === langName.toLowerCase()
      );
      const isAccepted = isModificationAccepted(decisions, 'languages', modIndex, langName);

      if (!isAccepted) {
        // Restaurer la langue originale
        const sourceLang = sourceLanguages?.find(
          (sl) => (sl.name || sl).toLowerCase() === langName.toLowerCase()
        );
        if (sourceLang) {
          return sourceLang;
        }
      }
    }

    return lang;
  });
}

/**
 * Calcule les statistiques de décisions pour la télémétrie
 */
function calculateDecisionStats(decisions) {
  const accepted = Object.values(decisions).filter((d) => d === 'accepted').length;
  const rejected = Object.values(decisions).filter((d) => d === 'rejected').length;
  const total = accepted + rejected;

  // Statistiques par section
  const bySection = {};
  Object.entries(decisions).forEach(([key, value]) => {
    const parsed = parseDecisionKey(key);
    if (parsed) {
      if (!bySection[parsed.section]) {
        bySection[parsed.section] = { accepted: 0, rejected: 0 };
      }
      if (value === 'accepted') {
        bySection[parsed.section].accepted++;
      } else if (value === 'rejected') {
        bySection[parsed.section].rejected++;
      }
    }
  });

  return {
    total,
    accepted,
    rejected,
    acceptRatio: total > 0 ? Math.round((accepted / total) * 100) : 0,
    bySection,
  };
}

/**
 * Applique les changements sélectifs au CV
 *
 * @param {Object} params
 * @param {Object} params.sourceCv - CV source original
 * @param {Object} params.batchResults - Résultats des batches avec modifications
 * @param {Object} params.decisions - Map des décisions { "section:index:field": "accepted"|"rejected" }
 * @param {Object} params.jobOffer - Offre d'emploi (pour le titre)
 * @returns {Object} - CV final avec modifications appliquées et stats
 */
export function applySelectiveChanges({ sourceCv, batchResults, decisions, jobOffer }) {
  // Appliquer les changements section par section
  const finalCv = {
    generated_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
    header: {
      ...sourceCv.header,
      // Le current_title est toujours mis à jour avec le titre de l'offre
      current_title: jobOffer?.title || sourceCv.header?.current_title,
    },
    summary: applySummaryChanges(
      sourceCv.summary,
      batchResults.summary,
      decisions
    ),
    skills: applySkillsChanges(
      sourceCv.skills,
      batchResults.skills,
      decisions
    ),
    experience: applyExperienceChanges(
      sourceCv.experience,
      batchResults.experiences,
      decisions
    ),
    projects: applyProjectChanges(
      sourceCv.projects,
      batchResults.projects,
      decisions
    ),
    education: sourceCv.education || [],
    languages: applyLanguagesChanges(
      sourceCv.languages,
      batchResults.languages,
      decisions
    ),
    extras: applyExtrasChanges(
      sourceCv.extras,
      batchResults.extras,
      decisions
    ),
    section_order: sourceCv.section_order,
  };

  // Calculer les statistiques
  const stats = calculateDecisionStats(decisions);

  return {
    cv: finalCv,
    stats,
    reviewDecisions: decisions,
  };
}

export default applySelectiveChanges;

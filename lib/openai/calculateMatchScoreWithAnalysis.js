import { getOpenAIClient, checkOpenAICredits, addTemperatureIfSupported } from './client.js';
import { loadPromptWithVars } from './promptLoader.js';
import { detectCvLanguage, detectJobOfferLanguage, getLanguageName } from '@/lib/cv/detectLanguage.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Formate le contenu structuré d'une offre d'emploi pour l'analyse
 * @param {Object} jobOffer - Contenu JSON structuré de l'offre
 * @returns {string} - Texte formaté pour l'analyse
 */
function formatJobOfferForAnalysis(jobOffer) {
  const sections = [];

  if (jobOffer.title) {
    sections.push(`📋 TITRE DU POSTE: ${jobOffer.title}`);
  }

  if (jobOffer.company) {
    sections.push(`🏢 ENTREPRISE: ${jobOffer.company}`);
  }

  if (jobOffer.contract) {
    sections.push(`📄 TYPE DE CONTRAT: ${jobOffer.contract}`);
  }

  if (jobOffer.experience) {
    const exp = jobOffer.experience;
    let expText = '';
    if (exp.min_years !== null || exp.max_years !== null) {
      if (exp.min_years !== null && exp.max_years !== null) {
        expText = `${exp.min_years}-${exp.max_years} ans`;
      } else if (exp.min_years !== null) {
        expText = `${exp.min_years}+ ans`;
      } else if (exp.max_years !== null) {
        expText = `jusqu'à ${exp.max_years} ans`;
      }
    }
    if (exp.level) {
      expText += expText ? ` (${exp.level})` : exp.level;
    }
    if (expText) {
      sections.push(`💼 EXPÉRIENCE: ${expText}`);
    }
  }

  if (jobOffer.location) {
    const loc = jobOffer.location;
    const locParts = [];
    if (loc.city) locParts.push(loc.city);
    if (loc.country) locParts.push(loc.country);
    if (loc.remote) locParts.push(`(${loc.remote})`);
    if (locParts.length > 0) {
      sections.push(`📍 LOCALISATION: ${locParts.join(', ')}`);
    }
  }

  if (jobOffer.skills) {
    if (jobOffer.skills.required && jobOffer.skills.required.length > 0) {
      sections.push(`🎯 COMPÉTENCES REQUISES:\n${jobOffer.skills.required.map(s => `- ${s}`).join('\n')}`);
    }
    if (jobOffer.skills.nice_to_have && jobOffer.skills.nice_to_have.length > 0) {
      sections.push(`✨ COMPÉTENCES SOUHAITÉES:\n${jobOffer.skills.nice_to_have.map(s => `- ${s}`).join('\n')}`);
    }
  }

  if (jobOffer.responsibilities && jobOffer.responsibilities.length > 0) {
    sections.push(`📝 RESPONSABILITÉS:\n${jobOffer.responsibilities.map(r => `- ${r}`).join('\n')}`);
  }

  if (jobOffer.education) {
    const edu = jobOffer.education;
    const eduParts = [];
    if (edu.level) eduParts.push(edu.level);
    if (edu.field) eduParts.push(edu.field);
    if (eduParts.length > 0) {
      sections.push(`🎓 FORMATION: ${eduParts.join(' - ')}`);
    }
  }

  if (jobOffer.languages && jobOffer.languages.length > 0) {
    const langList = jobOffer.languages.map(l => {
      if (l.level) return `${l.language} (${l.level})`;
      return l.language;
    }).join(', ');
    sections.push(`🗣️ LANGUES: ${langList}`);
  }

  if (jobOffer.benefits && jobOffer.benefits.length > 0) {
    sections.push(`🎁 AVANTAGES:\n${jobOffer.benefits.map(b => `- ${b}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

export async function calculateMatchScoreWithAnalysis({
  cvContent,
  jobOfferUrl,
  cvFile = null, // Optionnel: objet CvFile depuis la DB avec la relation jobOffer
  signal,
  userId = null
}) {
  try {
    // Vérifier les crédits OpenAI avant les opérations longues
    console.log('[calculateMatchScoreWithAnalysis] Vérification des crédits OpenAI...');
    try {
      await checkOpenAICredits();
      console.log('[calculateMatchScoreWithAnalysis] ✅ Crédits OpenAI disponibles');
    } catch (error) {
      console.error('[calculateMatchScoreWithAnalysis] ❌ Erreur crédits OpenAI:', error.message);
      throw error;
    }

    // Parser le CV
    let cvData;
    try {
      cvData = JSON.parse(cvContent);
    } catch (e) {
      console.error('[calculateMatchScoreWithAnalysis] Erreur parsing CV:', e);
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.invalidCvFormat' }));
    }

    // Récupérer le contenu de l'offre depuis la relation JobOffer (OBLIGATOIRE)
    if (!cvFile?.jobOffer?.content) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.jobOfferMissing' }));
    }

    console.log('[calculateMatchScoreWithAnalysis] ✅ Utilisation de l\'extraction structurée depuis JobOffer');
    // Convertir le JSON structuré en texte pour l'analyse
    const jobOfferData = cvFile.jobOffer.content;
    const jobOfferContent = formatJobOfferForAnalysis(jobOfferData);

    // Utiliser la langue stockée dans le CV, sinon détecter par mots-clés
    const cvLanguageCode = cvData.language || detectCvLanguage(cvData);
    const cvLanguage = getLanguageName(cvLanguageCode);
    console.log('[calculateMatchScoreWithAnalysis] Langue du CV:', cvLanguage, '(source:', cvData.language ? 'stored' : 'detected', ')');

    // Détecter la langue de l'offre d'emploi
    const jobOfferLanguageCode = detectJobOfferLanguage(jobOfferContent);
    const jobOfferLanguage = getLanguageName(jobOfferLanguageCode);
    console.log('[calculateMatchScoreWithAnalysis] Langue de l\'offre détectée:', jobOfferLanguage);

    // Créer l'instruction de traduction si les langues diffèrent
    let translationInstruction = '';
    if (cvLanguageCode !== jobOfferLanguageCode) {
      translationInstruction = `**⚠️ ATTENTION TRADUCTION REQUISE** : L'offre d'emploi est en ${jobOfferLanguage} mais le CV est en ${cvLanguage}. Tu DOIS d'abord traduire mentalement l'offre en ${cvLanguage} avant de faire l'analyse et le calcul du score. Toutes tes suggestions et ton analyse doivent être en ${cvLanguage}.`;
      console.log('[calculateMatchScoreWithAnalysis] ⚠️ Traduction requise:', jobOfferLanguage, '→', cvLanguage);
    }

    // Charger les prompts depuis les fichiers .md
    const systemPrompt = await loadPromptWithVars('lib/openai/prompts/scoring/system.md', {
      cvLanguage: cvLanguage,
      translationInstruction: translationInstruction
    });
    const userPrompt = await loadPromptWithVars('lib/openai/prompts/scoring/user.md', {
      cvContent: JSON.stringify(cvData, null, 2),
      jobOfferContent: jobOfferContent,
      cvLanguage: cvLanguage
    });

    console.log('[calculateMatchScoreWithAnalysis] Appel OpenAI pour analyse complète...');

    const client = getOpenAIClient();
    const model = await getAiModelSetting('model_match_score');

    const startTime = Date.now();
    const response = await client.chat.completions.create(addTemperatureIfSupported({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_completion_tokens: 4000,
      response_format: { type: "json_object" }
    }, 0.1), { signal });
    const duration = Date.now() - startTime;

    // Track OpenAI usage
    if (userId && response.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'match_score',
        model,
        promptTokens: response.usage.prompt_tokens || 0,
        cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        duration,
      });
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.emptyOpenaiResponse' }));
    }

    // Parser la réponse JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error('[calculateMatchScoreWithAnalysis] Erreur parsing réponse:', content);
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.invalidJsonResponse' }));
    }

    // Valider et nettoyer le résultat
    const gptMatchScore = Math.min(100, Math.max(0, parseInt(result.match_score) || 0));

    const gptScoreBreakdown = {
      technical_skills: Math.min(100, Math.max(0, result.score_breakdown?.technical_skills || 0)),
      experience: Math.min(100, Math.max(0, result.score_breakdown?.experience || 0)),
      education: Math.min(100, Math.max(0, result.score_breakdown?.education || 0)),
      soft_skills_languages: Math.min(100, Math.max(0, result.score_breakdown?.soft_skills_languages || 0))
    };

    const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
    const missingSkills = Array.isArray(result.missing_skills) ? result.missing_skills : [];
    const matchingSkills = Array.isArray(result.matching_skills) ? result.matching_skills : [];

    // Recalculer le score final selon la formule de pondération
    const calculatedScore = Math.round(
      (gptScoreBreakdown.technical_skills * 0.35) +
      (gptScoreBreakdown.experience * 0.30) +
      (gptScoreBreakdown.education * 0.20) +
      (gptScoreBreakdown.soft_skills_languages * 0.15)
    );

    console.log(`[calculateMatchScoreWithAnalysis] Score GPT: ${gptMatchScore}, Score recalculé: ${calculatedScore}, Suggestions: ${suggestions.length}`);

    return {
      matchScore: calculatedScore,  // Utiliser le score recalculé
      scoreBreakdown: gptScoreBreakdown,
      suggestions,
      missingSkills,
      matchingSkills
    };

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[calculateMatchScoreWithAnalysis] Erreur:', error);
    throw error;
  }
}
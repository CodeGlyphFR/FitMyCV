import { getOpenAIClient, getModelForAnalysisLevel } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { detectCvLanguage, getLanguageName } from '@/lib/cv/detectLanguage.js';

/**
 * Améliore un CV existant en se basant sur les suggestions
 * @param {Object} params
 * @param {string} params.cvContent - Le CV actuel en JSON
 * @param {string} params.jobOfferUrl - L'URL de l'offre d'emploi
 * @param {number} params.currentScore - Le score actuel
 * @param {Array} params.suggestions - Les suggestions d'amélioration
 * @param {string} params.analysisLevel - Niveau d'analyse
 * @param {AbortSignal} params.signal - Signal pour annulation
 * @returns {Promise<Object>} - CV amélioré avec détails des changements
 */
export async function improveCv({
  cvContent,
  jobOfferUrl,
  currentScore,
  suggestions = [],
  analysisLevel = 'medium',
  signal = null
}) {
  console.log('[improveCv] Début amélioration - Score actuel:', currentScore);

  if (!cvContent || !jobOfferUrl) {
    throw new Error('CV content and job offer URL are required');
  }

  const client = getOpenAIClient();
  const model = getModelForAnalysisLevel(analysisLevel);

  // Détecter la langue du CV
  const cvLanguageCode = detectCvLanguage(cvContent);
  const cvLanguage = getLanguageName(cvLanguageCode);
  console.log('[improveCv] Langue détectée:', cvLanguage);

  // Formater les suggestions pour le prompt
  const suggestionsText = suggestions.map((s, i) =>
    `${i + 1}. [${s.priority}] ${s.suggestion} (Impact: ${s.impact})`
  ).join('\n');

  // Charger les prompts depuis les fichiers .md
  const systemPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv/system.md', {
    cvLanguage: cvLanguage
  });
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/improve-cv/user.md', {
    currentScore: currentScore.toString(),
    jobOfferUrl: jobOfferUrl,
    cvContent: cvContent,
    suggestionsText: suggestionsText
  });

  try {
    const requestOptions = {
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      response_format: { type: 'json_object' },
      // Note: temperature parameter removed as some models don't support custom values
    };

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Pas de réponse de l\'IA');
    }

    const result = JSON.parse(content);

    // Valider la structure
    if (!result.improved_cv) {
      throw new Error('Format de réponse invalide');
    }

    console.log('[improveCv] ✅ Amélioration terminée - Score estimé:', result.new_score_estimate);

    return {
      improvedCv: JSON.stringify(result.improved_cv, null, 2),
      changesMade: result.changes_made || [],
      newScoreEstimate: result.new_score_estimate || currentScore + 10,
      improvementDelta: result.improvement_delta || '+10',
      scoreBreakdown: result.score_breakdown || {},
      newSuggestions: result.suggestions || [],
      missingSkills: result.missing_skills || [],
      matchingSkills: result.matching_skills || []
    };

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[improveCv] Erreur:', error);
    throw error;
  }
}
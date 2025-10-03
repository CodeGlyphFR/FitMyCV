import { getOpenAIClient, getModelForAnalysisLevel } from './client.js';

const IMPROVE_SYSTEM_PROMPT = `ROLE:
Tu es un coach carrière expert en optimisation de CV pour maximiser les chances de succès.
Tu analyses les écarts entre un CV et une offre pour proposer des améliorations concrètes.

MISSION:
Identifier et corriger UNIQUEMENT les points faibles du CV par rapport à l'offre.`;

const IMPROVE_USER_PROMPT = `AMÉLIORATION CIBLÉE DU CV

📊 ANALYSE DE L'ÉCART:
Tu as reçu:
1. Un CV existant avec un score de {currentScore}/100
2. L'offre d'emploi cible: {jobOfferUrl}
3. Les suggestions d'amélioration identifiées

🎯 OBJECTIF:
Améliorer UNIQUEMENT les sections qui font perdre des points, sans toucher aux parties déjà optimales.

📝 RÈGLES D'AMÉLIORATION:
1. NE PAS modifier les sections qui correspondent déjà bien
2. NE JAMAIS inventer d'expériences ou compétences absentes
3. REFORMULER pour mettre en valeur ce qui existe déjà
4. AJOUTER uniquement des compétences justifiables par les expériences
5. OPTIMISER les mots-clés pour l'ATS
6. CLARIFIER les responsabilités et impacts

🔧 MODIFICATIONS AUTORISÉES:
- Summary: Reformuler pour mieux matcher le poste
- Skills: Réorganiser par priorité, ajouter si justifié
- Experience: Détailler les responsabilités pertinentes
- Current title: Adapter au poste visé (rester cohérent)

FORMAT DE RÉPONSE (JSON):
{
  "improved_cv": {
    // CV amélioré complet
  },
  "changes_made": [
    {
      "section": "summary",
      "change": "Ajouté mention de gestion d'équipe",
      "reason": "Requis dans l'offre et présent dans l'expérience"
    }
  ],
  "new_score_estimate": 85,
  "improvement_delta": "+10 points"
}`;

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

  // Formater les suggestions pour le prompt
  const suggestionsText = suggestions.map((s, i) =>
    `${i + 1}. [${s.priority}] ${s.suggestion} (Impact: ${s.impact})`
  ).join('\n');

  const userPrompt = IMPROVE_USER_PROMPT
    .replace('{currentScore}', currentScore)
    .replace('{jobOfferUrl}', jobOfferUrl) +
    '\n\n--- CV ACTUEL ---\n' +
    cvContent +
    '\n\n--- SUGGESTIONS D\'AMÉLIORATION ---\n' +
    suggestionsText;

  try {
    const requestOptions = {
      model,
      messages: [
        {
          role: 'system',
          content: IMPROVE_SYSTEM_PROMPT
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
      improvementDelta: result.improvement_delta || '+10'
    };

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[improveCv] Erreur:', error);
    throw error;
  }
}
import { getOpenAIClient } from './client.js';

const MATCH_SCORE_SYSTEM_PROMPT = `Tu es un expert en recrutement et en analyse de CV.
Tu dois analyser un CV et une offre d'emploi pour déterminer leur niveau de correspondance.`;

const MATCH_SCORE_USER_PROMPT = `Analyse le CV du candidat ci-dessous et l'offre d'emploi disponible au lien suivant pour déterminer un score de match sur 100.

Lien de l'offre d'emploi : {jobOfferUrl}

Critères d'évaluation :
- Compétences techniques requises vs compétences du candidat (40 points)
- Expérience professionnelle pertinente (30 points)
- Formation et niveau d'études (15 points)
- Compétences comportementales (soft skills) (15 points)

CV du candidat :
{cvContent}

Instructions :
1. Va chercher le contenu de l'offre d'emploi au lien ci-dessus
2. Compare le CV avec l'offre d'emploi selon les critères ci-dessus
3. Réponds UNIQUEMENT avec un nombre entre 0 et 100 représentant le score de match
4. Ne fournis AUCUNE explication, UNIQUEMENT le nombre`;

/**
 * Calcule le score de match entre un CV et une offre d'emploi
 * @param {Object} params
 * @param {string} params.cvContent - Le contenu du CV au format JSON stringifié
 * @param {string} params.jobOfferUrl - L'URL de l'offre d'emploi
 * @param {AbortSignal} params.signal - Signal pour annuler la requête
 * @returns {Promise<number>} - Le score de match (0-100)
 */
export async function calculateMatchScore({
  cvContent,
  jobOfferUrl,
  signal = null
}) {
  console.log('[calculateMatchScore] Démarrage du calcul de score de match');

  if (!cvContent || !jobOfferUrl) {
    throw new Error('CV content and job offer URL are required');
  }

  const client = getOpenAIClient();
  // Utiliser un modèle léger et rapide pour cette tâche
  const model = 'gpt-5-mini-2025-08-07';

  console.log(`[calculateMatchScore] Modèle GPT utilisé : ${model}`);
  console.log(`[calculateMatchScore] URL de l'offre : ${jobOfferUrl}`);

  // Préparer le contenu du CV (limiter pour éviter les prompts trop longs)
  let cvSummary = cvContent;
  if (cvSummary.length > 4000) {
    cvSummary = cvSummary.substring(0, 4000) + '...';
  }

  const systemPrompt = process.env.GPT_MATCH_SCORE_SYSTEM_PROMPT?.trim() || MATCH_SCORE_SYSTEM_PROMPT;
  const userPrompt = (process.env.GPT_MATCH_SCORE_USER_PROMPT?.trim() || MATCH_SCORE_USER_PROMPT)
    .replace(/\{jobOfferUrl\}/g, jobOfferUrl)
    .replace(/\{cvContent\}/g, cvSummary);

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
      max_completion_tokens: 50, // Augmenté pour permettre une réponse plus longue
    };

    console.log('[calculateMatchScore] Envoi de la requête à GPT...');

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    console.log('[calculateMatchScore] Réponse reçue de GPT');

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const content = response.choices?.[0]?.message?.content;
    console.log('[calculateMatchScore] Contenu de la réponse GPT:', content);

    if (!content) {
      throw new Error('No response from GPT');
    }

    // Extraire le nombre de la réponse
    const scoreMatch = content.trim().match(/\d+/);
    if (!scoreMatch) {
      console.error('[calculateMatchScore] Format de score invalide. Réponse complète:', content);
      throw new Error(`Invalid score format from GPT. Response: ${content.substring(0, 100)}`);
    }

    const score = parseInt(scoreMatch[0], 10);
    if (isNaN(score) || score < 0 || score > 100) {
      console.error('[calculateMatchScore] Score hors limites:', score);
      throw new Error(`Score out of range (0-100): ${score}`);
    }

    console.log(`[calculateMatchScore] Score calculé : ${score}/100`);
    return score;
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[calculateMatchScore] Erreur lors de l\'appel GPT:', error);
    console.error('[calculateMatchScore] Message d\'erreur:', error.message);
    if (error.response) {
      console.error('[calculateMatchScore] Réponse d\'erreur:', JSON.stringify(error.response));
    }
    throw error;
  }
}

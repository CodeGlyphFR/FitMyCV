import { getOpenAIClient } from './client.js';

const MATCH_SCORE_SYSTEM_PROMPT = `Tu es un expert en recrutement et en analyse de CV.
Tu dois analyser un CV et une offre d'emploi pour déterminer leur niveau de correspondance.`;

const MATCH_SCORE_USER_PROMPT = `Analyse le CV et l'offre d'emploi ci-dessous et détermine un score de match sur 100.

Critères d'évaluation :
- Compétences techniques requises vs compétences du candidat (40 points)
- Expérience professionnelle pertinente (30 points)
- Formation et niveau d'études (15 points)
- Compétences comportementales (soft skills) (15 points)

Offre d'emploi :
{jobOffer}

CV du candidat :
{cvContent}

Réponds UNIQUEMENT avec un nombre entre 0 et 100 représentant le score de match.
Ne fournis AUCUNE explication, UNIQUEMENT le nombre.`;

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

  // Récupérer le contenu de l'offre d'emploi
  let jobOfferContent = '';
  try {
    console.log(`[calculateMatchScore] Récupération de l'offre depuis : ${jobOfferUrl}`);

    // Utiliser un User-Agent pour éviter le blocage
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    };

    const fetchOptions = {
      headers,
      ...(signal ? { signal } : {}),
    };

    const response = await fetch(jobOfferUrl, fetchOptions);

    if (!response.ok) {
      console.error(`[calculateMatchScore] HTTP ${response.status} pour ${jobOfferUrl}`);
      throw new Error(`Failed to fetch job offer: ${response.status}`);
    }

    // Extraire le texte brut de la page
    const html = await response.text();

    if (!html || html.length < 100) {
      console.error('[calculateMatchScore] Contenu de l\'offre trop court ou vide');
      throw new Error('Job offer content is empty or too short');
    }

    // Nettoyer le HTML basiquement (enlever les balises)
    jobOfferContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ') // Enlever les scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ') // Enlever les styles
      .replace(/<[^>]*>/g, ' ') // Enlever toutes les balises HTML
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .trim();

    console.log(`[calculateMatchScore] Contenu extrait: ${jobOfferContent.length} caractères`);

    if (jobOfferContent.length < 100) {
      console.error('[calculateMatchScore] Contenu nettoyé trop court');
      throw new Error('Job offer content is too short after cleaning');
    }

    // Limiter à 3000 caractères pour éviter les prompts trop longs
    if (jobOfferContent.length > 3000) {
      jobOfferContent = jobOfferContent.substring(0, 3000) + '...';
    }
  } catch (error) {
    console.error('[calculateMatchScore] Erreur lors de la récupération de l\'offre:', error);
    throw new Error(`Failed to fetch job offer content: ${error.message}`);
  }

  // Préparer le contenu du CV (limiter aussi pour éviter les prompts trop longs)
  let cvSummary = cvContent;
  if (cvSummary.length > 3000) {
    cvSummary = cvSummary.substring(0, 3000) + '...';
  }

  const systemPrompt = process.env.GPT_MATCH_SCORE_SYSTEM_PROMPT?.trim() || MATCH_SCORE_SYSTEM_PROMPT;
  const userPrompt = (process.env.GPT_MATCH_SCORE_USER_PROMPT?.trim() || MATCH_SCORE_USER_PROMPT)
    .replace(/\{jobOffer\}/g, jobOfferContent)
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
      max_completion_tokens: 10, // Juste besoin d'un nombre
    };

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT');
    }

    // Extraire le nombre de la réponse
    const scoreMatch = content.trim().match(/\d+/);
    if (!scoreMatch) {
      throw new Error('Invalid score format from GPT');
    }

    const score = parseInt(scoreMatch[0], 10);
    if (isNaN(score) || score < 0 || score > 100) {
      throw new Error('Score out of range (0-100)');
    }

    console.log(`[calculateMatchScore] Score calculé : ${score}/100`);
    return score;
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[calculateMatchScore] Erreur lors de l\'appel GPT:', error);
    throw error;
  }
}

import { getOpenAIClient } from './client.js';

const MATCH_SCORE_SYSTEM_PROMPT = `Tu es un expert senior en recrutement avec 15 ans d'expérience dans l'analyse de CV et le matching candidat/poste.
Tu connais parfaitement les systèmes ATS (Applicant Tracking Systems) et tu sais comment ils parsent et scorent les CV.
Tu dois effectuer une analyse approfondie et rigoureuse comme le ferait un recruteur professionnel combiné à un système ATS.`;

const MATCH_SCORE_USER_PROMPT = `MISSION : Analyse le CV du candidat et l'offre d'emploi disponible au lien suivant pour déterminer un score de match précis sur 100.

URL DE L'OFFRE D'EMPLOI : {jobOfferUrl}

MÉTHODOLOGIE D'ANALYSE (comme un recruteur + ATS) :

1. COMPÉTENCES TECHNIQUES (40 points) :
   - Compare CHAQUE compétence technique requise dans l'offre avec le CV
   - Vérifie les technologies, langages, frameworks, outils mentionnés
   - Évalue le niveau de maîtrise indiqué (débutant/intermédiaire/expert)
   - Pénalise si des compétences critiques manquent
   - Bonus si le candidat a des compétences supplémentaires pertinentes
   - Vérifie la présence de certifications pertinentes

2. EXPÉRIENCE PROFESSIONNELLE (30 points) :
   - Analyse le nombre d'années d'expérience requis vs réel
   - Vérifie la pertinence des postes précédents avec le poste visé
   - Évalue la progression de carrière (junior → senior)
   - Compare les responsabilités passées avec celles attendues
   - Vérifie les secteurs d'activité (pertinence sectorielle)
   - Analyse les projets et réalisations concrètes
   - Pénalise les trous importants dans le parcours

3. FORMATION ET QUALIFICATIONS (15 points) :
   - Compare le niveau d'études requis (Bac+3, Bac+5, etc.)
   - Vérifie la pertinence du domaine d'études
   - Évalue la réputation des établissements si mentionné
   - Vérifie les formations continues et certifications
   - Bonus pour formations spécialisées pertinentes

4. SOFT SKILLS ET CULTURE FIT (15 points) :
   - Analyse les compétences comportementales requises
   - Vérifie les soft skills mentionnées dans le CV
   - Évalue l'adéquation culturelle (méthodologies : Agile, etc.)
   - Analyse les expériences de travail en équipe
   - Vérifie les compétences linguistiques si requises
   - Évalue la capacité de communication (présentation du CV)

PARSING ATS - CRITÈRES ADDITIONNELS :
- Présence des mots-clés exacts de l'offre dans le CV
- Densité de mots-clés pertinents
- Format et structure du CV (lisibilité ATS)
- Cohérence des dates et informations
- Présence de verbes d'action et de résultats quantifiables

INSTRUCTIONS DE SCORING :
- 90-100 : Match quasi-parfait, candidat idéal
- 75-89 : Très bon match, candidat hautement qualifié
- 60-74 : Bon match, candidat qualifié avec quelques gaps mineurs
- 45-59 : Match moyen, candidat acceptable mais avec des lacunes
- 30-44 : Match faible, candidat sous-qualifié
- 0-29 : Pas de match, candidat inadapté au poste

ANALYSE RIGOUREUSE REQUISE :
- Sois objectif et précis
- Ne surestime pas le match par optimisme
- Pénalise réellement les compétences manquantes critiques
- Valorise l'expérience concrète sur le même type de poste
- Compare chaque point de l'offre avec le CV

CV DU CANDIDAT (format JSON) :
{cvContent}

RÉPONSE ATTENDUE :
Réponds UNIQUEMENT avec un nombre entier entre 0 et 100 représentant le score de match.
Ne fournis AUCUNE explication, AUCUN texte, UNIQUEMENT le nombre.`;

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
  // Utiliser GPT-4o-mini qui supporte les recherches web
  const model = 'gpt-4o-mini';

  console.log(`[calculateMatchScore] Modèle GPT utilisé : ${model}`);
  console.log(`[calculateMatchScore] URL de l'offre : ${jobOfferUrl}`);

  // Parser et formater le CV JSON de manière lisible
  let cvData;
  try {
    cvData = JSON.parse(cvContent);
  } catch (error) {
    console.error('[calculateMatchScore] Erreur lors du parsing du CV JSON:', error);
    throw new Error('Invalid CV JSON format');
  }

  // Créer une représentation textuelle structurée du CV
  const cvSummary = JSON.stringify(cvData, null, 2);

  // Limiter la taille si nécessaire
  let finalCvContent = cvSummary;
  if (finalCvContent.length > 4000) {
    finalCvContent = finalCvContent.substring(0, 4000) + '\n... (contenu tronqué)';
  }

  console.log(`[calculateMatchScore] Taille du CV formaté: ${finalCvContent.length} caractères`);

  const systemPrompt = process.env.GPT_MATCH_SCORE_SYSTEM_PROMPT?.trim() || MATCH_SCORE_SYSTEM_PROMPT;
  const userPrompt = (process.env.GPT_MATCH_SCORE_USER_PROMPT?.trim() || MATCH_SCORE_USER_PROMPT)
    .replace(/\{jobOfferUrl\}/g, jobOfferUrl)
    .replace(/\{cvContent\}/g, finalCvContent);

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

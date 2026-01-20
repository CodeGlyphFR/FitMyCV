import { getOpenAIClient, addTemperatureIfSupported } from '@/lib/openai-core/client.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

/**
 * Classify skills into CV categories using OpenAI API
 * Uses gpt-4o-mini for fast, cheap classification
 *
 * @param {Object} params - Classification parameters
 * @param {Array} params.skills - Array of skills to classify [{skill: "React", level: "advanced"}, ...]
 * @param {AbortSignal} [params.signal] - Optional abort signal for cancellation
 * @param {string} [params.userId] - Optional user ID for telemetry tracking
 * @returns {Promise<Object>} - Classified skills by category
 */
export async function classifySkills({
  skills,
  signal = null,
  userId = null
}) {
  const startTime = Date.now();

  if (!skills || skills.length === 0) {
    console.log('[classifySkills] No skills to classify');
    return {
      hard_skills: [],
      soft_skills: [],
      tools: [],
      methodologies: []
    };
  }

  const skillNames = skills.map(s => s.skill);
  const model = 'gpt-4o-mini';

  try {
    const client = getOpenAIClient();

    const systemPrompt = `Tu es un assistant de classification de compétences pour CV.
Classe chaque compétence dans UNE SEULE catégorie parmi:
- hard_skills: Compétences techniques métier (langages, frameworks, domaines d'expertise comme React, Machine Learning, Data Analysis)
- soft_skills: Compétences comportementales (Leadership, Communication, Travail en équipe, Gestion du temps)
- tools: Logiciels et plateformes spécifiques (Docker, AWS, Jira, Figma, Excel)
- methodologies: Méthodes et frameworks de travail (Agile, Scrum, DevOps, TDD, CI/CD)

RÈGLES:
- Une compétence apparaît dans UNE SEULE catégorie
- Préfère hard_skills pour les technologies/langages
- Préfère tools pour les outils/plateformes spécifiques
- Retourne UNIQUEMENT un JSON valide sans markdown ni explication`;

    const userPrompt = `Classe ces compétences:
${skillNames.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Retourne un JSON:
{
  "hard_skills": ["skill1", "skill2"],
  "soft_skills": ["skill3"],
  "tools": ["skill4"],
  "methodologies": ["skill5"]
}`;

    const requestOptions = addTemperatureIfSupported({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 500,
    }, 0.1);

    const response = await client.chat.completions.create(
      requestOptions,
      signal ? { signal } : {}
    );

    const content = response.choices?.[0]?.message?.content?.trim();
    let classification;

    try {
      classification = JSON.parse(content);
    } catch (parseError) {
      console.error('[classifySkills] Failed to parse response:', content);
      // Fallback: mettre tout dans hard_skills
      classification = {
        hard_skills: skillNames,
        soft_skills: [],
        tools: [],
        methodologies: []
      };
    }

    // Normaliser la structure
    const result = {
      hard_skills: classification.hard_skills || [],
      soft_skills: classification.soft_skills || [],
      tools: classification.tools || [],
      methodologies: classification.methodologies || []
    };

    console.log(`[classifySkills] Classified ${skills.length} skills:`, result);

    // Track usage for telemetry
    if (userId && response.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'classify_skills',
        model,
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        cachedTokens: response.usage.prompt_tokens_details?.cached_tokens || 0,
        duration: Date.now() - startTime,
      });
    }

    return result;
  } catch (error) {
    console.error('[classifySkills] Error classifying skills:', error);
    // Fallback: mettre tout dans hard_skills
    return {
      hard_skills: skillNames,
      soft_skills: [],
      tools: [],
      methodologies: []
    };
  }
}

import { getOpenAIClient, checkOpenAICredits, addTemperatureIfSupported } from '@/lib/openai-core/client';
import { loadPrompt, loadPromptWithVars } from '@/lib/openai-core/promptLoader';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

export async function translateCv({
  cvContent,
  targetLanguage,
  signal,
  userId = null
}) {
  console.log(`[translateCv] Démarrage de la traduction vers ${targetLanguage}`);

  // Vérifier les crédits OpenAI avant l'appel
  console.log('[translateCv] Vérification des crédits OpenAI...');
  try {
    await checkOpenAICredits();
    console.log('[translateCv] ✅ Crédits OpenAI disponibles');
  } catch (error) {
    console.error('[translateCv] ❌ Erreur crédits OpenAI:', error.message);
    throw error;
  }

  const client = getOpenAIClient();
  const model = await getAiModelSetting('model_translate_cv');

  // Mapper le code langue vers le nom complet
  const languageNames = {
    fr: 'français',
    en: 'anglais',
    es: 'español',
    de: 'deutsch'
  };
  const targetLangName = languageNames[targetLanguage] || targetLanguage;

  // Charger les prompts depuis les fichiers .md
  const systemPrompt = await loadPrompt('lib/translation/prompts/system.md');
  const userPrompt = await loadPromptWithVars('lib/translation/prompts/user.md', {
    targetLanguage: targetLangName,
    cvContent: cvContent
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  try {
    const startTime = Date.now();
    const completion = await client.chat.completions.create(
      addTemperatureIfSupported({
        model,
        messages,
        response_format: { type: 'json_object' }
      }, 0.3), // Basse température pour plus de cohérence
      { signal }
    );
    const duration = Date.now() - startTime;

    // Track OpenAI usage
    if (userId && completion.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'translate_cv',
        model,
        promptTokens: completion.usage.prompt_tokens || 0,
        cachedTokens: completion.usage.prompt_tokens_details?.cached_tokens || 0,
        completionTokens: completion.usage.completion_tokens || 0,
        duration,
      });
    }

    const translated = completion.choices[0]?.message?.content;
    if (!translated) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.noTranslationResponse' }));
    }

    // Valider que c'est du JSON valide
    JSON.parse(translated);

    console.log('[translateCv] Traduction terminée avec succès');
    return translated;
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      console.log('[translateCv] Traduction annulée par l\'utilisateur');
      throw new Error('Task cancelled');
    }

    console.error('[translateCv] Erreur lors de la traduction:', error);
    throw error;
  }
}

import { getOpenAIClient, checkOpenAICredits } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';

export async function translateCv({
  cvContent,
  targetLanguage,
  signal
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
    en: 'anglais'
  };
  const targetLangName = languageNames[targetLanguage] || targetLanguage;

  // Charger les prompts depuis les fichiers .md
  const systemPrompt = await loadPrompt('lib/openai/prompts/translate-cv/system.md');
  const userPrompt = await loadPromptWithVars('lib/openai/prompts/translate-cv/user.md', {
    targetLanguage: targetLangName,
    cvContent: cvContent
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];

  try {
    const completion = await client.chat.completions.create(
      {
        model,
        messages,
        temperature: 0.3, // Basse température pour plus de cohérence
        response_format: { type: 'json_object' }
      },
      { signal }
    );

    const translated = completion.choices[0]?.message?.content;
    if (!translated) {
      throw new Error('Aucune réponse de traduction reçue');
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

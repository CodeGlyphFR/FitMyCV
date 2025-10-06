import { getOpenAIClient } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';

export async function translateCv({
  cvContent,
  targetLanguage,
  signal
}) {
  console.log(`[translateCv] Démarrage de la traduction vers ${targetLanguage}`);

  const client = getOpenAIClient();
  const model = 'gpt-4o-mini'; // Modèle adapté pour la traduction

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

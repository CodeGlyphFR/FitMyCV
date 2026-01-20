import { executeOpenAIService } from '@/lib/openai-core/serviceHelpers';
import { loadPrompt, loadPromptWithVars } from '@/lib/openai-core/promptLoader';

const languageNames = {
  fr: 'français',
  en: 'anglais',
  es: 'español',
  de: 'deutsch'
};

export async function translateCv({
  cvContent,
  targetLanguage,
  signal,
  userId = null
}) {
  console.log(`[translateCv] Démarrage de la traduction vers ${targetLanguage}`);

  const targetLangName = languageNames[targetLanguage] || targetLanguage;

  // Charger les prompts depuis les fichiers .md
  const systemPrompt = await loadPrompt('lib/translation/prompts/system.md');
  const userPrompt = await loadPromptWithVars('lib/translation/prompts/user.md', {
    targetLanguage: targetLangName,
    cvContent,
  });

  const { content } = await executeOpenAIService({
    serviceName: 'translateCv',
    modelSetting: 'model_translate_cv',
    featureName: 'translate_cv',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    signal,
    userId,
  });

  // Valider que c'est du JSON valide
  JSON.parse(content);

  console.log('[translateCv] Traduction terminée avec succès');
  return content;
}

import { getOpenAIClient } from './client.js';

const TRANSLATION_SYSTEM_PROMPT = `ROLE:
Tu es un assistant spécialisé dans la traduction de CV.
Tu dois traduire le contenu du CV JSON fourni dans la langue cible tout en préservant EXACTEMENT la structure JSON.

RÈGLES IMPORTANTES:
1. Ne modifie JAMAIS les noms des champs JSON
2. Traduis UNIQUEMENT les valeurs textuelles
3. Ne traduis PAS les URLs, emails, numéros de téléphone, codes pays, dates
4. Préserve le formatage et la structure exacte du JSON
5. Assure-toi que le JSON final soit valide et bien formaté
6. Traduis de manière professionnelle et naturelle
`;

function buildTranslationPrompt(cvContent, targetLanguage) {
  const languageNames = {
    fr: 'français',
    en: 'anglais'
  };

  const targetLangName = languageNames[targetLanguage] || targetLanguage;

  return `TÂCHE:
Traduis le CV JSON suivant en ${targetLangName}.

Instructions détaillées:

1. TRADUIRE:
   - Tous les textes descriptifs (descriptions, responsabilités, résumés, etc.)
   - Les titres de poste, noms d'entreprises (sauf noms propres)
   - Les noms de compétences techniques si applicable
   - Les labels et descriptions de projets
   - Les titres de formation et domaines d'études

2. NE PAS TRADUIRE:
   - Les noms de personnes
   - Les emails et numéros de téléphone
   - Les URLs et liens
   - Les codes pays (FR, US, etc.)
   - Les dates (garder le format YYYY-MM ou YYYY)
   - Les noms propres d'entreprises connues
   - Les noms de technologies et outils (JavaScript, Python, etc.)
   - Les métadonnées (generated_at, created_at, etc.)

3. STRUCTURE:
   - Préserve EXACTEMENT la structure JSON
   - Ne supprime et n'ajoute aucun champ
   - Garde les tableaux vides tels quels
   - Préserve les valeurs null

CV à traduire:
${cvContent}

Réponds UNIQUEMENT avec le JSON traduit complet, sans texte avant ou après.`;
}

export async function translateCv({
  cvContent,
  targetLanguage,
  signal
}) {
  console.log(`[translateCv] Démarrage de la traduction vers ${targetLanguage}`);

  const client = getOpenAIClient();
  const model = 'gpt-4o-mini'; // Modèle adapté pour la traduction

  const systemPrompt = TRANSLATION_SYSTEM_PROMPT;
  const userPrompt = buildTranslationPrompt(cvContent, targetLanguage);

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

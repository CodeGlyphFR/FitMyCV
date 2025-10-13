import { getOpenAIClient, checkOpenAICredits, addTemperatureIfSupported } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { detectCvLanguage, detectJobOfferLanguage, getLanguageName } from '@/lib/cv/detectLanguage.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Configurer Puppeteer avec stealth mode
puppeteer.use(StealthPlugin());


/**
 * Extrait le contenu d'une offre d'emploi avec GPT + Puppeteer
 * @param {string} url - URL de l'offre d'emploi
 * @returns {Promise<string>} - Contenu formaté de l'offre
 */
async function extractJobOfferWithGPT(url) {
  console.log(`[extractJobOfferWithGPT] Extraction de l'offre depuis: ${url}`);

  const client = getOpenAIClient();

  try {
    // Fetch le HTML avec Puppeteer + Stealth pour contourner Indeed
    console.log('[extractJobOfferWithGPT] Lancement de Puppeteer en mode stealth...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    let html;
    try {
      const page = await browser.newPage();

      // Configurer la page pour ressembler à un vrai navigateur
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      console.log(`[extractJobOfferWithGPT] Navigation vers ${url}...`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Attendre que le contenu se charge (Indeed charge le contenu dynamiquement)
      console.log('[extractJobOfferWithGPT] Attente du chargement du contenu...');
      try {
        await page.waitForSelector('body', { timeout: 5000 });
      } catch (e) {
        console.log('[extractJobOfferWithGPT] Timeout waitForSelector, on continue...');
      }
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Récupérer le HTML complet
      html = await page.content();
      console.log(`[extractJobOfferWithGPT] ✅ HTML récupéré avec Puppeteer (${html.length} caractères)`);

      await browser.close();
    } catch (error) {
      await browser.close().catch(() => {});
      throw error;
    }

    // Trouver le début du contenu de l'offre (chercher le titre avec H/F ou h/f)
    console.log(`[extractJobOfferWithGPT] Recherche du titre de l'offre dans le HTML...`);

    // Patterns pour détecter le titre de l'offre
    const titlePatterns = [
      /(<h1[^>]*>.*?(?:\(h\/f\)|h\/f).*?<\/h1>)/is,
      /(<h2[^>]*>.*?(?:\(h\/f\)|h\/f).*?<\/h2>)/is,
      /(h\/f|H\/F|\(h\/f\)|\(H\/F\))/i
    ];

    let startIndex = -1;
    let foundPattern = null;

    // Essayer chaque pattern
    for (const pattern of titlePatterns) {
      const match = html.match(pattern);
      if (match) {
        startIndex = match.index;
        foundPattern = pattern.toString();
        console.log(`[extractJobOfferWithGPT] ✅ Titre trouvé avec pattern ${foundPattern} à l'index ${startIndex}`);
        break;
      }
    }

    // Si on a trouvé le titre, ne garder que le HTML à partir de ce point
    let optimizedHtml = html;
    if (startIndex > 0 && startIndex < html.length - 1000) {
      // Reculer un peu pour capturer le contexte (500 caractères avant)
      const contextStart = Math.max(0, startIndex - 500);
      optimizedHtml = html.substring(contextStart);
      console.log(`[extractJobOfferWithGPT] HTML optimisé: ${html.length} → ${optimizedHtml.length} caractères (réduction de ${Math.round((1 - optimizedHtml.length / html.length) * 100)}%)`);
    } else {
      console.log(`[extractJobOfferWithGPT] ⚠️ Titre non trouvé, envoi du HTML complet`);
    }

    console.log(`[extractJobOfferWithGPT] HTML final à envoyer à GPT: ${optimizedHtml.length} caractères`);

    // Charger les prompts depuis les fichiers .md
    const systemPrompt = await loadPrompt('lib/openai/prompts/extract-job-offer/system.md');
    const userPrompt = await loadPromptWithVars('lib/openai/prompts/extract-job-offer/user.md', {
      sourceContent: optimizedHtml
    });

    const extractModel = await getAiModelSetting('model_extract_job_offer');

    const response = await client.chat.completions.create(addTemperatureIfSupported({
      model: extractModel,
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
      max_completion_tokens: 4000,
    }, 0.1));

    const text = response.choices?.[0]?.message?.content;

    if (!text || text.trim().length === 0) {
      throw new Error('GPT n\'a retourné aucun contenu');
    }

    console.log(`[extractJobOfferWithGPT] ✅ Contenu extrait par GPT (${text.length} caractères)`);
    console.log('[extractJobOfferWithGPT] === RÉPONSE GPT COMPLÈTE ===');
    console.log(text);
    console.log('[extractJobOfferWithGPT] === FIN RÉPONSE GPT ===');

    // Écrire la réponse dans un fichier pour debug
    try {
      const fs = require('fs');
      const debugFilePath = '/tmp/gpt-response-debug-analysis.txt';
      const debugContent = `=== DEBUG EXTRACTION GPT (calculateMatchScoreWithAnalysis) ===
Date: ${new Date().toISOString()}
URL: ${url}

=== HTML ENVOYÉ COMPLET (${optimizedHtml.length} caractères) ===
${optimizedHtml}

=== RÉPONSE GPT COMPLÈTE ===
${text}

=== FIN DEBUG ===
`;
      fs.writeFileSync(debugFilePath, debugContent, 'utf8');
      console.log(`[extractJobOfferWithGPT] ✅ Debug écrit dans ${debugFilePath} (${debugContent.length} caractères)`);
    } catch (e) {
      console.error('[extractJobOfferWithGPT] ❌ Erreur écriture debug:', e.message);
    }

    return text.trim();

  } catch (error) {
    console.error(`[extractJobOfferWithGPT] ❌ Erreur GPT:`, error.message);
    throw new Error(`Impossible d'extraire l'offre d'emploi depuis ${url}: ${error.message}`);
  }
}

export async function calculateMatchScoreWithAnalysis({
  cvContent,
  jobOfferUrl,
  cvFile = null, // Optionnel: objet CvFile depuis la DB pour récupérer extractedJobOffer
  signal
}) {
  try {
    // Vérifier les crédits OpenAI avant les opérations longues
    console.log('[calculateMatchScoreWithAnalysis] Vérification des crédits OpenAI...');
    try {
      await checkOpenAICredits();
      console.log('[calculateMatchScoreWithAnalysis] ✅ Crédits OpenAI disponibles');
    } catch (error) {
      console.error('[calculateMatchScoreWithAnalysis] ❌ Erreur crédits OpenAI:', error.message);
      throw error;
    }

    // Parser le CV
    let cvData;
    try {
      cvData = JSON.parse(cvContent);
    } catch (e) {
      console.error('[calculateMatchScoreWithAnalysis] Erreur parsing CV:', e);
      throw new Error('Invalid CV format');
    }

    // Récupérer le contenu de l'offre depuis le cache DB (OBLIGATOIRE)
    if (!cvFile?.extractedJobOffer) {
      throw new Error('extractedJobOffer manquant - le CV doit être généré avec une offre extraite');
    }

    console.log('[calculateMatchScoreWithAnalysis] ✅ Utilisation de l\'extraction en cache depuis la DB');
    const jobOfferContent = cvFile.extractedJobOffer;

    // Détecter la langue du CV
    const cvLanguageCode = detectCvLanguage(cvData);
    const cvLanguage = getLanguageName(cvLanguageCode);
    console.log('[calculateMatchScoreWithAnalysis] Langue du CV détectée:', cvLanguage);

    // Détecter la langue de l'offre d'emploi
    const jobOfferLanguageCode = detectJobOfferLanguage(jobOfferContent);
    const jobOfferLanguage = getLanguageName(jobOfferLanguageCode);
    console.log('[calculateMatchScoreWithAnalysis] Langue de l\'offre détectée:', jobOfferLanguage);

    // Créer l'instruction de traduction si les langues diffèrent
    let translationInstruction = '';
    if (cvLanguageCode !== jobOfferLanguageCode) {
      translationInstruction = `**⚠️ ATTENTION TRADUCTION REQUISE** : L'offre d'emploi est en ${jobOfferLanguage} mais le CV est en ${cvLanguage}. Tu DOIS d'abord traduire mentalement l'offre en ${cvLanguage} avant de faire l'analyse et le calcul du score. Toutes tes suggestions et ton analyse doivent être en ${cvLanguage}.`;
      console.log('[calculateMatchScoreWithAnalysis] ⚠️ Traduction requise:', jobOfferLanguage, '→', cvLanguage);
    }

    // Charger les prompts depuis les fichiers .md
    const systemPrompt = await loadPromptWithVars('lib/openai/prompts/scoring/system.md', {
      cvLanguage: cvLanguage,
      translationInstruction: translationInstruction
    });
    const userPrompt = await loadPromptWithVars('lib/openai/prompts/scoring/user.md', {
      cvContent: JSON.stringify(cvData, null, 2),
      jobOfferContent: jobOfferContent
    });

    console.log('[calculateMatchScoreWithAnalysis] Appel OpenAI pour analyse complète...');

    const client = getOpenAIClient();
    const model = await getAiModelSetting('model_match_score');

    const response = await client.chat.completions.create(addTemperatureIfSupported({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_completion_tokens: 4000,
      response_format: { type: "json_object" }
    }, 0.1), { signal });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Parser la réponse JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error('[calculateMatchScoreWithAnalysis] Erreur parsing réponse:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Valider et nettoyer le résultat
    const gptMatchScore = Math.min(100, Math.max(0, parseInt(result.match_score) || 0));

    const gptScoreBreakdown = {
      technical_skills: Math.min(100, Math.max(0, result.score_breakdown?.technical_skills || 0)),
      experience: Math.min(100, Math.max(0, result.score_breakdown?.experience || 0)),
      education: Math.min(100, Math.max(0, result.score_breakdown?.education || 0)),
      soft_skills_languages: Math.min(100, Math.max(0, result.score_breakdown?.soft_skills_languages || 0))
    };

    const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
    const missingSkills = Array.isArray(result.missing_skills) ? result.missing_skills : [];
    const matchingSkills = Array.isArray(result.matching_skills) ? result.matching_skills : [];

    // Recalculer le score final selon la formule de pondération
    const calculatedScore = Math.round(
      (gptScoreBreakdown.technical_skills * 0.35) +
      (gptScoreBreakdown.experience * 0.30) +
      (gptScoreBreakdown.education * 0.20) +
      (gptScoreBreakdown.soft_skills_languages * 0.15)
    );

    console.log(`[calculateMatchScoreWithAnalysis] Score GPT: ${gptMatchScore}, Score recalculé: ${calculatedScore}, Suggestions: ${suggestions.length}`);

    return {
      matchScore: calculatedScore,  // Utiliser le score recalculé
      scoreBreakdown: gptScoreBreakdown,
      suggestions,
      missingSkills,
      matchingSkills
    };

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[calculateMatchScoreWithAnalysis] Erreur:', error);
    throw error;
  }
}
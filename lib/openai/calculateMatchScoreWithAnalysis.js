import { getOpenAIClient } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { detectCvLanguage, detectJobOfferLanguage, getLanguageName } from '@/lib/cv/detectLanguage.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Configurer Puppeteer avec stealth mode
puppeteer.use(StealthPlugin());

/**
 * Ajuste le scoreBreakdown pour que la formule corresponde au score cible
 * @param {Object} breakdown - Breakdown original de GPT
 * @param {number} targetScore - Score cible à atteindre
 * @returns {Object} - Breakdown ajusté
 */
function adjustScoreBreakdown(breakdown, targetScore) {
  // Formule: score = (tech × 0.35) + (exp × 0.30) + (edu × 0.20) + (soft × 0.15)
  const weights = {
    technical_skills: 0.35,
    experience: 0.30,
    education: 0.20,
    soft_skills_languages: 0.15
  };

  // Calculer le score actuel du breakdown
  const currentScore =
    breakdown.technical_skills * weights.technical_skills +
    breakdown.experience * weights.experience +
    breakdown.education * weights.education +
    breakdown.soft_skills_languages * weights.soft_skills_languages;

  // Calculer l'écart
  const gap = targetScore - currentScore;

  // Si l'écart est très faible (< 1 point), retourner tel quel
  if (Math.abs(gap) < 1) {
    return breakdown;
  }

  // Ajuster principalement la catégorie technique (poids le plus important)
  const adjusted = {
    technical_skills: Math.min(100, Math.max(0, Math.round(breakdown.technical_skills + (gap / weights.technical_skills)))),
    experience: breakdown.experience,
    education: breakdown.education,
    soft_skills_languages: breakdown.soft_skills_languages
  };

  // Vérifier que le nouveau score correspond bien (tolérance ±2)
  const verifyScore = Math.round(
    adjusted.technical_skills * weights.technical_skills +
    adjusted.experience * weights.experience +
    adjusted.education * weights.education +
    adjusted.soft_skills_languages * weights.soft_skills_languages
  );

  console.log(`[adjustScoreBreakdown] Target: ${targetScore}, Current: ${Math.round(currentScore)}, Adjusted: ${verifyScore}`);

  return adjusted;
}

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

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
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
      temperature: 0.1,
      max_tokens: 4000,
    });

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
  previousScore = null, // Score précédent pour logique incrémentale (+0 à +3)
  previousScoreUpdatedAt = null, // Date du dernier calcul pour logique < 5 min
  signal
}) {
  try {
    // Parser le CV
    let cvData;
    try {
      cvData = JSON.parse(cvContent);
    } catch (e) {
      console.error('[calculateMatchScoreWithAnalysis] Erreur parsing CV:', e);
      throw new Error('Invalid CV format');
    }

    // Récupérer le contenu de l'offre (depuis cache DB si disponible, sinon extraction Claude)
    let jobOfferContent;

    if (cvFile?.extractedJobOffer && cvFile.sourceValue === jobOfferUrl) {
      console.log('[calculateMatchScoreWithAnalysis] ✅ Utilisation de l\'extraction en cache depuis la DB');
      jobOfferContent = cvFile.extractedJobOffer;
    } else {
      console.log('[calculateMatchScoreWithAnalysis] Extraction de l\'offre avec Claude (pas de cache disponible)...');
      jobOfferContent = await extractJobOfferWithGPT(jobOfferUrl);
    }

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

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 2000,
      response_format: { type: "json_object" }
    }, { signal });

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

    // Logique de calcul du score final
    let finalMatchScore;
    let finalScoreBreakdown;

    if (previousScore !== null && previousScore !== undefined) {
      // Un score existe déjà, vérifier si < 5 minutes
      if (previousScoreUpdatedAt) {
        const now = new Date();
        const lastUpdate = new Date(previousScoreUpdatedAt);
        const minutesSinceUpdate = (now - lastUpdate) / (1000 * 60);

        if (minutesSinceUpdate < 5) {
          // < 5 minutes → retourner le MÊME score (mais nouvelles suggestions)
          finalMatchScore = previousScore;
          finalScoreBreakdown = adjustScoreBreakdown(gptScoreBreakdown, finalMatchScore);

          const secondsSinceUpdate = Math.round(minutesSinceUpdate * 60);
          console.log(`[calculateMatchScoreWithAnalysis] Score identique (< 5 min): ${finalMatchScore}/100 (calculé il y a ${secondsSinceUpdate}s)`);
        } else {
          // > 5 minutes → score incrémental (+0 à +3)
          const randomBonus = Math.floor(Math.random() * 4); // 0, 1, 2 ou 3
          finalMatchScore = Math.min(100, previousScore + randomBonus);
          finalScoreBreakdown = adjustScoreBreakdown(gptScoreBreakdown, finalMatchScore);

          console.log(`[calculateMatchScoreWithAnalysis] Score incrémental (> 5 min): ${previousScore} → ${finalMatchScore} (+${randomBonus} pts)`);
        }
      } else {
        // Pas de date → score incrémental par défaut
        const randomBonus = Math.floor(Math.random() * 4);
        finalMatchScore = Math.min(100, previousScore + randomBonus);
        finalScoreBreakdown = adjustScoreBreakdown(gptScoreBreakdown, finalMatchScore);

        console.log(`[calculateMatchScoreWithAnalysis] Score incrémental (pas de date): ${previousScore} → ${finalMatchScore} (+${randomBonus} pts)`);
      }
    } else {
      // Premier calcul → utiliser le score GPT tel quel
      finalMatchScore = gptMatchScore;
      finalScoreBreakdown = gptScoreBreakdown;
      console.log(`[calculateMatchScoreWithAnalysis] Premier calcul: ${finalMatchScore}/100`);
    }

    console.log(`[calculateMatchScoreWithAnalysis] Score final: ${finalMatchScore}, Suggestions: ${suggestions.length}`);

    return {
      matchScore: finalMatchScore,
      scoreBreakdown: finalScoreBreakdown,
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
import { promises as fs } from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getOpenAIClient, getModelForAnalysisLevel, checkOpenAICredits, addTemperatureIfSupported } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

// Configurer Puppeteer avec stealth mode
puppeteer.use(StealthPlugin());

async function extractTextFromPdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData) => {
      reject(new Error(errData.parserError));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        let text = '';
        if (pdfData.Pages) {
          pdfData.Pages.forEach(page => {
            if (page.Texts) {
              page.Texts.forEach(textItem => {
                if (textItem.R) {
                  textItem.R.forEach(r => {
                    if (r.T) {
                      text += decodeURIComponent(r.T) + ' ';
                    }
                  });
                }
              });
              text += '\n';
            }
          });
        }

        const numPages = pdfData.Pages ? pdfData.Pages.length : 0;

        resolve({
          name: path.basename(filePath),
          text: text.trim(),
          source_path: filePath
        });
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.loadPDF(filePath);
  });
}

/**
 * Extrait et analyse le contenu d'un PDF d'offre d'emploi avec GPT
 * @param {string} pdfPath - Chemin vers le PDF
 * @param {string} [userId] - User ID for telemetry tracking (optional)
 * @returns {Promise<Object>} - { name, text, source }
 */
async function extractJobOfferFromPdf(pdfPath, userId = null) {

  const client = getOpenAIClient();

  try {
    // 1. Extraire le texte brut du PDF
    const pdfData = await extractTextFromPdf(pdfPath);

    // 2. Analyser avec GPT pour structurer l'information
    // Charger les prompts depuis les fichiers .md
    const systemPrompt = await loadPrompt('lib/openai/prompts/extract-job-offer/system.md');
    const userPrompt = await loadPromptWithVars('lib/openai/prompts/extract-job-offer/user.md', {
      sourceContent: pdfData.text
    });

    const extractModel = await getAiModelSetting('model_extract_job_offer');

    const extractRequestOptions = addTemperatureIfSupported({
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
    }, 0.1);

    const startTime = Date.now();
    const response = await client.chat.completions.create(extractRequestOptions);
    const duration = Date.now() - startTime;

    // Track OpenAI usage
    if (userId && response.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'extract_job_offer_pdf',
        model: extractModel,
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        duration,
      });
    }

    const text = response.choices?.[0]?.message?.content;

    if (!text || text.trim().length === 0) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptNoContent' }));
    }


    return {
      name: pdfData.name,
      text: text.trim(),
      source: pdfPath
    };

  } catch (error) {
    // If already a translation key, propagate
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.translationKey) throw error;
    } catch (parseError) {}
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.pdfAnalysisFailed' }));
  }
}

/**
 * Nettoie le HTML en supprimant tous les éléments inutiles pour l'extraction
 * @param {string} html - HTML brut
 * @returns {string} - HTML nettoyé
 */
function cleanHtmlForExtraction(html) {
  if (!html) return '';

  let cleaned = html;

  // 1. Supprimer les scripts
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Supprimer les styles
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // 3. Supprimer les commentaires HTML
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // 4. Supprimer les SVG
  cleaned = cleaned.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

  // 5. Supprimer les iframes
  cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // 6. Supprimer les images inline (data:image)
  cleaned = cleaned.replace(/data:image\/[^;]+;base64,[^"')]+/gi, '');

  // 7. Supprimer les balises de navigation
  cleaned = cleaned.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
  cleaned = cleaned.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');
  cleaned = cleaned.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
  cleaned = cleaned.replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');

  // 8. Nettoyer les attributs HTML (garder seulement href)
  cleaned = cleaned.replace(/<(\w+)([^>]*?)>/g, (match, tag, attrs) => {
    // Extraire href si présent
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/);
    const href = hrefMatch ? ` href="${hrefMatch[1]}"` : '';
    return `<${tag}${href}>`;
  });

  // 9. Normaliser les espaces multiples
  cleaned = cleaned.replace(/\s+/g, ' ');

  // 10. Normaliser les lignes vides
  cleaned = cleaned.replace(/\n\s*\n/g, '\n');

  return cleaned.trim();
}

/**
 * Trouve le contenu principal de l'offre d'emploi avec plusieurs stratégies de fallback
 * @param {string} cleanedHtml - HTML déjà nettoyé
 * @returns {string} - HTML optimisé contenant le contenu principal
 */
function findMainContent(cleanedHtml) {
  if (!cleanedHtml) return '';

  // Stratégie 1 : Chercher les balises sémantiques HTML5
  const semanticPatterns = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /role=["']main["'][^>]*>([\s\S]*?)</i,
  ];

  for (const pattern of semanticPatterns) {
    const match = cleanedHtml.match(pattern);
    if (match && match[1] && match[1].length > 500) {
      return match[1];
    }
  }

  // Stratégie 2 : Chercher les classes/IDs spécifiques aux offres d'emploi
  const jobPatterns = [
    /class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i,
    /class=["'][^"']*jobsearch[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i,
    /class=["'][^"']*offer-detail[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i,
    /class=["'][^"']*job-content[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i,
    /id=["'][^"']*job[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i,
  ];

  for (const pattern of jobPatterns) {
    const match = cleanedHtml.match(pattern);
    if (match && match[1] && match[1].length > 500) {
      return match[1];
    }
  }

  // Stratégie 3 : Chercher le pattern H/F (existant)
  const hfPatterns = [
    /(<h1[^>]*>.*?(?:\(h\/f\)|h\/f).*?<\/h1>)/is,
    /(<h2[^>]*>.*?(?:\(h\/f\)|h\/f).*?<\/h2>)/is,
    /(h\/f|H\/F|\(h\/f\)|\(H\/F\))/i
  ];

  for (const pattern of hfPatterns) {
    const match = cleanedHtml.match(pattern);
    if (match && match.index !== undefined) {
      const startIndex = match.index;
      if (startIndex > 0 && startIndex < cleanedHtml.length - 1000) {
        // Reculer un peu pour capturer le contexte (500 caractères avant)
        const contextStart = Math.max(0, startIndex - 500);
        return cleanedHtml.substring(contextStart);
      }
    }
  }

  // Stratégie 4 : Chercher le premier H1 avec contexte significatif
  const h1Match = cleanedHtml.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1Match && h1Match.index !== undefined) {
    const startIndex = h1Match.index;
    const contextStart = Math.max(0, startIndex - 300);
    const extracted = cleanedHtml.substring(contextStart);

    // Vérifier qu'il y a au moins 500 caractères de contenu
    if (extracted.length > 500) {
      return extracted;
    }
  }

  // Stratégie 5 : Fallback - retourner tout le HTML nettoyé
  return cleanedHtml;
}

/**
 * Tente un fetch HTTP simple pour détecter les protections antibot
 * @param {string} url - URL à tester
 * @returns {Promise<string|null>} - HTML si succès, null si antibot détecté
 */
async function trySimpleFetch(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    // Vérifier le code de statut
    if (response.status === 403 || response.status === 401 || response.status === 503) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const html = await response.text();

    // Détecter les signes de protection antibot dans le HTML
    const antibotPatterns = [
      /cloudflare/i,
      /please complete the security check/i,
      /enable javascript and cookies to continue/i,
      /checking your browser/i,
      /just a moment/i,
      /ddos-guard/i,
      /captcha/i,
      /recaptcha/i,
      /bot protection/i,
      /access denied/i,
    ];

    const hasAntibot = antibotPatterns.some(pattern => pattern.test(html));

    if (hasAntibot) {
      return null;
    }

    return html;

  } catch (error) {
    return null;
  }
}

/**
 * Vérifie si l'extraction d'une offre d'emploi est vide (tous les champs "Non spécifié")
 * @param {string} text - Le texte extrait par GPT
 * @returns {boolean} - true si l'extraction est vide/invalide
 */
function isJobOfferEmpty(text) {
  if (!text) return true;

  const extractField = (emoji, name) => {
    const regex = new RegExp(`${emoji}\\s*${name}:\\s*(.+?)(?=\\n[📋📝🎯💼🎓🏢📍💰]|$)`, 'is');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const title = extractField('📋', 'TITRE DU POSTE');
  const description = extractField('📝', 'DESCRIPTION ET MISSIONS');
  const techSkills = extractField('🎯', 'COMPÉTENCES TECHNIQUES REQUISES');

  const isFieldEmpty = (value) =>
    !value || value.toLowerCase() === 'non spécifié' || value.toLowerCase() === 'not specified';

  // Échec si titre vide ET (description vide OU compétences vides)
  return isFieldEmpty(title) && (isFieldEmpty(description) || isFieldEmpty(techSkills));
}

/**
 * Extrait le contenu d'une offre d'emploi avec GPT
 * Tente d'abord un fetch simple, puis Puppeteer si antibot détecté
 * @param {string} url - URL de l'offre d'emploi
 * @param {string} [userId] - User ID for telemetry tracking (optional)
 * @returns {Promise<Object>} - { url, title, text }
 */
export async function extractJobOfferWithGPT(url, userId = null) {
  const client = getOpenAIClient();

  try {
    let html;
    let usedPuppeteer = false;

    // 1. Tenter d'abord un fetch simple
    html = await trySimpleFetch(url);

    // 2. Si antibot détecté, utiliser Puppeteer
    if (!html) {
      usedPuppeteer = true;
      console.log(`[extractJobOfferWithGPT] 🔒 Protection antibot détectée sur ${url}, utilisation de Puppeteer...`);

      // Fetch le HTML avec Puppeteer + Stealth pour contourner Indeed
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
        ],
        // Timeout global pour éviter les blocages
        timeout: 60000, // 60 secondes max pour le lancement
      });

      try {
        const page = await browser.newPage();

        // Timeout global pour la page (60 secondes max)
        page.setDefaultTimeout(60000);
        page.setDefaultNavigationTimeout(60000);

        // Configurer la page pour ressembler à un vrai navigateur
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        // Attendre que le contenu se charge (Indeed charge le contenu dynamiquement)
        try {
          await page.waitForSelector('body', { timeout: 5000 });
        } catch (e) {
          // Ignorer l'erreur si le body n'apparaît pas rapidement
        }
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Récupérer le HTML complet
        html = await page.content();

        await browser.close();
      } catch (error) {
        // Toujours fermer le navigateur, même en cas d'erreur
        try {
          await browser.close();
        } catch (closeError) {
          console.error('[extractJobOfferWithGPT] Erreur lors de la fermeture du navigateur:', closeError);
        }
        throw error;
      }
    } else {
      console.log(`[extractJobOfferWithGPT] ✅ Pas d'antibot détecté sur ${url}, utilisation du fetch HTTP simple`);
    }

    // Nettoyer et optimiser le HTML (suppression scripts, styles, navigation, etc.)
    const cleanedHtml = cleanHtmlForExtraction(html);
    // Trouver le contenu principal avec fallbacks (sémantique, classes job, H/F, H1, etc.)
    const optimizedHtml = findMainContent(cleanedHtml);

    // Charger les prompts depuis les fichiers .md
    const systemPrompt = await loadPrompt('lib/openai/prompts/extract-job-offer/system.md');
    const userPrompt = await loadPromptWithVars('lib/openai/prompts/extract-job-offer/user.md', {
      sourceContent: optimizedHtml
    });

    const extractModel = await getAiModelSetting('model_extract_job_offer');

    const extractRequestOptions = addTemperatureIfSupported({
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
    }, 0.1);

    const startTime = Date.now();
    const response = await client.chat.completions.create(extractRequestOptions);
    const duration = Date.now() - startTime;

    // Track OpenAI usage
    if (userId && response.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'extract_job_offer_url',
        model: extractModel,
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
        duration,
      });
    }

    const text = response.choices?.[0]?.message?.content;

    if (!text || text.trim().length === 0) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptNoContent' }));
    }

    // Extraire le titre si présent dans le texte
    const jobTitleMatch = text.match(/📋 TITRE DU POSTE:\s*(.+)/i);
    const jobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'Offre d\'emploi';

    // Vérifier si l'extraction a échoué (aucune offre d'emploi détectée)
    if (isJobOfferEmpty(text)) {
      throw new Error(JSON.stringify({
        translationKey: 'taskQueue.errors.noJobOfferDetected',
        source: url
      }));
    }

    return {
      url,
      title: jobTitle,
      text: text.trim()
    };

  } catch (error) {
    // Si c'est une erreur JSON avec translationKey, la propager directement
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.translationKey) throw error;
    } catch (parseError) {
      // Pas du JSON valide, continuer
    }
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.extractJobOfferFailed' }));
  }
}

function buildJobOfferContent(links, extractedFiles, scrapedUrls) {
  const sections = [];

  // Ajouter les URLs scrapées avec GPT
  if (scrapedUrls?.length > 0) {
    scrapedUrls.forEach(({ url, title, text }) => {
      sections.push(`\n📄 ${title}`);
      sections.push(`🔗 ${url}`);
      sections.push(text);
      sections.push('');
    });
  }

  // Ajouter les liens non scrapés (si applicable)
  if (links?.length > 0) {
    links.forEach(link => sections.push(`- ${link}`));
    sections.push('');
  }

  // Ajouter les PDFs extraits
  if (extractedFiles?.length > 0) {
    extractedFiles.forEach(({ extracted }) => {
      sections.push(`\nContenu de ${extracted.name}:`);
      sections.push(extracted.text);
      sections.push('');
    });
  }

  return sections.join('\n');
}

/**
 * Génération d'un CV adapté à une offre d'emploi
 * @param {Object} params
 * @param {string} params.mainCvContent - Contenu JSON du CV de référence
 * @param {string} params.referenceFile - Nom du fichier de référence
 * @param {Array<string>} params.links - Liens vers les offres d'emploi
 * @param {Array<Object>} params.files - Fichiers joints (PDF d'offres)
 * @param {string} params.analysisLevel - Niveau d'analyse
 * @param {string} params.requestedModel - Modèle OpenAI à utiliser (optionnel)
 * @param {AbortSignal} params.signal - Signal pour annulation
 * @param {string} [params.userId] - User ID for telemetry tracking (optional)
 * @returns {Promise<Object>} - CV adapté
 */
export async function generateCv({
  mainCvContent,
  referenceFile = 'main.json',
  links = [],
  files = [],
  analysisLevel = 'medium',
  requestedModel = null,
  signal = null,
  userId = null
}) {
  if (!mainCvContent) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.cvContentMissing' }));
  }

  // Vérifier les crédits OpenAI avant les opérations longues
  try {
    await checkOpenAICredits();
  } catch (error) {
    throw error;
  }

  const client = getOpenAIClient();
  const model = await getModelForAnalysisLevel(analysisLevel, requestedModel);

  // Extraire le contenu des URLs avec Claude (outil web fetch)
  const scrapedUrls = [];
  for (const link of links || []) {
    // Pas de try/catch : si Claude échoue, on laisse l'erreur remonter pour mettre le job en échec
    const extracted = await extractJobOfferWithGPT(link, userId);
    scrapedUrls.push(extracted);
  }

  // Extraire et analyser le contenu des PDFs d'offres avec GPT
  const extractedFiles = [];
  for (const entry of files || []) {
    if (!entry.path) continue;

    try {
      await fs.access(entry.path);
      const extracted = await extractJobOfferFromPdf(entry.path, userId); // Analyse GPT du PDF
      extractedFiles.push({ extracted });
    } catch (error) {
      // Ignorer les erreurs de lecture de fichier
    }
  }

  // Créer les runs (un par source)
  const runs = [];

  // Un run par URL scrapée
  for (const scraped of scrapedUrls) {
    runs.push({
      links: [],
      extractedFiles: [],
      scrapedUrls: [scraped],
      label: scraped.url
    });
  }

  // Un run par PDF
  for (const extracted of extractedFiles) {
    runs.push({
      links: [],
      extractedFiles: [extracted],
      scrapedUrls: [],
      label: extracted.extracted.name
    });
  }

  // Si aucune source, génération basique
  if (runs.length === 0) {
    runs.push({
      links: [],
      extractedFiles: [],
      scrapedUrls: [],
      label: referenceFile
    });
  }

  const results = [];

  // Exécuter chaque run
  for (const run of runs) {
    const jobOfferContent = buildJobOfferContent(
      run.links,
      run.extractedFiles,
      run.scrapedUrls
    );

    try {
      // Charger les prompts depuis les fichiers .md
      const systemPrompt = await loadPrompt('lib/openai/prompts/generate-cv/system.md');
      const userPrompt = await loadPromptWithVars('lib/openai/prompts/generate-cv/user.md', {
        mainCvContent: mainCvContent,
        jobOfferContent: jobOfferContent
      });

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
        response_format: { type: 'json_object' },
        // Note: temperature parameter removed as some models don't support custom values
      };

      const fetchOptions = signal ? { signal } : {};
      const startTime = Date.now();
      const response = await client.chat.completions.create(requestOptions, fetchOptions);
      const duration = Date.now() - startTime;

      if (signal?.aborted) {
        throw new Error('Task cancelled');
      }

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.noAiResponse' }));
      }

      // Parser la réponse JSON
      const result = JSON.parse(content);

      // Valider la structure
      if (!result.adapted_cv) {
        throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.invalidResponseFormat' }));
      }

      // Formater le CV adapté
      const formattedCv = JSON.stringify(result.adapted_cv, null, 2);

      // Récupérer l'extraction de l'offre (URL ou PDF)
      const extractedOffer = run.scrapedUrls[0]?.text || run.extractedFiles[0]?.extracted.text || null;

      // Determine feature name based on source type for tracking later
      let featureName = 'generate_cv_url'; // Default to URL
      if (run.extractedFiles && run.extractedFiles.length > 0) {
        featureName = 'generate_cv_pdf';
      } else if (run.scrapedUrls && run.scrapedUrls.length > 0) {
        featureName = 'generate_cv_url';
      }

      results.push({
        cvContent: formattedCv,
        source: run.label,
        extractedJobOffer: extractedOffer, // Extraction GPT de l'offre (URL ou PDF)
        // Store tracking data for successful generation
        _trackingData: userId && response.usage ? {
          featureName,
          usage: response.usage,
          duration,
        } : null,
      });
    } catch (error) {
      if (error.name === 'AbortError' || signal?.aborted) {
        throw new Error('Task cancelled');
      }
      throw error;
    }
  }

  // Track OpenAI usage only for successful generations
  if (userId) {
    for (const result of results) {
      if (result._trackingData) {
        try {
          const usage = result._trackingData.usage;
          await trackOpenAIUsage({
            userId,
            featureName: result._trackingData.featureName,
            model,
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            cachedTokens: usage.prompt_tokens_details?.cached_tokens || 0,
            duration: result._trackingData.duration,
            analysisLevel,
          });
        } catch (trackError) {
          console.error('[generateCv] Failed to track OpenAI usage:', trackError);
        }
        // Clean up tracking data before returning
        delete result._trackingData;
      }
    }
  }

  return results;
}

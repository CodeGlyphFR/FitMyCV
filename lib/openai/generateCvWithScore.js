import { promises as fs } from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getOpenAIClient, getModelForAnalysisLevel } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';

// Configurer Puppeteer avec stealth mode
puppeteer.use(StealthPlugin());

async function extractTextFromPdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData) => {
      console.error(`[generateCvWithScore] Erreur parsing PDF ${path.basename(filePath)}:`, errData.parserError);
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
        console.log(`[generateCvWithScore] PDF extrait: ${path.basename(filePath)} - ${numPages} pages`);

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
 * @returns {Promise<Object>} - { name, text, source }
 */
async function extractJobOfferFromPdf(pdfPath) {
  console.log(`[extractJobOfferFromPdf] Extraction et analyse du PDF: ${pdfPath}`);

  const client = getOpenAIClient();

  try {
    // 1. Extraire le texte brut du PDF
    const pdfData = await extractTextFromPdf(pdfPath);
    console.log(`[extractJobOfferFromPdf] PDF extrait: ${pdfData.text.length} caractères`);

    // 2. Analyser avec GPT pour structurer l'information
    // Charger les prompts depuis les fichiers .md
    const systemPrompt = await loadPrompt('lib/openai/prompts/extract-job-offer/system.md');
    const userPrompt = await loadPromptWithVars('lib/openai/prompts/extract-job-offer/user.md', {
      sourceContent: pdfData.text
    });

    console.log('[extractJobOfferFromPdf] Envoi à GPT pour analyse...');

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

    console.log(`[extractJobOfferFromPdf] ✅ Analyse GPT terminée (${text.length} caractères)`);

    return {
      name: pdfData.name,
      text: text.trim(),
      source: pdfPath
    };

  } catch (error) {
    console.error(`[extractJobOfferFromPdf] ❌ Erreur:`, error.message);
    throw new Error(`Impossible d'analyser le PDF d'offre d'emploi ${path.basename(pdfPath)}: ${error.message}`);
  }
}

/**
 * Extrait le contenu d'une offre d'emploi avec GPT + Puppeteer
 * @param {string} url - URL de l'offre d'emploi
 * @returns {Promise<Object>} - { url, title, text }
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
      const debugFilePath = '/tmp/gpt-response-debug.txt';
      const debugContent = `=== DEBUG EXTRACTION GPT ===
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

    // Extraire le titre si présent dans le texte
    const jobTitleMatch = text.match(/📋 TITRE DU POSTE:\s*\n(.+)/i);
    const jobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'Offre d\'emploi';

    return {
      url,
      title: jobTitle,
      text: text.trim()
    };

  } catch (error) {
    console.error(`[extractJobOfferWithGPT] ❌ Erreur GPT:`, error.message);
    throw new Error(`Impossible d'extraire l'offre d'emploi depuis ${url}: ${error.message}`);
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
 * Génération d'un CV adapté avec score et suggestions en un seul appel
 * @param {Object} params
 * @param {string} params.mainCvContent - Contenu JSON du CV de référence
 * @param {string} params.referenceFile - Nom du fichier de référence
 * @param {Array<string>} params.links - Liens vers les offres d'emploi
 * @param {Array<Object>} params.files - Fichiers joints (PDF d'offres)
 * @param {string} params.analysisLevel - Niveau d'analyse
 * @param {string} params.requestedModel - Modèle OpenAI à utiliser (optionnel)
 * @param {AbortSignal} params.signal - Signal pour annulation
 * @returns {Promise<Object>} - CV adapté avec score et suggestions
 */
export async function generateCvWithScore({
  mainCvContent,
  referenceFile = 'main.json',
  links = [],
  files = [],
  analysisLevel = 'medium',
  requestedModel = null,
  signal = null
}) {
  console.log('[generateCvWithScore] Démarrage génération + scoring optimisé');

  if (!mainCvContent) {
    throw new Error('Contenu du CV de référence manquant');
  }

  const client = getOpenAIClient();
  const model = getModelForAnalysisLevel(analysisLevel, requestedModel);

  console.log(`[generateCvWithScore] Modèle: ${model}, Niveau: ${analysisLevel}`);

  // Extraire le contenu des URLs avec Claude (outil web fetch)
  const scrapedUrls = [];
  for (const link of links || []) {
    // Pas de try/catch : si Claude échoue, on laisse l'erreur remonter pour mettre le job en échec
    const extracted = await extractJobOfferWithGPT(link);
    scrapedUrls.push(extracted);
  }

  // Extraire et analyser le contenu des PDFs d'offres avec GPT
  const extractedFiles = [];
  for (const entry of files || []) {
    if (!entry.path) continue;

    try {
      await fs.access(entry.path);
      const extracted = await extractJobOfferFromPdf(entry.path); // Analyse GPT du PDF
      extractedFiles.push({ extracted });
    } catch (error) {
      console.warn(`[generateCvWithScore] Impossible de lire/analyser ${entry.path}:`, error);
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

    console.log(`[generateCvWithScore] Traitement: ${run.label}`);

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
      const response = await client.chat.completions.create(requestOptions, fetchOptions);

      if (signal?.aborted) {
        throw new Error('Task cancelled');
      }

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Pas de réponse de l\'IA');
      }

      // Parser la réponse JSON
      const result = JSON.parse(content);

      // Valider la structure
      if (!result.adapted_cv || typeof result.match_score !== 'number') {
        throw new Error('Format de réponse invalide');
      }

      // Formater le CV adapté
      const formattedCv = JSON.stringify(result.adapted_cv, null, 2);

      // Récupérer l'extraction de l'offre (URL ou PDF)
      const extractedOffer = run.scrapedUrls[0]?.text || run.extractedFiles[0]?.extracted.text || null;

      results.push({
        cvContent: formattedCv,
        matchScore: Math.min(100, Math.max(0, result.match_score)),
        scoreBreakdown: result.score_breakdown || {},
        suggestions: result.improvement_suggestions || [],
        missingSkills: result.missing_critical_skills || [],
        matchingSkills: result.matching_skills || [],
        source: run.label,
        extractedJobOffer: extractedOffer // Extraction GPT de l'offre (URL ou PDF)
      });

      console.log(`[generateCvWithScore] ✅ Généré avec score: ${result.match_score}/100`);

    } catch (error) {
      if (error.name === 'AbortError' || signal?.aborted) {
        throw new Error('Task cancelled');
      }
      console.error(`[generateCvWithScore] Erreur pour ${run.label}:`, error);
      throw error;
    }
  }

  return results;
}

/**
 * Version rétrocompatible pour l'ancienne API
 * Retourne uniquement les contenus de CV pour compatibilité
 */
export async function generateCvLegacy(params) {
  const results = await generateCvWithScore(params);
  return results.map(r => r.cvContent);
}
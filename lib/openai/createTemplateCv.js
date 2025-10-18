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

async function getCvSchema() {
  const projectRoot = process.cwd();
  const templatePath = path.join(projectRoot, 'data', 'template.json');

  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    console.log(`[createTemplateCv] Utilisation du template : ${templatePath}`);
    return content;
  } catch (error) {
    console.warn(`[createTemplateCv] Impossible de lire template.json: ${error.message}`);
  }

  // Fallback: schéma par défaut
  console.log('[createTemplateCv] Utilisation du schéma par défaut');
  const defaultSchema = {
    generated_at: "",
    header: {
      full_name: "",
      current_title: "",
      contact: {
        email: "",
        phone: "",
        location: {
          city: "",
          region: "",
          country_code: ""
        },
        links: [
          {
            type: "",
            label: "",
            url: ""
          }
        ]
      }
    },
    summary: {
      headline: "",
      description: "",
      years_experience: 0,
      domains: [],
      key_strengths: [],
    },
    skills: {
      hard_skills: [
        {
          name: "",
          proficiency: ""
        }
      ],
      soft_skills: [],
      tools: [
        {
          name: "",
          proficiency: ""
        }
      ],
      methodologies: []
    },
    experience: [{
      title: "",
      company: "",
      department_or_client: "",
      start_date: "",
      end_date: "",
      location: {
        city: "",
        region: "",
        country_code: ""
      },
      description: "",
      responsibilities: [],
      deliverables: [],
      skills_used: []
    }],
    education: [
      {
        institution: "",
        degree: "",
        field_of_study: "",
        location: {
          city: "",
          region: "",
          country_code: ""
        },
        start_date: "",
        end_date: ""
      }
    ],
    languages: [
      {
        name: "",
        level: ""
      }
    ],
    extras: [
      {
        name: "",
        summary: ""
      }
    ],
    projects: [
      {
        name: "",
        role: "",
        summary: "",
        tech_stack: [],
        keywords: [],
        start_date: "",
        end_date: ""
      }
    ],
    order_hint: [
      "header",
      "summary",
      "skills",
      "experience",
      "education",
      "languages",
      "extras",
      "projects"
    ],
    section_titles: {
      summary: "Résumé",
      skills: "Compétences",
      experience: "Expérience",
      education: "Éducation",
      languages: "Langues",
      extras: "Informations complémentaires",
      projects: "Projets personnels"
    },
    meta: {
      generator: "template-cv",
      source: "job-offer",
      created_at: "",
      updated_at: ""
    }
  };

  return JSON.stringify(defaultSchema, null, 2);
}

async function extractTextFromPdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData) => {
      console.error(`[createTemplateCv] Erreur lors du parsing PDF ${path.basename(filePath)}:`, errData.parserError);
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
        console.log(`[createTemplateCv] PDF extrait: ${path.basename(filePath)} - ${numPages} pages, ${text.length} caractères`);

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
async function extractJobOfferFromPdf(pdfPath, userId = null) {
  console.log(`[createTemplateCv - extractJobOfferFromPdf] Extraction et analyse du PDF: ${pdfPath}`);

  const client = getOpenAIClient();

  try {
    // 1. Extraire le texte brut du PDF
    const pdfData = await extractTextFromPdf(pdfPath);
    console.log(`[createTemplateCv - extractJobOfferFromPdf] PDF extrait: ${pdfData.text.length} caractères`);

    // 2. Analyser avec GPT pour structurer l'information
    const extractionPrompt = `Analyse le texte ci-dessous (extrait d'un PDF d'offre d'emploi) et extrait TOUTES les informations au format structuré suivant :

📋 TITRE DU POSTE:
[titre exact du poste]

📝 DESCRIPTION ET MISSIONS:
[description complète des missions, responsabilités et contexte du poste]

🎯 COMPÉTENCES TECHNIQUES REQUISES:
[liste exhaustive des technologies, langages, frameworks, outils demandés]

🎯 COMPÉTENCES NON-TECHNIQUES:
[soft skills, qualités personnelles, compétences relationnelles]

💼 EXPÉRIENCE:
[niveau d'expérience requis, nombre d'années]

🎓 FORMATION:
[diplômes ou formations requis]

🏢 ENTREPRISE:
[nom de l'entreprise et informations disponibles]

📍 LOCALISATION:
[lieu de travail, mode (présentiel/télétravail/hybride)]

💰 SALAIRE/CONTRAT:
[fourchette salariale, type de contrat si mentionné]

⚠️ RÈGLES CRITIQUES:
- Extrait le MAXIMUM de détails pertinents pour adapter un CV
- Ignore le texte non pertinent (headers, footers, mentions légales)
- Si une info est absente, écris "Non spécifié"
- Garde TOUS les mots-clés techniques importants

TEXTE DU PDF À ANALYSER:
${pdfData.text}`;

    console.log('[createTemplateCv - extractJobOfferFromPdf] Envoi à GPT pour analyse...');

    const extractModel = await getAiModelSetting('model_extract_job_offer');

    const response = await client.chat.completions.create(addTemperatureIfSupported({
      model: extractModel,
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en analyse d\'offres d\'emploi. Tu extrais les informations de manière structurée et exhaustive depuis des PDFs.'
        },
        {
          role: 'user',
          content: extractionPrompt
        }
      ],
      max_completion_tokens: 4000,
    }, 0.1));

    // Track OpenAI usage
    if (userId && response.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'create_template_cv',
        model: extractModel,
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
      });
    }

    const text = response.choices?.[0]?.message?.content;

    if (!text || text.trim().length === 0) {
      throw new Error('GPT n\'a retourné aucun contenu');
    }

    console.log(`[createTemplateCv - extractJobOfferFromPdf] ✅ Analyse GPT terminée (${text.length} caractères)`);

    return {
      name: pdfData.name,
      text: text.trim(),
      source: pdfPath
    };

  } catch (error) {
    console.error(`[createTemplateCv - extractJobOfferFromPdf] ❌ Erreur:`, error.message);
    throw new Error(`Impossible d'analyser le PDF d'offre d'emploi ${path.basename(pdfPath)}: ${error.message}`);
  }
}

/**
 * Extrait le contenu d'une offre d'emploi avec GPT + Puppeteer
 * @param {string} url - URL de l'offre d'emploi
 * @returns {Promise<Object>} - { url, title, text }
 */
async function extractJobOfferWithGPT(url, userId = null) {
  console.log(`[createTemplateCv - extractJobOfferWithGPT] Extraction de l'offre depuis: ${url}`);

  const client = getOpenAIClient();

  try {
    // Fetch le HTML avec Puppeteer + Stealth pour contourner Indeed
    console.log('[createTemplateCv - extractJobOfferWithGPT] Lancement de Puppeteer en mode stealth...');
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

      console.log(`[createTemplateCv - extractJobOfferWithGPT] Navigation vers ${url}...`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Attendre que le contenu se charge (Indeed charge le contenu dynamiquement)
      console.log('[createTemplateCv - extractJobOfferWithGPT] Attente du chargement du contenu...');
      try {
        await page.waitForSelector('body', { timeout: 5000 });
      } catch (e) {
        console.log('[createTemplateCv - extractJobOfferWithGPT] Timeout waitForSelector, on continue...');
      }
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Récupérer le HTML complet
      html = await page.content();
      console.log(`[createTemplateCv - extractJobOfferWithGPT] ✅ HTML récupéré avec Puppeteer (${html.length} caractères)`);

      await browser.close();
    } catch (error) {
      await browser.close().catch(() => {});
      throw error;
    }

    // Trouver le début du contenu de l'offre (chercher le titre avec H/F ou h/f)
    console.log(`[createTemplateCv - extractJobOfferWithGPT] Recherche du titre de l'offre dans le HTML...`);

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
        console.log(`[createTemplateCv - extractJobOfferWithGPT] ✅ Titre trouvé avec pattern ${foundPattern} à l'index ${startIndex}`);
        break;
      }
    }

    // Si on a trouvé le titre, ne garder que le HTML à partir de ce point
    let optimizedHtml = html;
    if (startIndex > 0 && startIndex < html.length - 1000) {
      // Reculer un peu pour capturer le contexte (500 caractères avant)
      const contextStart = Math.max(0, startIndex - 500);
      optimizedHtml = html.substring(contextStart);
      console.log(`[createTemplateCv - extractJobOfferWithGPT] HTML optimisé: ${html.length} → ${optimizedHtml.length} caractères (réduction de ${Math.round((1 - optimizedHtml.length / html.length) * 100)}%)`);
    } else {
      console.log(`[createTemplateCv - extractJobOfferWithGPT] ⚠️ Titre non trouvé, envoi du HTML complet`);
    }

    console.log(`[createTemplateCv - extractJobOfferWithGPT] HTML final à envoyer à GPT: ${optimizedHtml.length} caractères`);

    // Appeler GPT pour extraire les informations de l'offre
    const extractionPrompt = `Analyse le HTML ci-dessous et extrait TOUTES les informations de l'offre d'emploi au format structuré suivant :

📋 TITRE DU POSTE:
[titre exact du poste]

📝 DESCRIPTION ET MISSIONS:
[description complète des missions, responsabilités et contexte du poste]

🎯 COMPÉTENCES TECHNIQUES REQUISES:
[liste exhaustive des technologies, langages, frameworks, outils demandés]

🎯 COMPÉTENCES NON-TECHNIQUES:
[soft skills, qualités personnelles, compétences relationnelles]

💼 EXPÉRIENCE:
[niveau d'expérience requis, nombre d'années]

🎓 FORMATION:
[diplômes ou formations requis]

🏢 ENTREPRISE:
[nom de l'entreprise et informations disponibles]

📍 LOCALISATION:
[lieu de travail, mode (présentiel/télétravail/hybride)]

💰 SALAIRE/CONTRAT:
[fourchette salariale, type de contrat si mentionné]

⚠️ RÈGLES CRITIQUES:
- Extrait le MAXIMUM de détails pertinents pour adapter un CV
- Ignore TOUT ce qui n'est PAS l'offre (navigation, pub, footer, cookies, menu)
- Si une info est absente, écris "Non spécifié"
- Garde TOUS les mots-clés techniques importants

HTML À ANALYSER:
${optimizedHtml}`;

    const extractModel = await getAiModelSetting('model_extract_job_offer');

    const response = await client.chat.completions.create(addTemperatureIfSupported({
      model: extractModel,
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en analyse d\'offres d\'emploi. Tu extrais les informations de manière structurée et exhaustive.'
        },
        {
          role: 'user',
          content: extractionPrompt
        }
      ],
      max_completion_tokens: 4000,
    }, 0.1));

    // Track OpenAI usage
    if (userId && response.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'create_template_cv',
        model: extractModel,
        promptTokens: response.usage.prompt_tokens || 0,
        completionTokens: response.usage.completion_tokens || 0,
      });
    }

    const text = response.choices?.[0]?.message?.content;

    if (!text || text.trim().length === 0) {
      throw new Error('GPT n\'a retourné aucun contenu');
    }

    console.log(`[createTemplateCv - extractJobOfferWithGPT] ✅ Contenu extrait par GPT (${text.length} caractères)`);

    // Extraire le titre si présent dans le texte
    const jobTitleMatch = text.match(/📋 TITRE DU POSTE:\s*\n(.+)/i);
    const jobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'Offre d\'emploi';

    return {
      url,
      title: jobTitle,
      text: text.trim()
    };

  } catch (error) {
    console.error(`[createTemplateCv - extractJobOfferWithGPT] ❌ Erreur GPT:`, error.message);
    throw new Error(`Impossible d'extraire l'offre d'emploi depuis ${url}: ${error.message}`);
  }
}

async function prepareJobOfferContent(files, links) {
  const sections = [];

  // Traiter les liens
  if (links?.length > 0) {
    sections.push('Offres d\'emploi (liens à analyser) :');
    links.forEach(link => sections.push(`- ${link}`));
    sections.push('');
  }

  // Traiter les fichiers PDF
  if (files?.length > 0) {
    for (const entry of files) {
      const filePath = entry.path;
      if (!filePath) continue;

      try {
        await fs.access(filePath);
      } catch {
        console.warn(`[createTemplateCv] Fichier introuvable ${filePath}`);
        continue;
      }

      console.log(`[createTemplateCv] Traitement pièce jointe ${filePath}`);
      const extracted = await extractTextFromPdf(filePath);

      sections.push(`\n=== Offre d'emploi (${extracted.name}) ===`);
      sections.push(extracted.text);
      sections.push('=== Fin ===\n');
    }
  }

  return sections.join('\n');
}

async function callChatGPT(client, model, cvSchema, jobOfferContent, signal) {
  try {
    // Charger les prompts depuis les fichiers .md
    const systemPrompt = await loadPrompt('lib/openai/prompts/create-template/system.md');
    const userPrompt = await loadPromptWithVars('lib/openai/prompts/create-template/user.md', {
      cvSchema: cvSchema,
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
      response_format: { type: 'json_object' }
    };

    // Passer le signal séparément comme option de requête
    const fetchOptions = signal ? { signal } : {};

    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Aucun texte retourné par ChatGPT');
    }

    return {
      content: content.trim(),
      usage: response.usage
    };
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[createTemplateCv] Erreur lors de l\'appel ChatGPT:', error);
    throw error;
  }
}

function normalizeJsonPayload(raw) {
  const data = JSON.parse(raw);
  return JSON.stringify(data, null, 2);
}

/**
 * Création d'un CV modèle via OpenAI à partir d'une offre d'emploi
 * @param {Object} params
 * @param {Array<string>} params.links - Liens vers les offres d'emploi
 * @param {Array<Object>} params.files - Fichiers joints (PDF d'offres)
 * @param {string} params.analysisLevel - Niveau d'analyse
 * @param {string} params.requestedModel - Modèle OpenAI à utiliser (optionnel)
 * @param {AbortSignal} params.signal - Signal pour annuler la requête
 * @param {string} params.userId - ID de l'utilisateur (pour télémétrie)
 * @returns {Promise<Array<string>>} - Liste des contenus JSON générés
 */
export async function createTemplateCv({
  links = [],
  files = [],
  analysisLevel = 'medium',
  requestedModel = null,
  signal = null,
  userId = null
}) {
  console.log('[createTemplateCv] Démarrage de la création de CV modèle');

  if (!links.length && !files.length) {
    throw new Error('Aucune offre d\'emploi fournie (lien ou fichier requis)');
  }

  // Vérifier les crédits OpenAI avant les opérations longues
  console.log('[createTemplateCv] Vérification des crédits OpenAI...');
  try {
    await checkOpenAICredits();
    console.log('[createTemplateCv] ✅ Crédits OpenAI disponibles');
  } catch (error) {
    console.error('[createTemplateCv] ❌ Erreur crédits OpenAI:', error.message);
    throw error;
  }

  const client = getOpenAIClient();
  const model = await getModelForAnalysisLevel(analysisLevel, requestedModel);

  console.log(`[createTemplateCv] Modèle GPT utilisé : ${model}`);

  // Récupération du schéma de référence
  console.log('[createTemplateCv] Récupération du schéma de référence...');
  const cvSchema = await getCvSchema();

  // Extraire le contenu des URLs avec Puppeteer + GPT
  const scrapedUrls = [];
  for (const link of links || []) {
    try {
      const extracted = await extractJobOfferWithGPT(link, userId);
      scrapedUrls.push(extracted);
    } catch (error) {
      console.error(`[createTemplateCv] Erreur extraction ${link}:`, error);
      throw error;
    }
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
      console.warn(`[createTemplateCv] Impossible de lire/analyser ${entry.path}:`, error);
    }
  }

  const generatedContents = [];

  // Créer un CV modèle par URL scrapée
  for (const scraped of scrapedUrls) {
    // Vérifier si annulé
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const currentOfferContent = `Offre d'emploi extraite depuis: ${scraped.url}\n\nTitre: ${scraped.title}\n\n${scraped.text}`;

    console.log(`\n[createTemplateCv] Création de CV modèle pour : ${scraped.url}`);

    const result = await callChatGPT(
      client,
      model,
      cvSchema,
      currentOfferContent,
      signal
    );

    if (!result.content) {
      throw new Error('GPT n\'a pas su générer le CV modèle.');
    }

    // Tracking OpenAI usage
    if (userId && result.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'create_template_cv',
        model,
        promptTokens: result.usage.prompt_tokens || 0,
        completionTokens: result.usage.completion_tokens || 0,
      });
    }

    const formattedText = normalizeJsonPayload(result.content);

    // Enrichissement avec métadonnées
    const parsed = JSON.parse(formattedText);
    const isoNow = new Date().toISOString();

    if (!parsed.generated_at) {
      parsed.generated_at = isoNow.substring(0, 10); // Format YYYY-MM-DD
    }

    const meta = {
      created_at: isoNow,
      updated_at: isoNow,
      generator: 'template-cv',
      source: 'job-offer'
    };

    if (parsed.meta) {
      parsed.meta = { ...parsed.meta, ...meta };
    } else {
      parsed.meta = meta;
    }

    const enrichedContent = JSON.stringify(parsed, null, 2);
    generatedContents.push({
      cvContent: enrichedContent,
      extractedJobOffer: scraped.text,
      source: scraped.url
    });
  }

  // Créer un CV modèle par PDF
  for (const { extracted } of extractedFiles) {
    // Vérifier si annulé
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const currentOfferContent = `Offre d'emploi (${extracted.name}) :\n${extracted.text}`;

    console.log(`\n[createTemplateCv] Création de CV modèle pour : ${extracted.name}`);

    const result = await callChatGPT(
      client,
      model,
      cvSchema,
      currentOfferContent,
      signal
    );

    if (!result.content) {
      throw new Error('GPT n\'a pas su générer le CV modèle.');
    }

    // Tracking OpenAI usage
    if (userId && result.usage) {
      await trackOpenAIUsage({
        userId,
        featureName: 'create_template_cv',
        model,
        promptTokens: result.usage.prompt_tokens || 0,
        completionTokens: result.usage.completion_tokens || 0,
      });
    }

    const formattedText = normalizeJsonPayload(result.content);

    // Enrichissement avec métadonnées
    const parsed = JSON.parse(formattedText);
    const isoNow = new Date().toISOString();

    if (!parsed.generated_at) {
      parsed.generated_at = isoNow.substring(0, 10); // Format YYYY-MM-DD
    }

    const meta = {
      created_at: isoNow,
      updated_at: isoNow,
      generator: 'template-cv',
      source: 'job-offer'
    };

    if (parsed.meta) {
      parsed.meta = { ...parsed.meta, ...meta };
    } else {
      parsed.meta = meta;
    }

    const enrichedContent = JSON.stringify(parsed, null, 2);
    generatedContents.push({
      cvContent: enrichedContent,
      extractedJobOffer: extracted.text, // Analyse GPT du PDF d'offre
      source: extracted.name
    });
  }

  console.log(`[createTemplateCv] ${generatedContents.length} CV(s) modèle(s) créé(s)`);
  return generatedContents;
}

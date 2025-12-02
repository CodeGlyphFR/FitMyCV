import { promises as fs } from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import { getOpenAIClient, checkOpenAICredits } from './client.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';

async function getCvSchema() {
  const projectRoot = process.cwd();
  const templatePath = path.join(projectRoot, 'data', 'template.json');

  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    console.log(`[importPdf] Utilisation du template : ${templatePath}`);
    return content;
  } catch (error) {
    console.warn(`[importPdf] Impossible de lire template.json: ${error.message}`);
  }

  // Fallback: schéma par défaut
  console.log('[importPdf] Utilisation du schéma par défaut');
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
      generator: "pdf-import",
      source: "pdf-import",
      created_at: "",
      updated_at: ""
    }
  };

  return JSON.stringify(defaultSchema, null, 2);
}

async function extractTextFromPdf(pdfPath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData) => {
      console.error(`[importPdf] Erreur lors du parsing PDF:`, errData.parserError);
      reject(new Error(errData.parserError));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
      try {
        // Extraction du texte de toutes les pages
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
        console.log(`[importPdf] PDF extrait: ${numPages} pages, ${text.length} caractères`);

        resolve(text.trim());
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.loadPDF(pdfPath);
  });
}

async function callChatGPT(client, model, cvSchema, pdfText, userId = null) {
  try {
    // Charger les prompts depuis les fichiers .md
    const systemPrompt = await loadPrompt('lib/openai/prompts/import-pdf/system.md');
    const userPrompt = await loadPromptWithVars('lib/openai/prompts/import-pdf/user.md', {
      cvSchema: cvSchema,
      pdfText: pdfText
    });

    const startTime = Date.now();
    const response = await client.chat.completions.create({
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
    });
    const duration = Date.now() - startTime;

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptNoContent' }));
    }

    // Return content with tracking data
    return {
      content: content.trim(),
      usage: response.usage,
      duration,
    };
  } catch (error) {
    console.error('[importPdf] Erreur lors de l\'appel ChatGPT:', error);
    throw error;
  }
}

function normalizeJsonPayload(raw) {
  // Essayer d'extraire le JSON si enrobé dans du markdown
  let cleanedText = raw.trim();

  const jsonMatch = cleanedText.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    cleanedText = jsonMatch[1];
  } else {
    const bareJsonMatch = cleanedText.match(/(\{[\s\S]*\})/);
    if (bareJsonMatch) {
      cleanedText = bareJsonMatch[1];
    }
  }

  const data = JSON.parse(cleanedText);
  return JSON.stringify(data, null, 2);
}

/**
 * Import d'un CV PDF via OpenAI
 * @param {string} pdfFilePath - Chemin vers le fichier PDF
 * @param {string} userId - ID de l'utilisateur (pour la télémétrie)
 * @param {boolean} isFirstImport - Si true, utilise le modèle dédié au premier import
 * @returns {Promise<string>} - Contenu JSON du CV extrait
 */
export async function importPdfCv({ pdfFilePath, userId = null, isFirstImport = false }) {
  console.log(`[importPdf] Traitement du fichier PDF : ${path.basename(pdfFilePath)}`);

  // Vérifier les crédits OpenAI avant l'appel
  console.log('[importPdf] Vérification des crédits OpenAI...');
  try {
    await checkOpenAICredits();
    console.log('[importPdf] ✅ Crédits OpenAI disponibles');
  } catch (error) {
    console.error('[importPdf] ❌ Erreur crédits OpenAI:', error.message);
    throw error;
  }

  const client = getOpenAIClient();

  // Sélection du modèle selon si c'est un premier import ou non
  const modelSetting = isFirstImport ? 'model_first_import_pdf' : 'model_import_pdf';
  const model = await getAiModelSetting(modelSetting);

  console.log(`[importPdf] Modèle GPT utilisé : ${model} (premier import: ${isFirstImport})`);

  // Extraction du texte du PDF
  console.log('[importPdf] Extraction du texte du PDF...');
  const pdfText = await extractTextFromPdf(pdfFilePath);

  if (!pdfText || pdfText.trim().length === 0) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.noTextExtracted' }));
  }

  // Récupération du schéma
  console.log('[importPdf] Récupération du schéma de référence...');
  const cvSchema = await getCvSchema();

  // Appel ChatGPT
  console.log('[importPdf] Analyse du CV par ChatGPT...');
  const result = await callChatGPT(client, model, cvSchema, pdfText, userId);

  if (!result.content) {
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptExtractionFailed' }));
  }

  const preview = result.content.replace(/\n/g, ' ').substring(0, 200);
  console.log(`[importPdf] Réponse brute de ChatGPT : ${preview}...`);

  // Normalisation et validation JSON
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
    generator: 'pdf-import',
    source: 'pdf-import'
  };

  if (parsed.meta) {
    parsed.meta = { ...parsed.meta, ...meta };
  } else {
    parsed.meta = meta;
  }

  const enrichedContent = JSON.stringify(parsed, null, 2);
  console.log('[importPdf] CV importé avec succès');

  // Track OpenAI usage only for successful import
  if (userId && result.usage) {
    try {
      await trackOpenAIUsage({
        userId,
        featureName: isFirstImport ? 'first_import_pdf' : 'import_pdf',
        model,
        promptTokens: result.usage.prompt_tokens || 0,
        completionTokens: result.usage.completion_tokens || 0,
        cachedTokens: result.usage.prompt_tokens_details?.cached_tokens || 0,
        duration: result.duration,
      });
    } catch (trackError) {
      console.error('[importPdf] Failed to track OpenAI usage:', trackError);
    }
  }

  return enrichedContent;
}

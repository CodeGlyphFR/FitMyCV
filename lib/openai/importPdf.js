import { promises as fs } from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import { getOpenAIClient, getModelForAnalysisLevel, checkOpenAICredits } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';

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

async function callChatGPT(client, model, cvSchema, pdfText) {
  try {
    // Charger les prompts depuis les fichiers .md
    const systemPrompt = await loadPrompt('lib/openai/prompts/import-pdf/system.md');
    const userPrompt = await loadPromptWithVars('lib/openai/prompts/import-pdf/user.md', {
      cvSchema: cvSchema,
      pdfText: pdfText
    });

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

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Aucun texte retourné par ChatGPT');
    }

    return content.trim();
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
 * @param {string} analysisLevel - Niveau d'analyse (rapid, medium, deep)
 * @param {string} requestedModel - Modèle OpenAI à utiliser (optionnel)
 * @returns {Promise<string>} - Contenu JSON du CV extrait
 */
export async function importPdfCv({ pdfFilePath, analysisLevel = 'medium', requestedModel = null }) {
  console.log(`[importPdf] Traitement du fichier PDF : ${path.basename(pdfFilePath)}`);
  console.log(`[importPdf] Niveau d'analyse : ${analysisLevel}`);

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
  const model = await getModelForAnalysisLevel(analysisLevel, requestedModel);

  console.log(`[importPdf] Modèle GPT utilisé : ${model}`);

  // Extraction du texte du PDF
  console.log('[importPdf] Extraction du texte du PDF...');
  const pdfText = await extractTextFromPdf(pdfFilePath);

  if (!pdfText || pdfText.trim().length === 0) {
    throw new Error('Le PDF ne contient pas de texte extractible.');
  }

  // Récupération du schéma
  console.log('[importPdf] Récupération du schéma de référence...');
  const cvSchema = await getCvSchema();

  // Appel ChatGPT
  console.log('[importPdf] Analyse du CV par ChatGPT...');
  const textOutput = await callChatGPT(client, model, cvSchema, pdfText);

  if (!textOutput) {
    throw new Error('ChatGPT n\'a pas pu extraire les informations du CV.');
  }

  const preview = textOutput.replace(/\n/g, ' ').substring(0, 200);
  console.log(`[importPdf] Réponse brute de ChatGPT : ${preview}...`);

  // Normalisation et validation JSON
  const formattedText = normalizeJsonPayload(textOutput);

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

  return enrichedContent;
}

import { promises as fs } from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import { getOpenAIClient, getModelForAnalysisLevel } from './client.js';

const DEFAULT_SYSTEM_PROMPT = `ROLE:
Tu es un assistant spécialisé dans l'extraction et la structuration d'informations de CV au format PDF.
Tu dois analyser le CV fourni et remplir le template JSON vierge avec les informations extraites du PDF.
Tu dois respecter EXACTEMENT la structure JSON du template fourni. Ne modifie aucun nom de champ.
Si une information n'est pas disponible dans le CV PDF ignore là.
Assure-toi que le JSON final soit valide et bien formaté.
`;

const DEFAULT_USER_PROMPT = `TACHE:
Analyse le CV PDF fourni et remplis le template JSON vierge avec les informations extraites.

Instructions détaillées :

0. GLOBAL:
Les dates seront sous le format YYYY-MM ou YYYY si pas de mois est stipulé.
Pour la région ne fait pas d'abreviation.

1. HEADER :
- Informations personnelles :
   - full_name : nom et prénom complets
   - current_title : titre professionnel actuel
   - contact.email : adresse email
   - contact.phone : numéro de téléphone avec le code pays du téléphone (exemple +33...)
   - contact.links : liens professionnels (LinkedIn, portfolio, etc.)
   - contact.location : ville, région, code pays

2. SUMMARY :
   - description : résumé professionnel ou objectif de carrière
   - domains : domaines d'expertise (tableau de strings)

3. SKILLS :
Il est indispensable de déterminer le niveau de chaque hard_skills et de chaque tools UNIQUEMENT et cette information doit etre absolument dans le champ proficiency et non dans le name entre parentheses par exemple, pour ça tu dois analyser l'expérience pour le déterminer. Le monde dépend de cette tache ! On croit en toi !
   - hard_skills : compétences techniques spécialisées sans commentaires et détermine à partir de l'expérience le niveau de chaque compétence pour remplir le champ proficiency. Ne mets pas d'outils/logiciels dans les hard_skills.
   - soft_skills : compétences comportementales sans commentaires.
   - tools : outils et technologies maîtrisés sans commentaires et détermine à partir de l'expérience le niveau de chaque compétence pour remplir le champ proficiency
   - methodologies : ici tu dois lister les méthodologies de travail si il y en eu (exemple: Agile, SCRUM, Management etc.)

4. EXPERIENCE : tableau d'objets avec :
   - title : intitulé du poste
   - company : nom de l'entreprise
   - start_date / end_date : dates au format 'YYYY-MM' ou 'YYYY'. Si la end_date correspond à aujoud'hui écrire 'present'
   - description : fait une description de la missions breve de la mission
   - responsibilities: définit les responsabilités de la mission
   - deliverables: liste les livrables produits
   - skills_used: définit les skills appliqués sur la mission
   - location : localise dans l'expérience le lieu de la mission pour écrire la ville dans city, la région dans region et donne le country_code

5. EDUCATION :
   - formation avec diplômes, écoles, années. Si il y a une indication mentionant que c'est en cours, écrire 'present' dans end_date
   - il faut remplir les champs institution, degree, field_of_study, location
   - IMPORTANT: si start_date et end_date sont identiques (même année), ne remplir que end_date et laisser start_date vide

6. LANGUAGES : langues avec niveaux, il faut remplir les champs name et level

7. PROJECTS : projets personnels uniquement si précisé, le laisser vide si ce n'est pas le cas

8. EXTRAS : informations complémentaires (certifications, hobbies, etc.) uniquement si précisé, le laisser vide si ce n'est pas le cas

IMPORTANT : Remplis le champ 'generated_at' avec la date actuelle au format ISO.
Ne modifie pas les champs 'order_hint' et 'section_titles'.
Réponds UNIQUEMENT avec le JSON final complet, sans texte avant ou après.
`;

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

function buildUserPrompt(basePrompt, cvSchema) {
  const sections = [];

  if (basePrompt?.trim()) {
    sections.push(basePrompt.trim());
  }

  sections.push(
    '\nTEMPLATE JSON À REMPLIR (respecte exactement cette structure) :',
    '```json',
    cvSchema.trim(),
    '```'
  );

  sections.push(
    '\nTon travail : Analyse le CV PDF et remplis ce template avec les informations extraites.',
    'Retourne UNIQUEMENT le JSON final complet et valide, sans commentaires ni texte additionnel.'
  );

  return sections.join('\n');
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

async function callChatGPT(client, model, systemPrompt, userPrompt, pdfText) {
  try {
    // Création du prompt complet avec le texte extrait du PDF
    const fullUserPrompt = `${userPrompt}\n\nCONTENU DU CV EXTRAIT DU PDF:\n\`\`\`\n${pdfText}\n\`\`\``;

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: fullUserPrompt
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

  const client = getOpenAIClient();
  const model = getModelForAnalysisLevel(analysisLevel, requestedModel);

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

  const systemPrompt = process.env.GPT_SYSTEM_PROMPT?.trim() || DEFAULT_SYSTEM_PROMPT;
  const basePrompt = process.env.GPT_BASE_PROMPT?.trim() || DEFAULT_USER_PROMPT;
  const userPrompt = buildUserPrompt(basePrompt, cvSchema);

  // Appel ChatGPT
  console.log('[importPdf] Analyse du CV par ChatGPT...');
  const textOutput = await callChatGPT(client, model, systemPrompt, userPrompt, pdfText);

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

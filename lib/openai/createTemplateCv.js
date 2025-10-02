import { promises as fs } from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import { getOpenAIClient, getModelForAnalysisLevel } from './client.js';

const TEMPLATE_SYSTEM_PROMPT = `ROLE:
Tu es un assistant expert en rédaction de CV et tu connais parfaitement les standards de formatage ATS des outils RH.
Tu crées des CV professionnels, clairs et optimisés pour les systèmes de recrutement automatisés.

CONTEXT:
Tu dois créer un CV exemple/modèle professionnel à partir d'une offre d'emploi fournie.
Ce CV doit être cohérent avec l'offre d'emploi et servir de modèle que l'utilisateur pourra personnaliser ensuite.
`;

const TEMPLATE_USER_PROMPT = `TACHES:
- Analyse l'offre d'emploi fournie et identifie :
  * Le titre du poste
  * Les hard skills et tech skills requises
  * Les soft skills importantes
  * Le niveau d'expérience attendu
  * La langue de l'offre (français ou anglais)

- Crée un CV exemple professionnel qui correspond à cette offre avec :
  * Un profil fictif mais réaliste et professionnel
  * Des expériences cohérentes avec le niveau requis (junior, confirmé, senior)
  * Les compétences techniques et soft skills qui matchent l'offre
  * Une éducation appropriée pour le poste
  * Un résumé/summary percutant adapté au poste

- IMPORTANT : Le CV doit être rédigé dans la MÊME LANGUE que l'offre d'emploi
  * Si l'offre est en français -> CV en français
  * Si l'offre est en anglais -> CV en anglais

- Structure JSON attendue :
{
  "header": {
    "full_name": "Prénom Nom",
    "current_title": "Titre professionnel",
    "summary": "Résumé professionnel percutant...",
    "contact": {
      "email": "exemple@email.com",
      "phone": "+33 X XX XX XX XX",
      "location": "Ville, Pays",
      "links": [
        {"type": "linkedin", "url": "https://linkedin.com/in/exemple"},
        {"type": "github", "url": "https://github.com/exemple"}
      ]
    }
  },
  "experience": [
    {
      "company": "Nom Entreprise",
      "position": "Titre du poste",
      "start_date": "MM/YYYY",
      "end_date": "MM/YYYY",
      "location": "Ville, Pays",
      "description": "Description des responsabilités et réalisations..."
    }
  ],
  "education": [
    {
      "school": "Nom École/Université",
      "degree": "Diplôme",
      "field": "Domaine",
      "start_date": "YYYY",
      "end_date": "YYYY",
      "location": "Ville, Pays"
    }
  ],
  "skills": [
    {
      "category": "Catégorie",
      "items": [
        {"name": "Compétence", "proficiency": "Niveau"}
      ]
    }
  ],
  "languages": [
    {
      "name": "Langue",
      "level": "Niveau"
    }
  ],
  "projects": [
    {
      "name": "Nom du projet",
      "description": "Description...",
      "tech_stack": ["Techno1", "Techno2"]
    }
  ]
}

- Réponds UNIQUEMENT avec le JSON final, sans texte additionnel.
- Le CV doit être réaliste et professionnel, pas générique.
- Adapte le niveau d'expérience et de séniorité au poste demandé.
`;

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

function buildUserPrompt(basePrompt, jobOfferContent) {
  const sections = [];

  if (basePrompt?.trim()) {
    sections.push(basePrompt.trim());
  }

  if (jobOfferContent?.trim()) {
    sections.push('\n' + jobOfferContent.trim());
  }

  sections.push(
    '\n\nProduit retour attendu : Le JSON du CV modèle complet, sans texte additionnel.'
  );

  return sections.join('\n');
}

async function callChatGPT(client, model, systemPrompt, userPrompt, signal) {
  try {
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

    // Ajouter le signal d'annulation si fourni
    if (signal) {
      requestOptions.signal = signal;
    }

    const response = await client.chat.completions.create(requestOptions);

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Aucun texte retourné par ChatGPT');
    }

    return content.trim();
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
 * @returns {Promise<Array<string>>} - Liste des contenus JSON générés
 */
export async function createTemplateCv({
  links = [],
  files = [],
  analysisLevel = 'medium',
  requestedModel = null,
  signal = null
}) {
  console.log('[createTemplateCv] Démarrage de la création de CV modèle');

  if (!links.length && !files.length) {
    throw new Error('Aucune offre d\'emploi fournie (lien ou fichier requis)');
  }

  const client = getOpenAIClient();
  const model = getModelForAnalysisLevel(analysisLevel, requestedModel);

  console.log(`[createTemplateCv] Modèle GPT utilisé : ${model}`);

  const systemPrompt = process.env.GPT_TEMPLATE_SYSTEM_PROMPT?.trim() || TEMPLATE_SYSTEM_PROMPT;
  const basePrompt = process.env.GPT_TEMPLATE_USER_PROMPT?.trim() || TEMPLATE_USER_PROMPT;

  const jobOfferContent = await prepareJobOfferContent(files, links);

  const generatedContents = [];

  // Créer un CV modèle par offre (lien ou fichier)
  const totalOffers = links.length + files.length;

  for (let i = 0; i < totalOffers; i++) {
    // Vérifier si annulé
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    let currentOfferContent = '';
    let label = '';

    if (i < links.length) {
      // C'est un lien
      label = links[i];
      currentOfferContent = `Offre d'emploi (lien) :\n- ${links[i]}`;
    } else {
      // C'est un fichier
      const fileIndex = i - links.length;
      const file = files[fileIndex];
      const extracted = await extractTextFromPdf(file.path);
      label = extracted.name;
      currentOfferContent = `Offre d'emploi (${extracted.name}) :\n${extracted.text}`;
    }

    const userPrompt = buildUserPrompt(basePrompt, currentOfferContent);

    console.log(`\n[createTemplateCv] Création de CV modèle pour : ${label}`);

    const textOutput = await callChatGPT(
      client,
      model,
      systemPrompt,
      userPrompt,
      signal
    );

    if (!textOutput) {
      throw new Error('GPT n\'a pas su générer le CV modèle.');
    }

    const formattedText = normalizeJsonPayload(textOutput);
    generatedContents.push(formattedText);
  }

  console.log(`[createTemplateCv] ${generatedContents.length} CV(s) modèle(s) créé(s)`);
  return generatedContents;
}

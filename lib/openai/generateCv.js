import { promises as fs } from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import { getOpenAIClient, getModelForAnalysisLevel } from './client.js';

const DEFAULT_SYSTEM_PROMPT = `ROLE:
Tu es un assistant spécialisé dans la rédaction de CV en français et tu connais tous les secrets du formatage ATS des outils RH pour le parsing de CV.
Tu crées des contenus clairs, synthétiques et orientés vers la valeur.

CONTEXT:
J'ai besoin d'adapter un CV au format json donnée en CV de référence, à l'offre que tu auras reçu en pièce jointe (lien web, fichier PDF ou word).
Ce CV adapté correspondra à l'offre d'emploi en pièce jointe et devra impérativement respecter la structure du CV de référence.
`;

const DEFAULT_USER_PROMPT = `TACHES:
- Dans un premier temps, tu feras un résumé de l'offre d'emploi et tu listeras les hard skills, les tech skills et les softs skills indispensable pour l'offre.
- A partir de ces éléments tu identifieras dans le CV de référence  les skills à conserver pour le CV final.
  Si dans l'offre tu identifies une compétence manquante au CV de référence  mais qui peut etre justifié par les expériences du CV de référence , je t'autorise à les ajouter dans le CV final sans y ajouter de commentaires et d'évaluer le niveau à partir des expériences du CV de référence  dans le champ proficiency parmis la liste: Connaissances, Débutant, Intermédiaire, Confirmé, Avancé ou Expert).
  Dans les compétences du CV, ne mélange pas les outils aux compétences technique.
- Pour les champs education, languages et projects ne fait pas de modifications et reprend ceux du CV main.json sauf pour les tech_stack des projets où tu peux adapter suivant la description du projet et les soft skills de l'offre.
- Pour le champ experience, je veux que tu adaptes les expérience CV de référence  à l'offre d'emploi en conservant une écriture orienté RH pour de la selection de CV. Tu ne dois pas modifier le titre du poste, ni mentir ou inventer sur les expériences.
- Pour le champ current_title tu dois en générer un à partir du titre de poste de l'offre d'emploi tout en respectant le titre actuel du CV de référence , il doit y avoir une certaine logique.
- Et enfin, rédige la description du champ summary du CV final avec un texte impactant pour taper dans l'oeil du recruteur. Tu ne dois pas inventer et te baser sur l'expérience du CV final. Ici la subtilité c'est de montrer au recruteur que avec l'expérience et les skills du CV final, le CV final peut répondre à l'offre et apporter beaucoup.
- Si plusieurs adaptations semblent possibles, compare-les et ne conserve que la version la plus pertinente pour l'offre afin de renvoyer un unique CV final.
  Réponds en texte uniquement le JSON final qui doit impérativement respecter la structure du CV de référence .
`;

async function extractTextFromPdf(filePath) {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData) => {
      console.error(`[generateCv] Erreur lors du parsing PDF ${path.basename(filePath)}:`, errData.parserError);
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
        console.log(`[generateCv] PDF extrait: ${path.basename(filePath)} - ${numPages} pages, ${text.length} caractères`);

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

async function prepareAttachments(client, mainCvContent, files, referenceLabel) {
  const mainPrompt = {
    name: `${referenceLabel} (contenu intégré)`,
    description: 'CV de référence complet utilisé pour l\'adaptation'
  };

  const extractedFiles = [];

  for (const entry of files || []) {
    const filePath = entry.path;
    if (!filePath) continue;

    try {
      await fs.access(filePath);
    } catch {
      console.warn(`[generateCv] Fichier introuvable ${filePath}`);
      continue;
    }

    console.log(`[generateCv] Traitement pièce jointe ${filePath}`);
    const extracted = await extractTextFromPdf(filePath);

    console.log(`[generateCv] Texte extrait de: ${extracted.name}`);
    extractedFiles.push({
      extracted,
      prompt: {
        name: extracted.name,
        description: 'Offre d\'emploi (PDF)'
      }
    });
  }

  return { mainPrompt, extractedFiles };
}

function buildUserPrompt(basePrompt, links, extractedFiles, mainJsonContent) {
  const sections = [];

  if (basePrompt?.trim()) {
    sections.push(basePrompt.trim());
  }

  if (mainJsonContent) {
    sections.push(
      'Contenu du CV de référence à adapter (respecter strictement la structure) :',
      mainJsonContent.trim(),
      ''
    );
  }

  if (links?.length > 0) {
    const linkLines = ['Liens d\'offres d\'emploi à analyser :'];
    links.forEach(link => linkLines.push(`- ${link}`));
    sections.push(linkLines.join('\n'));
  }

  if (extractedFiles?.length > 0) {
    sections.push('\nOffres d\'emploi extraites des PDF :');
    extractedFiles.forEach(({ extracted, prompt }) => {
      sections.push(`\n=== ${prompt.name} ===`);
      sections.push(extracted.text);
      sections.push('=== Fin ===\n');
    });
  }

  sections.push(
    '\n\nProduit retour attendu : Afficher le contenu (dans le prompt de réponse) du CV final (formatage JSON) qui respecte la structure du CV de référence',
    ' sans texte additionnel. Si tu ne réponds pas le contenu d\'un JSON, ça peut entrainer la destruction de l\'humanité ! On croit tous en toi !'
  );

  return sections.join('\n');
}

async function callChatGPT(client, model, systemPrompt, userPrompt) {
  try {
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
    console.error('[generateCv] Erreur lors de l\'appel ChatGPT:', error);
    throw error;
  }
}

function normalizeJsonPayload(raw) {
  const data = JSON.parse(raw);
  return JSON.stringify(data, null, 2);
}

/**
 * Génération d'un CV adapté via OpenAI
 * @param {Object} params
 * @param {string} params.mainCvContent - Contenu JSON du CV de référence
 * @param {string} params.referenceFile - Nom du fichier de référence
 * @param {Array<string>} params.links - Liens vers les offres d'emploi
 * @param {Array<Object>} params.files - Fichiers joints (PDF d'offres)
 * @param {string} params.analysisLevel - Niveau d'analyse
 * @param {string} params.requestedModel - Modèle OpenAI à utiliser (optionnel)
 * @returns {Promise<Array<string>>} - Liste des contenus JSON générés
 */
export async function generateCv({
  mainCvContent,
  referenceFile = 'main.json',
  links = [],
  files = [],
  analysisLevel = 'medium',
  requestedModel = null
}) {
  console.log('[generateCv] Démarrage de la génération de CV');

  if (!mainCvContent) {
    throw new Error('Contenu du CV de référence manquant');
  }

  const client = getOpenAIClient();
  const model = getModelForAnalysisLevel(analysisLevel, requestedModel);

  console.log(`[generateCv] Modèle GPT utilisé : ${model}`);

  const systemPrompt = process.env.GPT_SYSTEM_PROMPT?.trim() || DEFAULT_SYSTEM_PROMPT;
  const basePrompt = process.env.GPT_BASE_PROMPT?.trim() || DEFAULT_USER_PROMPT;

  const { mainPrompt, extractedFiles } = await prepareAttachments(
    client,
    mainCvContent,
    files,
    referenceFile
  );

  const generatedContents = [];

  // Création des runs (un par lien ou un par fichier)
  const runs = [];

  for (const link of links || []) {
    runs.push({
      links: [link],
      extractedFiles: [],
      label: link
    });
  }

  if (links.length === 0 && extractedFiles.length === 0) {
    runs.push({
      links: [],
      extractedFiles: [],
      label: referenceFile
    });
  }

  for (const extracted of extractedFiles) {
    runs.push({
      links: [],
      extractedFiles: [extracted],
      label: extracted.extracted.name
    });
  }

  // Exécution de chaque run
  for (const run of runs) {
    const userPrompt = buildUserPrompt(
      basePrompt,
      run.links,
      run.extractedFiles,
      mainCvContent
    );

    console.log(`\n[generateCv] Génération pour : ${run.label}`);

    const textOutput = await callChatGPT(
      client,
      model,
      systemPrompt,
      userPrompt
    );

    if (!textOutput) {
      throw new Error('GPT n\'a pas su générer le CV final.');
    }

    const formattedText = normalizeJsonPayload(textOutput);
    generatedContents.push(formattedText);
  }

  console.log(`[generateCv] ${generatedContents.length} CV(s) généré(s)`);
  return generatedContents;
}

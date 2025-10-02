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

Instructions détaillées pour remplir le template JSON :

1. HEADER :
   - full_name : nom et prénom complets (fictifs mais réalistes)
   - current_title : titre professionnel correspondant au poste
   - contact.email : adresse email professionnelle (format: prenom.nom@exemple.com)
   - contact.phone : numéro de téléphone avec code pays (ex: +33 6 12 34 56 78)
   - contact.location : objet avec city, region, country_code (ex: "Paris", "Île-de-France", "FR")
   - contact.links : tableau d'objets avec type, label, url (ex: LinkedIn, GitHub, Portfolio, Site web)
     * type : le type de lien (linkedin, github, portfolio, website, etc.)
     * label : le texte affiché (ex: "LinkedIn", "GitHub", "Portfolio")
     * url : l'URL complète (ex: "https://linkedin.com/in/john-doe")

2. SUMMARY :
   - headline : titre/accroche courte et percutante (1 ligne)
   - description : résumé professionnel détaillé adapté au poste (2-3 phrases)
   - years_experience : nombre d'années d'expérience (nombre)
   - domains : domaines d'expertise correspondant à l'offre (tableau de strings)
   - key_strengths : forces clés / atouts principaux (tableau de strings, 3-5 éléments)

3. SKILLS :
   - hard_skills : compétences techniques avec niveau (name, proficiency). Détermine le niveau en fonction de l'expérience demandée
   - soft_skills : compétences comportementales (tableau de strings)
   - tools : outils et technologies avec niveau (name, proficiency)
   - methodologies : méthodologies de travail si pertinent (Agile, SCRUM, etc.)

4. EXPERIENCE : tableau d'expériences professionnelles avec :
   - title : intitulé du poste
   - company : nom de l'entreprise (fictive mais réaliste)
   - department_or_client : département ou client si pertinent
   - start_date / end_date : dates au format 'YYYY-MM' ou 'YYYY'
   - location : ville, région, code pays
   - description : description brève de la mission
   - responsibilities : liste des responsabilités
   - deliverables : liste des livrables produits
   - skills_used : compétences appliquées sur la mission

5. EDUCATION :
   - institution : nom de l'établissement
   - degree : diplôme obtenu
   - field_of_study : domaine d'études
   - location : ville, région, code pays
   - start_date / end_date : années au format 'YYYY'

6. LANGUAGES : langues avec niveaux (name, level)

7. PROJECTS : projets personnels si pertinent pour le poste
   - name : nom du projet
   - role : rôle/fonction sur le projet
   - summary : description du projet
   - tech_stack : technologies utilisées (tableau de strings)
   - keywords : mots-clés du projet (tableau de strings)
   - start_date / end_date : dates au format 'YYYY-MM' ou 'YYYY'

8. EXTRAS : informations complémentaires (certifications, hobbies, distinctions) si pertinent
   - name : titre de l'information (ex: "Certification AWS", "Bénévolat", "Distinctions")
   - summary : description détaillée

IMPORTANT :
- Remplis le champ 'generated_at' avec la date actuelle au format YYYY-MM-DD
- Ne modifie pas les champs 'order_hint' et 'section_titles'
- Le CV doit être réaliste et professionnel, pas générique
- Adapte le niveau d'expérience (junior: 1-3 ans, confirmé: 3-7 ans, senior: 7+ ans)
`;

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

function buildUserPrompt(basePrompt, cvSchema, jobOfferContent) {
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

  if (jobOfferContent?.trim()) {
    sections.push('\n' + jobOfferContent.trim());
  }

  sections.push(
    '\nTon travail : Analyse l\'offre d\'emploi et crée un CV modèle professionnel en remplissant ce template.',
    'Retourne UNIQUEMENT le JSON final complet et valide, sans commentaires ni texte additionnel.'
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

    // Passer le signal séparément comme option de requête
    const fetchOptions = signal ? { signal } : {};

    const response = await client.chat.completions.create(requestOptions, fetchOptions);

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

  // Récupération du schéma de référence
  console.log('[createTemplateCv] Récupération du schéma de référence...');
  const cvSchema = await getCvSchema();

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

    const userPrompt = buildUserPrompt(basePrompt, cvSchema, currentOfferContent);

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
    generatedContents.push(enrichedContent);
  }

  console.log(`[createTemplateCv] ${generatedContents.length} CV(s) modèle(s) créé(s)`);
  return generatedContents;
}

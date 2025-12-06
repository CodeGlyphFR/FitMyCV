import { promises as fs } from 'fs';
import path from 'path';
import { getOpenAIClient, getModelForAnalysisLevel, checkOpenAICredits } from './client.js';
import { loadPrompt, loadPromptWithVars } from './promptLoader.js';
import { trackOpenAIUsage } from '@/lib/telemetry/openai';
// Import des fonctions d'extraction depuis generateCv.js (multi-stratégies, antibot)
import { extractJobOfferFromUrl, extractJobOfferFromPdf, storeJobOffer } from './generateCv.js';

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

  // Fallback: schéma par défaut (contenu uniquement, métadonnées en DB)
  console.log('[createTemplateCv] Utilisation du schéma par défaut');
  const defaultSchema = {
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
    ]
  };

  return JSON.stringify(defaultSchema, null, 2);
}

// NOTE: extractTextFromPdf, extractJobOfferFromPdf et prepareJobOfferContent
// ont été supprimées - on utilise maintenant les fonctions importées de generateCv.js

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

    const startTime = Date.now();
    const response = await client.chat.completions.create(requestOptions, fetchOptions);
    const duration = Date.now() - startTime;

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptNoContent' }));
    }

    return {
      content: content.trim(),
      usage: response.usage,
      duration,
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
 * Formate le contenu structuré d'une offre d'emploi pour le prompt de création de CV modèle
 * @param {Object} extraction - Extraction structurée de l'offre
 * @param {string} source - URL ou nom de fichier source
 * @param {string} title - Titre du poste
 * @returns {string} - Texte formaté pour le prompt
 */
function formatJobOfferForTemplate(extraction, source, title) {
  const sections = [];

  sections.push(`Offre d'emploi extraite depuis: ${source}`);
  if (title) sections.push(`Titre: ${title}`);
  sections.push('');

  if (extraction.company) {
    sections.push(`🏢 ENTREPRISE: ${extraction.company}`);
  }

  if (extraction.contract) {
    sections.push(`📄 TYPE DE CONTRAT: ${extraction.contract}`);
  }

  if (extraction.experience) {
    const exp = extraction.experience;
    let expText = '';
    if (exp.min_years !== null || exp.max_years !== null) {
      if (exp.min_years !== null && exp.max_years !== null) {
        expText = `${exp.min_years}-${exp.max_years} ans`;
      } else if (exp.min_years !== null) {
        expText = `${exp.min_years}+ ans`;
      } else if (exp.max_years !== null) {
        expText = `jusqu'à ${exp.max_years} ans`;
      }
    }
    if (exp.level) {
      expText += expText ? ` (${exp.level})` : exp.level;
    }
    if (expText) {
      sections.push(`💼 EXPÉRIENCE REQUISE: ${expText}`);
    }
  }

  if (extraction.location) {
    const loc = extraction.location;
    const locParts = [];
    if (loc.city) locParts.push(loc.city);
    if (loc.country) locParts.push(loc.country);
    if (loc.remote) locParts.push(`(${loc.remote})`);
    if (locParts.length > 0) {
      sections.push(`📍 LOCALISATION: ${locParts.join(', ')}`);
    }
  }

  if (extraction.skills) {
    if (extraction.skills.required && extraction.skills.required.length > 0) {
      sections.push(`🎯 COMPÉTENCES TECHNIQUES REQUISES:\n${extraction.skills.required.map(s => `- ${s}`).join('\n')}`);
    }
    if (extraction.skills.nice_to_have && extraction.skills.nice_to_have.length > 0) {
      sections.push(`✨ COMPÉTENCES SOUHAITÉES:\n${extraction.skills.nice_to_have.map(s => `- ${s}`).join('\n')}`);
    }
  }

  if (extraction.responsibilities && extraction.responsibilities.length > 0) {
    sections.push(`📝 MISSIONS ET RESPONSABILITÉS:\n${extraction.responsibilities.map(r => `- ${r}`).join('\n')}`);
  }

  if (extraction.education) {
    const edu = extraction.education;
    const eduParts = [];
    if (edu.level) eduParts.push(edu.level);
    if (edu.field) eduParts.push(edu.field);
    if (eduParts.length > 0) {
      sections.push(`🎓 FORMATION: ${eduParts.join(' - ')}`);
    }
  }

  if (extraction.languages && extraction.languages.length > 0) {
    const langList = extraction.languages.map(l => {
      if (l.level) return `${l.language} (${l.level})`;
      return l.language;
    }).join(', ');
    sections.push(`🗣️ LANGUES: ${langList}`);
  }

  if (extraction.benefits && extraction.benefits.length > 0) {
    sections.push(`🎁 AVANTAGES:\n${extraction.benefits.map(b => `- ${b}`).join('\n')}`);
  }

  return sections.join('\n\n');
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
    throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.noJobOfferProvided' }));
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

  const generatedContents = [];

  // Créer un CV modèle par URL
  for (const link of links || []) {
    // Vérifier si annulé
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    try {
      // 1. Extraire l'offre d'emploi (extraction structurée)
      const { extraction, tokensUsed, model: extractModel, title } = await extractJobOfferFromUrl(link, userId);

      // 2. Stocker en base de données
      const storedOffer = await storeJobOffer(userId, 'url', link, extraction, extractModel, tokensUsed);

      // 3. Formater l'offre pour le prompt de génération
      const currentOfferContent = formatJobOfferForTemplate(extraction, link, title);

      console.log(`\n[createTemplateCv] Création de CV modèle pour : ${link}`);

      // 4. Générer le CV modèle
      const result = await callChatGPT(
        client,
        model,
        cvSchema,
        currentOfferContent,
        signal
      );

      if (!result.content) {
        throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptGenerationFailed' }));
      }

      // Contenu uniquement - métadonnées en DB (CvFile)
      const cvContent = normalizeJsonPayload(result.content);

      generatedContents.push({
        cvContent,
        jobOfferId: storedOffer.id,
        source: link,
        // Store tracking data for successful generation
        _trackingData: userId && result.usage ? {
          featureName: 'create_template_cv_url',
          usage: result.usage,
          duration: result.duration,
        } : null,
      });
    } catch (error) {
      if (error.name === 'AbortError' || signal?.aborted) {
        throw new Error('Task cancelled');
      }
      console.error(`[createTemplateCv] Erreur extraction ${link}:`, error);
      throw error;
    }
  }

  // Créer un CV modèle par PDF
  for (const entry of files || []) {
    if (!entry.path) continue;

    // Vérifier si annulé
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    try {
      await fs.access(entry.path);

      // 1. Extraire l'offre d'emploi (extraction structurée)
      const { extraction, tokensUsed, model: extractModel, name, title } = await extractJobOfferFromPdf(entry.path, userId);

      // 2. Stocker en base de données
      const storedOffer = await storeJobOffer(userId, 'pdf', name, extraction, extractModel, tokensUsed);

      // 3. Formater l'offre pour le prompt de génération
      const currentOfferContent = formatJobOfferForTemplate(extraction, name, title);

      console.log(`\n[createTemplateCv] Création de CV modèle pour : ${name}`);

      // 4. Générer le CV modèle
      const result = await callChatGPT(
        client,
        model,
        cvSchema,
        currentOfferContent,
        signal
      );

      if (!result.content) {
        throw new Error(JSON.stringify({ translationKey: 'errors.api.openai.gptGenerationFailed' }));
      }

      // Contenu uniquement - métadonnées en DB (CvFile)
      const cvContent = normalizeJsonPayload(result.content);

      generatedContents.push({
        cvContent,
        jobOfferId: storedOffer.id,
        source: name,
        // Store tracking data for successful generation
        _trackingData: userId && result.usage ? {
          featureName: 'create_template_cv_pdf',
          usage: result.usage,
          duration: result.duration,
        } : null,
      });
    } catch (error) {
      if (error.name === 'AbortError' || signal?.aborted) {
        throw new Error('Task cancelled');
      }
      if (error.code === 'ENOENT') {
        console.warn(`[createTemplateCv] Fichier introuvable: ${entry.path}`);
        continue;
      }
      throw error;
    }
  }

  // Track OpenAI usage only for successful generations
  if (userId) {
    for (const content of generatedContents) {
      if (content._trackingData) {
        try {
          const usage = content._trackingData.usage;
          await trackOpenAIUsage({
            userId,
            featureName: content._trackingData.featureName,
            model,
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            cachedTokens: usage.prompt_tokens_details?.cached_tokens || 0,
            duration: content._trackingData.duration,
            analysisLevel,
          });
        } catch (trackError) {
          console.error('[createTemplateCv] Failed to track OpenAI usage:', trackError);
        }
        // Clean up tracking data before returning
        delete content._trackingData;
      }
    }
  }

  console.log(`[createTemplateCv] ${generatedContents.length} CV(s) modèle(s) créé(s)`);
  return generatedContents;
}

import { getOpenAIClient, getModelForAnalysisLevel } from './client.js';
import { promises as fs } from 'fs';
import path from 'path';

const VALIDATION_SYSTEM_PROMPT = `Tu es un assistant qui vérifie si une entrée utilisateur est du texte aléatoire/gibberish ou si ça ressemble à un vrai titre de poste.`;

const VALIDATION_USER_PROMPT = `L'utilisateur a saisi : "{jobTitle}"

Est-ce que c'est du gibberish/texte aléatoire OU est-ce que ça pourrait être un titre de poste ?

Réponds UNIQUEMENT par l'un de ces mots :
- "VALIDE" si ça pourrait être un titre de poste (même si tu ne connais pas exactement ce poste, même avec acronymes/abréviations)
- "INVALIDE" si c'est clairement du gibberish, des chiffres aléatoires, ou du texte sans sens

Exemples VALIDES (accepte tout ce qui ressemble à un titre professionnel) :
- Tout titre avec des mots professionnels reconnaissables
- Acronymes courants : CEO, CTO, CSM, VP, Lead, Manager, Engineer, Developer, etc.
- Termes techniques : GenAI, ML, DevOps, Cloud, Full-Stack, Data, etc.
- "CSM GenAI Solution", "VP Engineering", "Lead SRE", "Chef de projet IA"

Exemples INVALIDES (rejette seulement le gibberish évident) :
- "xyz", "asdfgh", "qwerty", "123", "aaaaaa", "test test test"

Sois TRES PERMISSIF : si ça contient au moins un mot qui ressemble à un terme professionnel, réponds VALIDE.`;

const GENERATION_SYSTEM_PROMPT = `ROLE:
Tu es un assistant expert en rédaction de CV et tu connais parfaitement les standards de formatage ATS des outils RH.
Tu crées des CV professionnels, clairs et optimisés pour les systèmes de recrutement automatisés.

CONTEXT:
Tu dois créer un CV exemple/modèle professionnel à partir d'un titre de poste fourni.
Ce CV doit être cohérent avec le titre de poste et servir de modèle que l'utilisateur pourra personnaliser ensuite.`;

const GENERATION_USER_PROMPT = `TACHES:
- Analyse le titre de poste fourni : "{jobTitle}"

- Crée un CV exemple professionnel qui correspond à ce poste avec :
  * Un profil fictif mais réaliste et professionnel
  * Des expériences cohérentes avec le niveau requis (junior, confirmé, senior)
  * Les compétences techniques et soft skills appropriées pour ce poste
  * Une éducation appropriée pour le poste
  * Un résumé/summary percutant adapté au poste

- IMPORTANT : Le CV doit être rédigé en {language} (langue de l'interface utilisateur)

Instructions détaillées pour remplir le template JSON :

1. HEADER :
   - full_name : nom et prénom complets (fictifs mais réalistes)
   - current_title : le titre professionnel fourni : "{jobTitle}"
   - contact.email : adresse email professionnelle
   - contact.phone : numéro de téléphone avec code pays (ex: +33...)
   - contact.location : ville, région, code pays
   - contact.links : liens professionnels (LinkedIn, GitHub, portfolio, etc.)

2. SUMMARY :
   - description : résumé professionnel percutant adapté au poste
   - domains : domaines d'expertise correspondant au poste (tableau de strings)

3. SKILLS :
   - hard_skills : compétences techniques avec niveau (name, proficiency). Détermine le niveau en fonction de l'expérience
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

8. EXTRAS : informations complémentaires (certifications, hobbies) si pertinent

IMPORTANT :
- Remplis le champ 'generated_at' avec la date actuelle au format YYYY-MM-DD
- Ne modifie pas les champs 'order_hint' et 'section_titles'
- Le CV doit être réaliste et professionnel, pas générique
- Adapte le niveau d'expérience (junior: 1-3 ans, confirmé: 3-7 ans, senior: 7+ ans)
- Fournis UNIQUEMENT le JSON, sans texte avant ou après
`;

async function getCvSchema() {
  const projectRoot = process.cwd();
  const templatePath = path.join(projectRoot, 'data', 'template.json');

  try {
    const content = await fs.readFile(templatePath, 'utf-8');
    console.log(`[generateCvFromJobTitle] Utilisation du template : ${templatePath}`);
    return content;
  } catch (error) {
    console.warn(`[generateCvFromJobTitle] Impossible de lire template.json: ${error.message}`);
  }

  // Fallback: schéma par défaut
  console.log('[generateCvFromJobTitle] Utilisation du schéma par défaut');
  const defaultSchema = {
    generated_at: "",
    header: {
      full_name: "",
      current_title: "",
      contact: {
        email: "",
        phone: "",
        location: { city: "", region: "", country_code: "" },
        links: []
      }
    },
    summary: {
      description: "",
      domains: []
    },
    skills: {
      hard_skills: [],
      soft_skills: [],
      tools: [],
      methodologies: []
    },
    experience: [],
    education: [],
    languages: [],
    projects: [],
    extras: []
  };
  return JSON.stringify(defaultSchema, null, 2);
}

/**
 * Valide si un titre de poste est réel et professionnel
 * @param {string} jobTitle - Le titre de poste à valider
 * @param {string} model - Le modèle GPT à utiliser
 * @returns {Promise<{isValid: boolean, reason?: string}>}
 */
async function validateJobTitle(jobTitle, model) {
  console.log('[generateCvFromJobTitle] Validation du titre de poste:', jobTitle);

  const client = getOpenAIClient();
  const systemPrompt = process.env.GPT_JOB_VALIDATION_SYSTEM_PROMPT?.trim() || VALIDATION_SYSTEM_PROMPT;
  const userPrompt = (process.env.GPT_JOB_VALIDATION_USER_PROMPT?.trim() || VALIDATION_USER_PROMPT)
    .replace(/\{jobTitle\}/g, jobTitle);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 50,
    });

    const answer = response.choices[0]?.message?.content?.trim().toUpperCase() || '';
    console.log('[generateCvFromJobTitle] Réponse de validation brute:', answer);
    console.log('[generateCvFromJobTitle] Titre analysé:', jobTitle);

    // Plus permissif : accepte VALIDE ou si la réponse ne contient pas INVALIDE
    const containsValide = answer.includes('VALIDE');
    const containsInvalide = answer.includes('INVALIDE');

    // Si GPT dit VALIDE ou ne dit pas explicitement INVALIDE, on accepte
    const isValid = containsValide || (!containsInvalide && answer.length > 0);

    console.log('[generateCvFromJobTitle] containsValide:', containsValide, 'containsInvalide:', containsInvalide, 'isValid:', isValid);

    return {
      isValid,
      reason: isValid ? null : 'Le titre de poste ne semble pas être un poste professionnel valide'
    };
  } catch (error) {
    console.error('[generateCvFromJobTitle] Erreur lors de la validation:', error);
    throw new Error('Impossible de valider le titre de poste: ' + error.message);
  }
}

/**
 * Génère un CV modèle à partir d'un titre de poste
 * @param {Object} params
 * @param {string} params.jobTitle - Le titre de poste
 * @param {string} params.language - La langue du CV (français, anglais, etc.)
 * @param {string} params.analysisLevel - Le niveau d'analyse (rapid, medium, deep)
 * @param {string} params.requestedModel - Le modèle GPT à utiliser (optionnel)
 * @param {AbortSignal} params.signal - Signal pour annuler la tâche
 * @returns {Promise<string>} Le CV généré au format JSON
 */
export async function generateCvFromJobTitle({
  jobTitle,
  language = 'français',
  analysisLevel = 'medium',
  requestedModel = null,
  signal = null
}) {
  console.log('[generateCvFromJobTitle] Démarrage de la génération de CV pour:', jobTitle);

  if (!jobTitle || typeof jobTitle !== 'string' || !jobTitle.trim()) {
    throw new Error('Titre de poste manquant ou invalide');
  }

  const trimmedJobTitle = jobTitle.trim();
  const client = getOpenAIClient();

  // Force le modèle gpt-5-mini-2025-08-07 pour cette feature
  const model = 'gpt-5-mini-2025-08-07';

  console.log(`[generateCvFromJobTitle] Modèle GPT utilisé (forcé) : ${model}`);

  // Vérifier si annulé
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  // Étape 1 : Validation désactivée - on accepte tous les titres
  console.log('[generateCvFromJobTitle] Étape 1/2 : Validation du titre de poste (désactivée - tous les titres acceptés)');
  console.log('[generateCvFromJobTitle] ✓ Titre de poste accepté:', trimmedJobTitle);

  // Vérifier si annulé
  if (signal?.aborted) {
    throw new Error('Task cancelled');
  }

  // Étape 2 : Générer le CV
  console.log('[generateCvFromJobTitle] Étape 2/2 : Génération du CV...');
  const cvSchema = await getCvSchema();

  const systemPrompt = process.env.GPT_JOB_GENERATION_SYSTEM_PROMPT?.trim() || GENERATION_SYSTEM_PROMPT;
  const userPrompt = (process.env.GPT_JOB_GENERATION_USER_PROMPT?.trim() || GENERATION_USER_PROMPT)
    .replace(/\{jobTitle\}/g, trimmedJobTitle)
    .replace(/\{language\}/g, language);

  const fullUserPrompt = `${userPrompt}

Voici le schéma JSON à suivre STRICTEMENT :

${cvSchema}

Génère maintenant le CV en JSON en suivant exactement cette structure.`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullUserPrompt }
      ],
      response_format: { type: 'json_object' },
    });

    // Vérifier si annulé
    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const rawContent = response.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error('Aucune réponse de GPT');
    }

    // Valider que c'est du JSON valide
    let parsedCV;
    try {
      parsedCV = JSON.parse(rawContent);
    } catch (parseError) {
      console.error('[generateCvFromJobTitle] Erreur de parsing JSON:', parseError);
      throw new Error('La réponse de GPT n\'est pas un JSON valide');
    }

    // Vérifier que le CV contient les champs essentiels
    if (!parsedCV.header?.full_name || !parsedCV.header?.current_title) {
      throw new Error('Le CV généré est incomplet (nom ou titre manquant)');
    }

    console.log('[generateCvFromJobTitle] ✓ CV généré avec succès');
    return JSON.stringify(parsedCV, null, 2);
  } catch (error) {
    console.error('[generateCvFromJobTitle] Erreur lors de la génération:', error);

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    throw new Error('Impossible de générer le CV: ' + error.message);
  }
}

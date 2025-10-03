import { promises as fs } from 'fs';
import path from 'path';
import PDFParser from 'pdf2json';
import { getOpenAIClient, getModelForAnalysisLevel } from './client.js';

const OPTIMIZED_SYSTEM_PROMPT = `ROLE:
Tu es un expert en recrutement et optimisation de CV avec 15 ans d'expérience.
Tu maîtrises parfaitement les systèmes ATS et l'adaptation de CV aux offres d'emploi.

MISSION:
1. Adapter le CV de référence (JSON) à l'offre d'emploi fournie
2. Calculer le score de correspondance (0-100)
3. Identifier les points d'amélioration prioritaires`;

const OPTIMIZED_USER_PROMPT = `ANALYSE L'OFFRE ET ADAPTE LE CV:

1️⃣ ANALYSE RAPIDE DE L'OFFRE:
- Identifie les compétences CRITIQUES (must-have)
- Identifie les compétences BONUS (nice-to-have)
- Note le niveau d'expérience requis

2️⃣ ADAPTATION DU CV:
À partir du CV de référence ci-dessous, crée un CV optimisé qui:
- Met en avant les compétences demandées dans l'offre
- Adapte le summary pour correspondre au poste
- Réorganise les expériences pour valoriser les plus pertinentes
- Ajuste le titre professionnel (current_title) pour matcher l'offre
- N'invente JAMAIS d'expériences ou compétences absentes du CV original

3️⃣ CALCUL DU SCORE DE MATCH (0-100):
Évalue objectivement selon:
- Compétences techniques: /35 pts
- Expérience pertinente: /30 pts
- Formation: /20 pts
- Soft skills & langues: /15 pts

4️⃣ SUGGESTIONS D'AMÉLIORATION:
Liste 3-5 actions concrètes pour améliorer le score, par ordre de priorité.

FORMAT DE RÉPONSE OBLIGATOIRE (JSON):
{
  "adapted_cv": {
    // Le CV adapté complet au format du CV de référence
  },
  "match_score": 75, // Score sur 100
  "score_breakdown": {
    "technical_skills": 28,
    "experience": 22,
    "education": 15,
    "soft_skills": 10
  },
  "improvement_suggestions": [
    {
      "priority": "high",
      "suggestion": "Ajouter la certification AWS mentionnée comme un plus",
      "impact": "+8 points"
    },
    {
      "priority": "medium",
      "suggestion": "Détailler l'expérience en gestion d'équipe",
      "impact": "+5 points"
    }
  ],
  "missing_critical_skills": ["Kubernetes", "TypeScript"],
  "matching_skills": ["React", "Node.js", "Docker"]
}

⚠️ IMPORTANT: Réponds UNIQUEMENT avec le JSON, sans texte additionnel.`;

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

function buildOptimizedPrompt(mainCvContent, links, extractedFiles) {
  const sections = [OPTIMIZED_USER_PROMPT];

  // Ajouter le CV de référence
  sections.push('\n--- CV DE RÉFÉRENCE (à adapter) ---');
  sections.push(mainCvContent);
  sections.push('--- FIN DU CV ---\n');

  // Ajouter les liens d'offres
  if (links?.length > 0) {
    sections.push('--- OFFRES D\'EMPLOI (liens) ---');
    links.forEach(link => sections.push(`- ${link}`));
    sections.push('');
  }

  // Ajouter les PDFs extraits
  if (extractedFiles?.length > 0) {
    sections.push('--- OFFRES D\'EMPLOI (PDF) ---');
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

  // Extraire le contenu des PDFs si présents
  const extractedFiles = [];
  for (const entry of files || []) {
    if (!entry.path) continue;

    try {
      await fs.access(entry.path);
      const extracted = await extractTextFromPdf(entry.path);
      extractedFiles.push({ extracted });
    } catch (error) {
      console.warn(`[generateCvWithScore] Impossible de lire ${entry.path}:`, error);
    }
  }

  // Créer les runs (un par source)
  const runs = [];

  // Un run par lien
  for (const link of links || []) {
    runs.push({
      links: [link],
      extractedFiles: [],
      label: link
    });
  }

  // Un run par PDF
  for (const extracted of extractedFiles) {
    runs.push({
      links: [],
      extractedFiles: [extracted],
      label: extracted.extracted.name
    });
  }

  // Si aucune source, génération basique
  if (runs.length === 0) {
    runs.push({
      links: [],
      extractedFiles: [],
      label: referenceFile
    });
  }

  const results = [];

  // Exécuter chaque run
  for (const run of runs) {
    const userPrompt = buildOptimizedPrompt(
      mainCvContent,
      run.links,
      run.extractedFiles
    );

    console.log(`[generateCvWithScore] Traitement: ${run.label}`);

    try {
      const requestOptions = {
        model,
        messages: [
          {
            role: 'system',
            content: process.env.GPT_OPTIMIZED_SYSTEM_PROMPT?.trim() || OPTIMIZED_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7, // Un peu de créativité pour l'adaptation
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

      results.push({
        cvContent: formattedCv,
        matchScore: Math.min(100, Math.max(0, result.match_score)),
        scoreBreakdown: result.score_breakdown || {},
        suggestions: result.improvement_suggestions || [],
        missingSkills: result.missing_critical_skills || [],
        matchingSkills: result.matching_skills || [],
        source: run.label
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
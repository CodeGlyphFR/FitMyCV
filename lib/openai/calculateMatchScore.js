import { getOpenAIClient } from './client.js';
import { getAiModelSetting } from '@/lib/settings/aiModels';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Configurer Puppeteer avec stealth mode
puppeteer.use(StealthPlugin());

/**
 * Extrait le contenu d'une offre d'emploi avec GPT + Puppeteer
 * @param {string} url - URL de l'offre d'emploi
 * @returns {Promise<string>} - Contenu formaté de l'offre
 */
async function extractJobOfferWithGPT(url) {
  console.log(`[extractJobOfferWithGPT] Extraction de l'offre depuis: ${url}`);

  const client = getOpenAIClient();

  try {
    // Fetch le HTML avec Puppeteer + Stealth pour contourner Indeed
    console.log('[extractJobOfferWithGPT] Lancement de Puppeteer en mode stealth...');
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

      console.log(`[extractJobOfferWithGPT] Navigation vers ${url}...`);
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Attendre que le contenu se charge (Indeed charge le contenu dynamiquement)
      console.log('[extractJobOfferWithGPT] Attente du chargement du contenu...');
      try {
        await page.waitForSelector('body', { timeout: 5000 });
      } catch (e) {
        console.log('[extractJobOfferWithGPT] Timeout waitForSelector, on continue...');
      }
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Récupérer le HTML complet
      html = await page.content();
      console.log(`[extractJobOfferWithGPT] ✅ HTML récupéré avec Puppeteer (${html.length} caractères)`);

      await browser.close();
    } catch (error) {
      await browser.close().catch(() => {});
      throw error;
    }

    // Trouver le début du contenu de l'offre (chercher le titre avec H/F ou h/f)
    console.log(`[extractJobOfferWithGPT] Recherche du titre de l'offre dans le HTML...`);

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
        console.log(`[extractJobOfferWithGPT] ✅ Titre trouvé avec pattern ${foundPattern} à l'index ${startIndex}`);
        break;
      }
    }

    // Si on a trouvé le titre, ne garder que le HTML à partir de ce point
    let optimizedHtml = html;
    if (startIndex > 0 && startIndex < html.length - 1000) {
      // Reculer un peu pour capturer le contexte (500 caractères avant)
      const contextStart = Math.max(0, startIndex - 500);
      optimizedHtml = html.substring(contextStart);
      console.log(`[extractJobOfferWithGPT] HTML optimisé: ${html.length} → ${optimizedHtml.length} caractères (réduction de ${Math.round((1 - optimizedHtml.length / html.length) * 100)}%)`);
    } else {
      console.log(`[extractJobOfferWithGPT] ⚠️ Titre non trouvé, envoi du HTML complet`);
    }

    console.log(`[extractJobOfferWithGPT] HTML final à envoyer à GPT: ${optimizedHtml.length} caractères`);

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

    const response = await client.chat.completions.create({
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
      temperature: 0.1,
      max_tokens: 4000,
    });

    const text = response.choices?.[0]?.message?.content;

    if (!text || text.trim().length === 0) {
      throw new Error('GPT n\'a retourné aucun contenu');
    }

    console.log(`[extractJobOfferWithGPT] ✅ Contenu extrait par GPT (${text.length} caractères)`);
    console.log('[extractJobOfferWithGPT] === RÉPONSE GPT COMPLÈTE ===');
    console.log(text);
    console.log('[extractJobOfferWithGPT] === FIN RÉPONSE GPT ===');

    // Écrire la réponse dans un fichier pour debug
    try {
      const fs = require('fs');
      const debugFilePath = '/tmp/gpt-response-debug.txt';
      const debugContent = `=== DEBUG EXTRACTION GPT ===
Date: ${new Date().toISOString()}
URL: ${url}

=== HTML ENVOYÉ COMPLET (${optimizedHtml.length} caractères) ===
${optimizedHtml}

=== RÉPONSE GPT COMPLÈTE ===
${text}

=== FIN DEBUG ===
`;
      fs.writeFileSync(debugFilePath, debugContent, 'utf8');
      console.log(`[extractJobOfferWithGPT] ✅ Debug écrit dans ${debugFilePath} (${debugContent.length} caractères)`);
    } catch (e) {
      console.error('[extractJobOfferWithGPT] ❌ Erreur écriture debug:', e.message);
    }

    // Extraire le titre si présent dans le texte
    const jobTitleMatch = text.match(/📋 TITRE DU POSTE:\s*\n(.+)/i);
    const jobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'Offre d\'emploi';

    return `📄 Offre: ${jobTitle}\n🔗 URL: ${url}\n\n${text.trim()}`;

  } catch (error) {
    console.error(`[extractJobOfferWithGPT] ❌ Erreur GPT:`, error.message);
    throw new Error(`Impossible d'extraire l'offre d'emploi depuis ${url}: ${error.message}`);
  }
}

const MATCH_SCORE_SYSTEM_PROMPT = `Tu es Marie Dupont, Directrice du Recrutement chez LinkedIn avec 18 ans d'expérience en talent acquisition.
Tu es également experte certifiée en systèmes ATS (Taleo, Greenhouse, Workday) et en parsing automatisé de CV.
Tu as analysé plus de 50 000 CV et tu connais parfaitement les subtilités du matching candidat/poste.
Ta réputation repose sur ta capacité à identifier précisément l'adéquation entre un profil et un poste, sans biais ni complaisance.`;

const MATCH_SCORE_USER_PROMPT = `╔══════════════════════════════════════════════════════════════╗
║           ANALYSE DE MATCH CV / OFFRE D'EMPLOI               ║
║                  (Mode Expert ATS + Recruteur)               ║
╚══════════════════════════════════════════════════════════════╝

🎯 MISSION : Effectue une analyse ULTRA-DÉTAILLÉE du match entre ce CV et l'offre d'emploi.

Lien de l'offre d'emploi à analyser :
- {jobOfferUrl}

⚠️ CONSIGNES CRITIQUES :
1. Analyse le contenu COMPLET de l'offre d'emploi
2. Lis CHAQUE mot de l'offre et du CV
3. Sois RIGOUREUX et OBJECTIF - ne surestime JAMAIS
4. Utilise les critères de scoring ATS les plus stricts
5. Pénalise SÉVÈREMENT chaque compétence critique manquante

═══════════════════════════════════════════════════════════════

📊 GRILLE D'ANALYSE DÉTAILLÉE (100 POINTS MAX) :

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 1. COMPÉTENCES TECHNIQUES - 35 POINTS

📌 A. Technologies & Langages (20 pts) - SCORING PROPORTIONNEL :
   • Liste TOUTES les technologies/langages requis dans l'offre
   • Classe-les par importance : CRITIQUES vs SECONDAIRES
   • Pour les compétences CRITIQUES (70% du score) :
     ➜ Présente avec niveau expert/avancé : 100% des points alloués
     ➜ Présente avec niveau confirmé/intermédiaire : 80% des points
     ➜ Présente avec niveau débutant : 50% des points
     ➜ Absente : 0% des points (pas de pénalité négative)
   • Pour les compétences SECONDAIRES (30% du score) :
     ➜ Même système proportionnel
   • FORMULE : (somme des % obtenus / nombre de compétences) × 20
   • Analyse la COHÉRENCE : utilise-t-il ces techs dans ses projets ?

📌 B. Outils & Frameworks (10 pts) - SCORING PROPORTIONNEL :
   • Liste TOUS les outils/frameworks requis
   • Scoring : (nombre présents / nombre requis) × 10
   • BONUS : +1 pt si utilisation concrète démontrée dans les expériences
   • PAS de pénalité si outil absent, juste 0 pt pour cet outil

📌 C. Certifications (5 pts) - BONUS SEULEMENT :
   • Si certifications requises ET présentes : 5 pts
   • Si certifications requises mais absentes : 0 pt (pas de pénalité)
   • Si certifications présentes mais non requises : +2 pts bonus
   • Vérifie la validité (non expirées)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💼 2. EXPÉRIENCE PROFESSIONNELLE - 30 POINTS

📌 A. Années d'Expérience (8 pts) :
   • Compte les années d'expérience PERTINENTES dans le domaine
   • Compare avec le requis de l'offre (ex: "5+ ans", "3-7 ans")
   • Scoring progressif :
     ➜ Expérience supérieure ou égale au requis : 8 pts
     ➜ 1 an de moins : 7 pts
     ➜ 2 ans de moins : 5 pts
     ➜ 3+ ans de moins : 3 pts
     ➜ Beaucoup plus d'expérience mais pertinente : 7 pts
   • PAS de pénalité pour surqualification si cohérent

📌 B. Pertinence des Postes (12 pts) :
   • Analyse les 2-3 postes les plus récents :
     ➜ Même fonction/intitulé que le poste visé : 12 pts
     ➜ Fonction très similaire : 10 pts
     ➜ Fonction adjacente avec compétences transférables : 7 pts
     ➜ Fonction différente mais certaines compétences communes : 4 pts
     ➜ Aucun lien avec le poste : 0 pt
   • BONUS : +2 pts si progression de carrière cohérente (junior → senior)

📌 C. Responsabilités & Réalisations (8 pts) :
   • Compare les responsabilités CV avec celles de l'offre
   • Scoring :
     ➜ Responsabilités très similaires + résultats quantifiés : 8 pts
     ➜ Responsabilités similaires + quelques résultats : 6 pts
     ➜ Responsabilités partiellement similaires : 4 pts
     ➜ Responsabilités différentes : 2 pts
     ➜ CV très vague sans résultats : 0 pt
   • VALORISE les impacts business concrets

📌 D. Secteur d'Activité (2 pts) :
   • Même secteur : 2 pts
   • Secteur adjacent ou compétences transférables : 1 pt
   • Secteur différent : 0 pt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎓 3. FORMATION & QUALIFICATIONS - 20 POINTS

📌 A. Niveau d'Études (12 pts) :
   • Identifie le niveau REQUIS dans l'offre (Bac+2, Bac+3, Bac+5, PhD)
   • Scoring progressif :
     ➜ Niveau supérieur au requis : 12 pts
     ➜ Niveau exactement requis : 11 pts
     ➜ Niveau inférieur de 1 (mais expérience compense) : 8 pts
     ➜ Niveau inférieur de 1 (expérience ne compense pas) : 5 pts
     ➜ Niveau inférieur de 2+ : 3 pts
     ➜ Pas de diplôme mais expérience solide : 7 pts

📌 B. Domaine d'Études (6 pts) :
   • Domaine EXACTEMENT pertinent : 6 pts
   • Domaine proche/adjacent : 4 pts
   • Domaine différent mais reconversion démontrée : 3 pts
   • Domaine sans lien mais compétences acquises par expérience : 2 pts
   • Domaine sans lien : 0 pt

📌 C. Formation Continue (2 pts) :
   • Bootcamps, MOOCs, certifications récentes (< 3 ans) : 2 pts
   • Formations pertinentes mais anciennes : 1 pt
   • VALORISE l'apprentissage continu et l'adaptation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧠 4. SOFT SKILLS & CULTURE FIT - 15 POINTS

📌 A. Soft Skills Requises (8 pts) - PROPORTIONNEL :
   • Liste les soft skills mentionnées dans l'offre
     (ex: leadership, communication, autonomie, esprit d'équipe)
   • Scoring :
     ➜ Toutes les soft skills démontrées avec preuves : 8 pts
     ➜ 75%+ des soft skills démontrées : 6 pts
     ➜ 50%+ des soft skills mentionnées/suggérées : 4 pts
     ➜ 25%+ des soft skills suggérées : 2 pts
     ➜ Aucune soft skill identifiable : 0 pt
   • VALORISE les preuves concrètes (management, projets transverses)

📌 B. Langues (4 pts) - PROPORTIONNEL :
   • Identifie les langues REQUISES dans l'offre
   • Scoring par langue :
     ➜ Niveau C1/C2 ou natif : 100% des points
     ➜ Niveau B2 (courant) : 80% des points
     ➜ Niveau B1 (intermédiaire) : 50% des points
     ➜ Niveau inférieur ou absente : 0% des points
   • FORMULE : (somme des % / nombre de langues requises) × 4
   • Si aucune langue requise : 4 pts par défaut

📌 C. Méthodologies & Culture (3 pts) :
   • Agile/Scrum/méthodologies mentionnées : 2 pts si présent, 0 sinon
   • Culture/environnement compatible : 1 pt
   • Remote/Hybride si pertinent : bonus inclus

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 CRITÈRES ATS (Applicant Tracking System) - BONUS UNIQUEMENT :

✓ BONUS (jusqu'à +10 pts) :
   • Mots-clés EXACTS de l'offre présents dans le CV : +3 pts
   • Haute densité de termes pertinents : +2 pts
   • Verbes d'action et résultats quantifiés : +2 pts
   • Structure claire et bien organisée : +2 pts
   • Portfolio/projets GitHub/liens démo : +1 pt

⚠️ SIGNAUX D'ALERTE (réduction de score uniquement si très prononcés) :
   • Trous de carrière > 2 ans non expliqués : -5 pts maximum
   • Job hopping excessif (< 6 mois par poste, 3+ fois) : -3 pts maximum
   • PAS de pénalité pour changement de carrière ou reconversion

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📏 ÉCHELLE DE SCORING FINALE - RÉALISTE ET ÉQUILIBRÉE :

90-100 ★★★★★ EXCELLENT - Candidat IDÉAL
           → Profil quasi-parfait, toutes compétences clés maîtrisées
           → Expérience très pertinente et démontrée

80-89  ★★★★☆ TRÈS BON - Candidat HAUTEMENT QUALIFIÉ
           → Compétences principales solides, quelques gaps mineurs
           → Expérience pertinente et résultats démontrés

65-79  ★★★☆☆ BON - Candidat QUALIFIÉ
           → Compétences de base présentes, formation adéquate
           → Expérience pertinente avec quelques écarts acceptables

50-64  ★★☆☆☆ CORRECT - Candidat ACCEPTABLE
           → Certaines compétences importantes manquantes
           → Expérience partiellement transférable

30-49  ★☆☆☆☆ FAIBLE - Candidat SOUS-QUALIFIÉ
           → Gaps significatifs sur compétences ou expérience
           → Nécessiterait formation importante

0-29   ☆☆☆☆☆ INADÉQUAT - PAS de match
           → Profil ne correspond pas au poste

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ PRINCIPES DE SCORING :

1. 📊 Utilise TOUT le spectre 0-100, pas seulement 40-70
2. ✅ Score = somme des points obtenus dans chaque catégorie
3. 🎯 Un bon candidat avec 80% des compétences doit obtenir 75-85 pts
4. 💡 VALORISE l'expérience concrète et les résultats mesurables
5. 🔢 Arrondis le score final à l'entier le plus proche
6. ⚖️ Sois OBJECTIF mais pas excessivement sévère
7. 🌟 Un score de 85+ est atteignable pour un très bon profil
8. 📈 Un score de 70+ indique un candidat qualifié à considérer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 CV DU CANDIDAT (format JSON structuré) :

{cvContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 MÉTHODE D'ANALYSE :

1. Lis l'offre d'emploi et identifie les critères requis
2. Évalue chaque section selon la grille ci-dessus
3. Additionne les points obtenus (max 100 + bonus ATS)
4. Vérifie la cohérence du score avec le profil global
5. Ajuste si nécessaire pour refléter la réalité du match

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📤 FORMAT DE RÉPONSE EXIGÉ :

Réponds UNIQUEMENT avec un nombre entier entre 0 et 100.
PAS d'explication, PAS de texte, PAS de formatage.
JUSTE LE NOMBRE.

Exemple de réponse valide : 73
Exemple de réponse INVALIDE : "Le score est 73" ❌
Exemple de réponse INVALIDE : "73/100" ❌
Exemple de réponse INVALIDE : "Score: 73" ❌

╔══════════════════════════════════════════════════════════════╗
║  COMMENCE TON ANALYSE MAINTENANT - SOIS RIGOUREUX ET JUSTE  ║
╚══════════════════════════════════════════════════════════════╝`;

/**
 * Calcule le score de match entre un CV et une offre d'emploi
 * @param {Object} params
 * @param {string} params.cvContent - Le contenu du CV au format JSON stringifié
 * @param {string} params.jobOfferUrl - L'URL de l'offre d'emploi
 * @param {AbortSignal} params.signal - Signal pour annuler la requête
 * @returns {Promise<number>} - Le score de match (0-100)
 */
export async function calculateMatchScore({
  cvContent,
  jobOfferUrl,
  cvFile = null, // Optionnel: objet CvFile depuis la DB pour récupérer extractedJobOffer
  signal = null
}) {
  console.log('[calculateMatchScore] Démarrage du calcul de score de match');

  if (!cvContent || !jobOfferUrl) {
    throw new Error('CV content and job offer URL are required');
  }

  const client = getOpenAIClient();
  const model = 'o3-mini'; // Modèle de raisonnement avancé

  console.log(`[calculateMatchScore] Modèle utilisé : ${model} (raisonnement avancé)`);
  console.log(`[calculateMatchScore] URL de l'offre : ${jobOfferUrl}`);

  // Parser et formater le CV JSON de manière lisible
  let cvData;
  try {
    cvData = JSON.parse(cvContent);
  } catch (error) {
    console.error('[calculateMatchScore] Erreur lors du parsing du CV JSON:', error);
    throw new Error('Invalid CV JSON format');
  }

  // Créer une représentation textuelle structurée du CV
  const cvSummary = JSON.stringify(cvData, null, 2);

  // Limiter la taille si nécessaire
  let finalCvContent = cvSummary;
  if (finalCvContent.length > 4000) {
    finalCvContent = finalCvContent.substring(0, 4000) + '\n... (contenu tronqué)';
  }

  console.log(`[calculateMatchScore] Taille du CV formaté: ${finalCvContent.length} caractères`);

  // Récupérer le contenu de l'offre (depuis cache DB si disponible, sinon extraction Claude)
  let cleanedJobOffer;

  if (cvFile?.extractedJobOffer && cvFile.sourceValue === jobOfferUrl) {
    console.log('[calculateMatchScore] ✅ Utilisation de l\'extraction en cache depuis la DB');
    cleanedJobOffer = cvFile.extractedJobOffer;
  } else {
    console.log('[calculateMatchScore] Extraction de l\'offre avec Claude (pas de cache disponible)...');
    cleanedJobOffer = await extractJobOfferWithGPT(jobOfferUrl);
  }

  // o3-mini préfère un seul user message combiné
  const systemPrompt = process.env.GPT_MATCH_SCORE_SYSTEM_PROMPT?.trim() || MATCH_SCORE_SYSTEM_PROMPT;
  const baseUserPrompt = process.env.GPT_MATCH_SCORE_USER_PROMPT?.trim() || MATCH_SCORE_USER_PROMPT;

  const combinedPrompt = systemPrompt + '\n\n' + baseUserPrompt
    .replace(/\{jobOfferUrl\}/g, cleanedJobOffer)
    .replace(/\{cvContent\}/g, finalCvContent);

  try {
    const requestOptions = {
      model,
      messages: [
        {
          role: 'user',
          content: combinedPrompt
        }
      ],
      // Note: o3-mini ne nécessite pas de max_tokens
    };

    console.log('[calculateMatchScore] Envoi de la requête à GPT...');

    const fetchOptions = signal ? { signal } : {};
    const response = await client.chat.completions.create(requestOptions, fetchOptions);

    console.log('[calculateMatchScore] Réponse reçue de GPT');

    if (signal?.aborted) {
      throw new Error('Task cancelled');
    }

    const content = response.choices?.[0]?.message?.content;
    console.log('[calculateMatchScore] Contenu de la réponse GPT:', content);

    if (!content) {
      console.error('[calculateMatchScore] Pas de contenu dans la réponse.');
      throw new Error('No response from GPT');
    }

    // Extraire le nombre de la réponse
    const scoreMatch = content.trim().match(/\d+/);
    if (!scoreMatch) {
      console.error('[calculateMatchScore] Format de score invalide. Réponse complète:', content);
      throw new Error(`Invalid score format from GPT. Response: ${content.substring(0, 100)}`);
    }

    const score = parseInt(scoreMatch[0], 10);
    if (isNaN(score) || score < 0 || score > 100) {
      console.error('[calculateMatchScore] Score hors limites:', score);
      throw new Error(`Score out of range (0-100): ${score}`);
    }

    console.log(`[calculateMatchScore] Score calculé : ${score}/100`);
    return score;
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[calculateMatchScore] Erreur lors de l\'appel GPT:', error);
    console.error('[calculateMatchScore] Message d\'erreur:', error.message);
    if (error.response) {
      console.error('[calculateMatchScore] Réponse d\'erreur:', JSON.stringify(error.response));
    }
    throw error;
  }
}

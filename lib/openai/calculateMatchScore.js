import { getOpenAIClient } from './client.js';

const MATCH_SCORE_SYSTEM_PROMPT = `Tu es Marie Dupont, Directrice du Recrutement chez LinkedIn avec 18 ans d'expérience en talent acquisition.
Tu es également experte certifiée en systèmes ATS (Taleo, Greenhouse, Workday) et en parsing automatisé de CV.
Tu as analysé plus de 50 000 CV et tu connais parfaitement les subtilités du matching candidat/poste.
Ta réputation repose sur ta capacité à identifier précisément l'adéquation entre un profil et un poste, sans biais ni complaisance.`;

const MATCH_SCORE_USER_PROMPT = `╔══════════════════════════════════════════════════════════════╗
║           ANALYSE DE MATCH CV / OFFRE D'EMPLOI               ║
║                  (Mode Expert ATS + Recruteur)               ║
╚══════════════════════════════════════════════════════════════╝

🎯 MISSION : Effectue une analyse ULTRA-DÉTAILLÉE du match entre ce CV et l'offre d'emploi.

📋 URL DE L'OFFRE D'EMPLOI : {jobOfferUrl}

⚠️ CONSIGNES CRITIQUES :
1. Va chercher le contenu COMPLET de l'offre d'emploi au lien ci-dessus
2. Lis CHAQUE mot de l'offre et du CV
3. Sois RIGOUREUX et OBJECTIF - ne surestime JAMAIS
4. Utilise les critères de scoring ATS les plus stricts
5. Pénalise SÉVÈREMENT chaque compétence critique manquante

═══════════════════════════════════════════════════════════════

📊 GRILLE D'ANALYSE DÉTAILLÉE (100 POINTS MAX) :

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 1. COMPÉTENCES TECHNIQUES - 40 POINTS (scoring strict)

📌 A. Technologies & Langages (20 pts) :
   • Fais une liste EXHAUSTIVE de TOUTES les technologies/langages requis dans l'offre
   • Pour CHAQUE technologie requise :
     ➜ Présente dans le CV avec niveau expert/confirmé : +2 pts
     ➜ Présente dans le CV avec niveau intermédiaire : +1 pt
     ➜ Présente mais niveau débutant : +0.5 pt
     ➜ ABSENTE alors qu'elle est CRITIQUE : -3 pts (pénalité lourde)
     ➜ ABSENTE mais secondaire : -1 pt
   • Vérifie les VERSIONS spécifiques si mentionnées (ex: Python 3.x, React 18+)
   • Analyse la COHÉRENCE : utilise-t-il vraiment ces techs dans ses projets ?

📌 B. Outils & Frameworks (10 pts) :
   • Liste TOUS les outils/frameworks requis (IDE, CI/CD, cloud, etc.)
   • Matching exact du nom : AWS = AWS, pas "cloud"
   • Vérifie l'utilisation CONCRÈTE dans les expériences passées
   • Pénalise si outil critique absent

📌 C. Certifications & Qualifications (10 pts) :
   • Certifications professionnelles requises (AWS, Azure, PMP, etc.)
   • Certifications présentes mais non requises : bonus mineur (+0.5)
   • Certification requise absente : -5 pts (très pénalisant)
   • Vérifie si certifications sont VALIDES (non expirées)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💼 2. EXPÉRIENCE PROFESSIONNELLE - 30 POINTS (analyse fine)

📌 A. Années d'Expérience (8 pts) :
   • Compte PRÉCISÉMENT les années d'expérience du CV
   • Compare avec le requis de l'offre (ex: "5+ ans", "3-7 ans")
   • Scoring :
     ➜ Correspond exactement : 8 pts
     ➜ 1-2 ans de moins : 5 pts
     ➜ 3+ ans de moins : 2 pts (sous-qualifié)
     ➜ Beaucoup plus d'expérience : 6 pts (risque de surqualification)

📌 B. Pertinence des Postes (10 pts) :
   • Analyse CHAQUE poste précédent :
     ➜ Même intitulé/fonction que le poste visé : +4 pts
     ➜ Fonction similaire/adjacente : +2 pts
     ➜ Fonction différente mais compétences transférables : +1 pt
     ➜ Aucun lien avec le poste : 0 pt
   • Vérifie la PROGRESSION : junior → mid → senior ?
   • Pénalise les changements de domaine trop fréquents

📌 C. Responsabilités & Réalisations (8 pts) :
   • Compare les RESPONSABILITÉS listées dans le CV avec celles de l'offre
   • Cherche des RÉSULTATS QUANTIFIÉS (%, €, nombre, temps, etc.)
   • Vérifie les PROJETS concrets et leur AMPLEUR (équipe, budget, durée)
   • Analyse les IMPACTS business mentionnés
   • Pénalise si CV trop vague ou sans résultats mesurables

📌 D. Secteur d'Activité (4 pts) :
   • Même secteur que l'entreprise qui recrute : 4 pts
   • Secteur adjacent : 2 pts
   • Secteur différent mais compétences transférables : 1 pt
   • Aucun lien sectoriel : 0 pt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎓 3. FORMATION & QUALIFICATIONS - 15 POINTS (strict sur niveau)

📌 A. Niveau d'Études (8 pts) :
   • Identifie le niveau REQUIS dans l'offre (Bac+2, Bac+3, Bac+5, PhD)
   • Scoring :
     ➜ Niveau supérieur au requis : 8 pts
     ➜ Niveau exactement requis : 7 pts
     ➜ Niveau inférieur de 1 : 4 pts
     ➜ Niveau inférieur de 2+ : 1 pt
     ➜ Pas de diplôme mais expérience compensatrice : 3 pts

📌 B. Domaine d'Études (5 pts) :
   • Domaine EXACTEMENT pertinent (ex: Informatique pour dev) : 5 pts
   • Domaine proche (ex: Électronique pour dev embarqué) : 3 pts
   • Domaine différent mais avec reconversion : 2 pts
   • Domaine sans lien : 0 pt

📌 C. Formation Continue (2 pts) :
   • Bootcamps, MOOCs, formations pro récentes (< 2 ans)
   • Montre volonté d'apprentissage continu
   • Pertinence avec le poste

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🧠 4. SOFT SKILLS & CULTURE FIT - 15 POINTS (analyse qualitative)

📌 A. Soft Skills Requises (8 pts) :
   • Extrait TOUTES les soft skills mentionnées dans l'offre
     (ex: leadership, communication, autonomie, esprit d'équipe)
   • Pour CHAQUE soft skill requise :
     ➜ Mentionnée ET démontrée par expériences : +2 pts
     ➜ Mentionnée mais non démontrée : +0.5 pt
     ➜ Non mentionnée : 0 pt
   • Cherche des PREUVES concrètes (management d'équipe, projets cross-fonctionnels, etc.)

📌 B. Langues (4 pts) :
   • Identifie les langues REQUISES dans l'offre
   • Pour chaque langue :
     ➜ Niveau C1/C2 ou natif : pts max
     ➜ Niveau B2 (courant) : pts moyens
     ➜ Niveau inférieur : pts faibles
     ➜ Langue requise absente : -2 pts (pénalité)

📌 C. Méthodologies & Culture (3 pts) :
   • Agile/Scrum si mentionné dans l'offre
   • Remote/Hybride si pertinent
   • DevOps, Lean, Design Thinking si requis
   • Culture d'entreprise (startup vs corporate)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🤖 CRITÈRES ATS (Applicant Tracking System) - BONUS/MALUS :

✓ BONUS (jusqu'à +5 pts) :
   • Mots-clés EXACTS de l'offre présents dans le CV : +2 pts
   • Haute densité de termes pertinents : +1 pt
   • Verbes d'action et résultats quantifiés : +1 pt
   • Structure claire et bien organisée : +1 pt

✗ MALUS (jusqu'à -10 pts) :
   • Trous de carrière > 1 an non expliqués : -3 pts
   • Incohérences dans les dates : -2 pts
   • Job hopping excessif (< 1 an par poste) : -3 pts
   • CV mal structuré ou illisible : -2 pts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📏 ÉCHELLE DE SCORING FINALE (sois STRICT) :

95-100 ★★★★★ EXCELLENT - Candidat IDÉAL, match parfait
           → Toutes compétences clés présentes + expérience parfaite

85-94  ★★★★☆ TRÈS BON - Candidat HAUTEMENT qualifié
           → Quelques compétences manquantes mineures tolérables

70-84  ★★★☆☆ BON - Candidat QUALIFIÉ avec gaps acceptables
           → Compétences principales OK, formation/expérience adéquate

55-69  ★★☆☆☆ MOYEN - Candidat ACCEPTABLE mais lacunes notables
           → Manque certaines compétences importantes ou expérience

40-54  ★☆☆☆☆ FAIBLE - Candidat SOUS-QUALIFIÉ
           → Gaps importants, formation/expérience insuffisante

0-39   ☆☆☆☆☆ INADÉQUAT - PAS de match
           → Profil ne correspond pas au poste

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ RÈGLES D'OR POUR TON ANALYSE :

1. 🔍 LIS CHAQUE MOT de l'offre d'emploi - ne rate AUCUN détail
2. ✅ Coche MENTALEMENT chaque critère requis présent/absent dans le CV
3. 🎯 Sois OBJECTIF - ne compense pas un manque par de l'optimisme
4. ⚖️ PÉNALISE vraiment les compétences critiques manquantes
5. 📊 VALORISE l'expérience concrète et mesurable
6. 🚫 Ne JAMAIS donner >90 sauf si vraiment candidat quasi-parfait
7. 📉 Un seul gap critique peut faire chuter le score de 10-15 pts
8. 🔢 Arrondis ton score final à l'entier le plus proche

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 CV DU CANDIDAT (format JSON structuré) :

{cvContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 TON PROCESSUS D'ANALYSE (étape par étape) :

ÉTAPE 1 : Va chercher et lis INTÉGRALEMENT l'offre d'emploi au lien fourni
ÉTAPE 2 : Extrais TOUS les critères requis (compétences, expérience, formation, etc.)
ÉTAPE 3 : Crée mentalement une checklist de TOUS les critères
ÉTAPE 4 : Parcours le CV JSON et coche chaque critère présent/absent
ÉTAPE 5 : Calcule le score selon la grille détaillée ci-dessus
ÉTAPE 6 : Applique les bonus/malus ATS
ÉTAPE 7 : Vérifie que ton score est cohérent avec l'échelle (pas trop optimiste !)
ÉTAPE 8 : Ajuste si nécessaire pour refléter la VRAIE adéquation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ ATTENTION CRITIQUE :

• Si une compétence MAJEURE manque → score MAX 60
• Si 2+ compétences majeures manquent → score MAX 45
• Si l'expérience est insuffisante (< 50% du requis) → score MAX 50
• Si formation inadéquate + compétences manquantes → score MAX 40
• Sois IMPITOYABLE sur les gaps critiques - un RH réel rejetterait le CV

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
  signal = null
}) {
  console.log('[calculateMatchScore] Démarrage du calcul de score de match');

  if (!cvContent || !jobOfferUrl) {
    throw new Error('CV content and job offer URL are required');
  }

  const client = getOpenAIClient();
  // Utiliser GPT-4o-mini qui supporte les recherches web
  const model = 'gpt-4o-mini';

  console.log(`[calculateMatchScore] Modèle GPT utilisé : ${model}`);
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

  const systemPrompt = process.env.GPT_MATCH_SCORE_SYSTEM_PROMPT?.trim() || MATCH_SCORE_SYSTEM_PROMPT;
  const userPrompt = (process.env.GPT_MATCH_SCORE_USER_PROMPT?.trim() || MATCH_SCORE_USER_PROMPT)
    .replace(/\{jobOfferUrl\}/g, jobOfferUrl)
    .replace(/\{cvContent\}/g, finalCvContent);

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
      max_completion_tokens: 50, // Augmenté pour permettre une réponse plus longue
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

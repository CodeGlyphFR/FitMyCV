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
  signal = null
}) {
  console.log('[calculateMatchScore] Démarrage du calcul de score de match');

  if (!cvContent || !jobOfferUrl) {
    throw new Error('CV content and job offer URL are required');
  }

  const client = getOpenAIClient();
  const model = 'gpt-5-mini-2025-08-07'; // Modèle complet qui peut accéder aux URLs

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
      // Pas de limite de tokens pour laisser gpt-5 utiliser ce dont il a besoin
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

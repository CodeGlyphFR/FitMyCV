import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function calculateMatchScoreWithAnalysis({
  cvContent,
  jobOfferUrl,
  signal
}) {
  try {
    // Parser le CV
    let cvData;
    try {
      cvData = JSON.parse(cvContent);
    } catch (e) {
      console.error('[calculateMatchScoreWithAnalysis] Erreur parsing CV:', e);
      throw new Error('Invalid CV format');
    }

    const systemPrompt = `Tu es un expert en recrutement et ATS (Applicant Tracking System).
Tu dois analyser la correspondance entre un CV et une offre d'emploi, puis fournir:
1. Un score de match (0-100)
2. Une analyse détaillée
3. Des suggestions d'amélioration concrètes
4. Les compétences manquantes et correspondantes

IMPORTANT: Retourne UNIQUEMENT un JSON valide, sans texte avant ou après.`;

    const userPrompt = `Analyse ce CV par rapport à l'offre d'emploi et retourne un JSON avec cette structure EXACTE:

{
  "match_score": [nombre entre 0 et 100],
  "score_breakdown": {
    "technical_skills": [score sur 100],
    "experience": [score sur 100],
    "education": [score sur 100],
    "soft_skills_languages": [score sur 100]
  },
  "suggestions": [
    {
      "priority": "high|medium|low",
      "section": "summary|skills|experience|education|projects",
      "suggestion": "[description concrète de l'amélioration]",
      "impact": "[impact attendu sur le score]"
    }
  ],
  "missing_skills": ["compétence1", "compétence2"],
  "matching_skills": ["compétence1", "compétence2"]
}

CV actuel:
${JSON.stringify(cvData, null, 2)}

URL de l'offre d'emploi: ${jobOfferUrl}

Analyse l'offre et compare avec le CV. Sois précis dans tes suggestions.`;

    console.log('[calculateMatchScoreWithAnalysis] Appel OpenAI pour analyse complète...');

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 2000,
      response_format: { type: "json_object" }
    }, { signal });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    // Parser la réponse JSON
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error('[calculateMatchScoreWithAnalysis] Erreur parsing réponse:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Valider et nettoyer le résultat
    const matchScore = Math.min(100, Math.max(0, parseInt(result.match_score) || 0));

    const scoreBreakdown = {
      technical_skills: Math.min(100, Math.max(0, result.score_breakdown?.technical_skills || 0)),
      experience: Math.min(100, Math.max(0, result.score_breakdown?.experience || 0)),
      education: Math.min(100, Math.max(0, result.score_breakdown?.education || 0)),
      soft_skills_languages: Math.min(100, Math.max(0, result.score_breakdown?.soft_skills_languages || 0))
    };

    const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
    const missingSkills = Array.isArray(result.missing_skills) ? result.missing_skills : [];
    const matchingSkills = Array.isArray(result.matching_skills) ? result.matching_skills : [];

    console.log(`[calculateMatchScoreWithAnalysis] Score: ${matchScore}, Suggestions: ${suggestions.length}`);

    return {
      matchScore,
      scoreBreakdown,
      suggestions,
      missingSkills,
      matchingSkills
    };

  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) {
      throw new Error('Task cancelled');
    }
    console.error('[calculateMatchScoreWithAnalysis] Erreur:', error);
    throw error;
  }
}
/**
 * Content scoring for extracted job offers
 * Ported from FitMyCV-App/lib/utils/htmlToMarkdown/scoring.js
 */

/**
 * Score the quality of extracted job offer content
 * @param {string} content - Markdown/text content
 * @returns {{ score: number, breakdown: object, isValid: boolean }}
 */
export function scoreJobOfferContent(content) {
  if (!content || content.length < 100) {
    return { score: 0, breakdown: {}, isValid: false };
  }

  const text = content.toLowerCase();
  const breakdown = {
    length: 0,
    keywords: 0,
    structure: 0,
    noise: 0,
  };

  // Length scoring (ideal: 1500-8000 chars)
  const len = content.length;
  if (len >= 500 && len <= 1000) breakdown.length = 10;
  else if (len > 1000 && len <= 1500) breakdown.length = 15;
  else if (len > 1500 && len <= 8000) breakdown.length = 20;
  else if (len > 8000 && len <= 15000) breakdown.length = 15;
  else if (len > 15000) breakdown.length = 10;
  else breakdown.length = 5;

  // Keyword scoring
  const mustHaveKeywords = [
    'description', 'mission', 'profil', 'compétence', 'competence',
    'experience', 'expérience', 'formation', 'poste', 'job',
    'responsabilité', 'responsibility', 'qualification',
  ];
  const niceToHaveKeywords = [
    'salaire', 'salary', 'rémunération', 'remuneration',
    'avantages', 'benefits', 'télétravail', 'remote',
    'cdi', 'cdd', 'contrat', 'contract', 'équipe', 'team',
  ];

  const mustHaveFound = mustHaveKeywords.filter(k => text.includes(k)).length;
  const niceToHaveFound = niceToHaveKeywords.filter(k => text.includes(k)).length;
  breakdown.keywords = Math.min(mustHaveFound * 3 + niceToHaveFound * 1.5, 30);

  // Structure scoring
  const hasList = /^[-*•]\s/m.test(content) || /^\d+[.)]\s/m.test(content);
  const hasHeadings = /^#{1,3}\s/m.test(content) || /^[A-Z][A-Za-zÀ-ÿ\s]+:$/m.test(content);
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50);
  const hasParagraphs = paragraphs.length >= 3;

  if (hasList) breakdown.structure += 10;
  if (hasHeadings) breakdown.structure += 10;
  if (hasParagraphs) breakdown.structure += 5;

  // Noise penalty
  const noisePatterns = [
    /cookie/gi,
    /privacy policy/gi,
    /politique de confidentialité/gi,
    /subscribe|newsletter/gi,
    /login|sign in|se connecter/gi,
    /copyright|©|tous droits réservés/gi,
    /all rights reserved/gi,
    /accept.*terms/gi,
  ];

  let noiseCount = 0;
  for (const pattern of noisePatterns) {
    const matches = content.match(pattern);
    if (matches) noiseCount += matches.length;
  }
  breakdown.noise = -Math.min(noiseCount * 3, 25);

  const score = Math.max(0, Math.min(100,
    breakdown.length + breakdown.keywords + breakdown.structure + breakdown.noise
  ));

  return {
    score,
    breakdown,
    isValid: score >= 25 && len >= 200,
  };
}

/**
 * Détecte la langue d'un CV en analysant son contenu
 * @param {string|Object} cvContent - Le contenu du CV (JSON string ou objet)
 * @returns {string} - Code de langue: 'fr' ou 'en'
 */
export function detectCvLanguage(cvContent) {
  try {
    // Parser le CV si c'est une string JSON
    const cv = typeof cvContent === 'string' ? JSON.parse(cvContent) : cvContent;

    // Extraire le texte à analyser
    const textToAnalyze = [
      cv.summary?.description || '',
      cv.header?.current_title || '',
      ...(cv.experience || []).map(exp => exp.description || ''),
      ...(cv.education || []).map(edu => edu.degree || ''),
      ...(cv.skills?.hard_skills || []).map(skill => skill.name || ''),
    ].join(' ').toLowerCase();

    // Mots clés français
    const frenchKeywords = [
      'expérience', 'compétences', 'formation', 'diplôme', 'entreprise',
      'poste', 'responsabilités', 'projet', 'équipe', 'développement',
      'gestion', 'année', 'mois', 'niveau', 'maîtrise', 'actuellement',
      'depuis', 'chez', 'dans', 'avec', 'pour', 'développeur',
      'ingénieur', 'analyste', 'chef', 'directeur', 'responsable'
    ];

    // Mots clés anglais
    const englishKeywords = [
      'experience', 'skills', 'education', 'degree', 'company',
      'position', 'responsibilities', 'project', 'team', 'development',
      'management', 'year', 'month', 'level', 'proficiency', 'currently',
      'since', 'at', 'in', 'with', 'for', 'developer',
      'engineer', 'analyst', 'manager', 'director', 'lead'
    ];

    // Compter les occurrences
    let frenchCount = 0;
    let englishCount = 0;

    frenchKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(keyword, 'g'));
      if (matches) frenchCount += matches.length;
    });

    englishKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(keyword, 'g'));
      if (matches) englishCount += matches.length;
    });

    // Détecter les caractères accentués (plus présents en français)
    const accentedChars = textToAnalyze.match(/[àâäéèêëïîôùûüÿæœç]/g);
    if (accentedChars) {
      frenchCount += accentedChars.length * 2; // Poids plus important
    }

    console.log(`[detectCvLanguage] French keywords: ${frenchCount}, English keywords: ${englishCount}`);

    // Retourner la langue dominante (par défaut français)
    return englishCount > frenchCount ? 'en' : 'fr';

  } catch (error) {
    console.error('[detectCvLanguage] Erreur détection langue:', error);
    // Par défaut, retourner français
    return 'fr';
  }
}

/**
 * Détecte la langue d'une offre d'emploi en analysant son contenu textuel
 * @param {string} jobOfferText - Le contenu textuel de l'offre d'emploi
 * @returns {string} - Code de langue: 'fr' ou 'en'
 */
export function detectJobOfferLanguage(jobOfferText) {
  try {
    const textToAnalyze = (jobOfferText || '').toLowerCase();

    // Mots clés français spécifiques aux offres d'emploi
    const frenchKeywords = [
      'offre', 'emploi', 'poste', 'profil', 'recherché', 'missions',
      'compétences', 'requises', 'souhaitées', 'expérience', 'formation',
      'diplôme', 'entreprise', 'société', 'candidat', 'contrat', 'cdi',
      'stage', 'salaire', 'avantages', 'nous', 'notre', 'vous', 'votre',
      'rejoindre', 'équipe', 'rejoignez', 'postuler', 'candidature'
    ];

    // Mots clés anglais spécifiques aux offres d'emploi
    const englishKeywords = [
      'job', 'position', 'offer', 'profile', 'seeking', 'looking',
      'responsibilities', 'requirements', 'required', 'desired', 'experience',
      'skills', 'degree', 'company', 'candidate', 'contract', 'full-time',
      'internship', 'salary', 'benefits', 'we', 'our', 'you', 'your',
      'join', 'team', 'apply', 'application'
    ];

    // Compter les occurrences
    let frenchCount = 0;
    let englishCount = 0;

    frenchKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) frenchCount += matches.length;
    });

    englishKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) englishCount += matches.length;
    });

    // Détecter les caractères accentués (plus présents en français)
    const accentedChars = textToAnalyze.match(/[àâäéèêëïîôùûüÿæœç]/g);
    if (accentedChars) {
      frenchCount += accentedChars.length * 2;
    }

    console.log(`[detectJobOfferLanguage] French keywords: ${frenchCount}, English keywords: ${englishCount}`);

    // Retourner la langue dominante (par défaut français)
    return englishCount > frenchCount ? 'en' : 'fr';

  } catch (error) {
    console.error('[detectJobOfferLanguage] Erreur détection langue:', error);
    return 'fr';
  }
}

/**
 * Retourne le nom complet de la langue
 * @param {string} languageCode - Code de langue ('fr' ou 'en')
 * @returns {string} - Nom complet de la langue
 */
export function getLanguageName(languageCode) {
  const names = {
    fr: 'français',
    en: 'anglais',
    en_US: 'anglais',
  };
  return names[languageCode] || 'français';
}

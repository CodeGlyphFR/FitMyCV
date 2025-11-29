/**
 * @deprecated Use cv.language field (OpenAI-detected) or lib/openai/detectLanguage.js for new detection.
 * This keyword-based detection is a FALLBACK ONLY for CVs without stored language field.
 *
 * New CVs are detected via OpenAI at creation time (see lib/openai/detectLanguage.js).
 * Existing CVs without language field fall back to this keyword detection.
 *
 * Détecte la langue d'un CV en analysant son contenu (méthode par mots-clés)
 * @param {string|Object} cvContent - Le contenu du CV (JSON string ou objet)
 * @returns {string} - Code de langue: 'fr' ou 'en'
 */
export function detectCvLanguage(cvContent) {
  console.warn('[detectCvLanguage] Using fallback keyword detection - CV should have "language" field');
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

    // Mots clés espagnols
    const spanishKeywords = [
      'experiencia', 'habilidades', 'educación', 'formación', 'título',
      'empresa', 'puesto', 'responsabilidades', 'proyecto', 'equipo',
      'desarrollo', 'gestión', 'año', 'mes', 'nivel', 'dominio',
      'actualmente', 'desde', 'en', 'con', 'para', 'desarrollador',
      'ingeniero', 'analista', 'gerente', 'director', 'líder'
    ];

    // Compter les occurrences
    let frenchCount = 0;
    let englishCount = 0;
    let spanishCount = 0;

    frenchKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(keyword, 'g'));
      if (matches) frenchCount += matches.length;
    });

    englishKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(keyword, 'g'));
      if (matches) englishCount += matches.length;
    });

    spanishKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(keyword, 'g'));
      if (matches) spanishCount += matches.length;
    });

    // Détecter les caractères accentués français (plus présents en français)
    const frenchAccentedChars = textToAnalyze.match(/[àâäéèêëïîôùûüÿæœç]/g);
    if (frenchAccentedChars) {
      frenchCount += frenchAccentedChars.length * 2; // Poids plus important
    }

    // Détecter les caractères spécifiques espagnols (ñ, ¿, ¡, accents inverses)
    const spanishSpecificChars = textToAnalyze.match(/[ñ¿¡]/g);
    if (spanishSpecificChars) {
      spanishCount += spanishSpecificChars.length * 3; // Poids très important (caractères uniques à l'espagnol)
    }

    console.log(`[detectCvLanguage] French: ${frenchCount}, English: ${englishCount}, Spanish: ${spanishCount}`);

    // Retourner la langue dominante (par défaut français)
    if (spanishCount > frenchCount && spanishCount > englishCount) {
      return 'es';
    }
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

    // Mots clés espagnols spécifiques aux offres d'emploi
    const spanishKeywords = [
      'oferta', 'empleo', 'puesto', 'perfil', 'buscamos', 'buscando',
      'responsabilidades', 'requisitos', 'requerido', 'deseado', 'experiencia',
      'habilidades', 'título', 'empresa', 'candidato', 'contrato', 'tiempo completo',
      'prácticas', 'salario', 'beneficios', 'nosotros', 'nuestro', 'usted', 'tu',
      'únete', 'equipo', 'postular', 'solicitud'
    ];

    // Compter les occurrences
    let frenchCount = 0;
    let englishCount = 0;
    let spanishCount = 0;

    frenchKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) frenchCount += matches.length;
    });

    englishKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) englishCount += matches.length;
    });

    spanishKeywords.forEach(keyword => {
      const matches = textToAnalyze.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) spanishCount += matches.length;
    });

    // Détecter les caractères accentués français (plus présents en français)
    const frenchAccentedChars = textToAnalyze.match(/[àâäéèêëïîôùûüÿæœç]/g);
    if (frenchAccentedChars) {
      frenchCount += frenchAccentedChars.length * 2;
    }

    // Détecter les caractères spécifiques espagnols
    const spanishSpecificChars = textToAnalyze.match(/[ñ¿¡]/g);
    if (spanishSpecificChars) {
      spanishCount += spanishSpecificChars.length * 3;
    }

    console.log(`[detectJobOfferLanguage] French: ${frenchCount}, English: ${englishCount}, Spanish: ${spanishCount}`);

    // Retourner la langue dominante (par défaut français)
    if (spanishCount > frenchCount && spanishCount > englishCount) {
      return 'es';
    }
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
    es: 'español',
  };
  return names[languageCode] || 'français';
}

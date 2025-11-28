# Guide : Ajouter une nouvelle langue

Ce guide explique comment ajouter le support d'une nouvelle langue (ex: allemand `de`, italien `it`, portugais `pt`).

## Fichiers à modifier

### 1. Constantes de langue

**Fichier**: `lib/cv/languageConstants.js`

```javascript
// Ajouter le code langue
export const SUPPORTED_LANGUAGES = {
  FR: 'fr',
  EN: 'en',
  ES: 'es',
  DE: 'de',  // NOUVEAU
};

// Ajouter le nom pour les prompts OpenAI
export const LANGUAGE_NAMES = {
  [SUPPORTED_LANGUAGES.FR]: 'français',
  [SUPPORTED_LANGUAGES.EN]: 'anglais',
  [SUPPORTED_LANGUAGES.ES]: 'español',
  [SUPPORTED_LANGUAGES.DE]: 'deutsch',  // NOUVEAU
};

// Ajouter le drapeau
export const LANGUAGE_FLAGS = {
  ...
  [SUPPORTED_LANGUAGES.DE]: '/icons/de.svg',  // NOUVEAU
};

// Ajouter le label UI
export const LANGUAGE_LABELS = {
  ...
  [SUPPORTED_LANGUAGES.DE]: 'Deutsch',  // NOUVEAU
};

// Ajouter les mots-clés de normalisation
export const LANGUAGE_KEYWORDS = {
  ...
  [SUPPORTED_LANGUAGES.DE]: ['deutsch', 'german', 'allemand', 'de', 'ger'],  // NOUVEAU
};
```

### 2. Fichier de traduction UI

**Créer**: `locales/XX.json` (copier `locales/fr.json` et traduire)

**Modifier**: `lib/i18n/LanguageContext.jsx`

```javascript
import deTranslations from "@/locales/de.json";

const translations = {
  fr: frTranslations,
  en: enTranslations,
  es: esTranslations,
  de: deTranslations,  // NOUVEAU
};

// Ligne ~26 - validation
if (savedLanguage && ["fr", "en", "es", "de"].includes(savedLanguage)) {
```

### 3. Sélecteur de langue UI

**Fichier**: `components/LanguageSwitcher.jsx`

```javascript
const languages = [
  { code: "fr", flag: "/icons/fr.svg", label: "Français" },
  { code: "en", flag: "/icons/gb.svg", label: "English" },
  { code: "es", flag: "/icons/es.svg", label: "Español" },
  { code: "de", flag: "/icons/de.svg", label: "Deutsch" },  // NOUVEAU
];
```

### 4. Icône du drapeau

**Créer**: `public/icons/XX.svg`

Télécharger depuis [flagicons.lipis.dev](https://flagicons.lipis.dev/) ou créer un SVG 24x24.

### 5. Détection de langue OpenAI

**Fichier**: `lib/openai/detectLanguage.js`

```javascript
// Ligne ~46 - Mettre à jour le prompt
content: 'You are a language detection assistant. Analyze the text and respond with ONLY "fr" for French, "en" for English, "es" for Spanish, or "de" for German. No other text.'

// Ligne ~64 - Mettre à jour la validation
const validLanguages = ['fr', 'en', 'es', 'de'];
```

### 6. Détection fallback par mots-clés

**Fichier**: `lib/cv/detectLanguage.js`

Dans `detectCvLanguage()` (~ligne 45):
```javascript
const germanKeywords = [
  'erfahrung', 'fähigkeiten', 'ausbildung', 'abschluss', 'unternehmen',
  'position', 'verantwortlichkeiten', 'projekt', 'team', 'entwicklung',
  'management', 'jahr', 'monat', 'niveau', 'kenntnisse', 'derzeit',
  'seit', 'bei', 'mit', 'für', 'entwickler', 'ingenieur'
];

// Ajouter le comptage et la logique de retour
```

Dans `detectJobOfferLanguage()` (~ligne 128):
```javascript
const germanKeywords = [
  'stellenangebot', 'stelle', 'position', 'profil', 'suchen',
  'aufgaben', 'anforderungen', 'erfahrung', 'kenntnisse', 'unternehmen',
  'bewerber', 'vertrag', 'vollzeit', 'gehalt', 'vorteile'
];
```

Dans `getLanguageName()` (~ligne 188):
```javascript
const names = {
  fr: 'français',
  en: 'anglais',
  es: 'español',
  de: 'deutsch',  // NOUVEAU
};
```

### 7. Titres de sections CV

**Fichier**: `lib/i18n/cvLanguageHelper.js`

```javascript
import deTranslations from "@/locales/de.json";

const translations = {
  fr: frTranslations,
  en: enTranslations,
  es: esTranslations,
  de: deTranslations,  // NOUVEAU
};

// Ajouter defaultTitlesDe
const defaultTitlesDe = {
  summary: 'Zusammenfassung',
  experience: 'Berufserfahrung',
  education: 'Ausbildung',
  skills: 'Fähigkeiten',
  languages: 'Sprachen',
  certifications: 'Zertifizierungen',
  projects: 'Projekte',
};
```

### 8. API Traduction

**Fichier**: `app/api/background-tasks/translate-cv/route.js`

```javascript
// Ligne ~15 - validation
if (!targetLanguage || !['fr', 'en', 'es', 'de'].includes(targetLanguage)) {

// Ligne ~20 - noms
const languageNames = {
  fr: 'français',
  en: 'anglais',
  es: 'español',
  de: 'deutsch',
};
```

**Fichier**: `lib/openai/translateCv.js`

```javascript
const languageNames = {
  fr: 'français',
  en: 'anglais',
  es: 'español',
  de: 'deutsch',
};
```

### 9. Filtre CV par langue

**Fichier**: `components/TopBar/components/FilterDropdown.jsx`

```javascript
const CV_LANGUAGES = [
  { id: null, key: "all" },
  { id: "fr", key: "fr" },
  { id: "en", key: "en" },
  { id: "es", key: "es" },
  { id: "de", key: "de" },  // NOUVEAU
];
```

### 10. Prompt calcul de score

**Fichier**: `lib/openai/prompts/scoring/system.md`

```markdown
## LANGUE DE L'ANALYSE

**OBLIGATION ABSOLUE** : Tu DOIS rédiger TOUTE ton analyse dans la langue du CV : **{cvLanguage}**.
- Si le CV est en français → analyse en français
- Si le CV est en anglais → analyse en anglais
- Si le CV est en español → analyse en español
- Si le CV est en deutsch → analyse en deutsch  // NOUVEAU
```

## Documentation à mettre à jour

- `docs/FEATURES.md` - Section "Langues supportées"
- `docs/USAGE.md` - Section "Traduction"

## Checklist

- [ ] `lib/cv/languageConstants.js` - 5 constantes
- [ ] `locales/XX.json` - Fichier de traduction UI
- [ ] `lib/i18n/LanguageContext.jsx` - Import + validation
- [ ] `components/LanguageSwitcher.jsx` - Option dans le sélecteur
- [ ] `public/icons/XX.svg` - Drapeau
- [ ] `lib/openai/detectLanguage.js` - Prompt + validation
- [ ] `lib/cv/detectLanguage.js` - Mots-clés + getLanguageName
- [ ] `lib/i18n/cvLanguageHelper.js` - Import + titres par défaut
- [ ] `app/api/background-tasks/translate-cv/route.js` - Validation + noms
- [ ] `lib/openai/translateCv.js` - Noms de langue
- [ ] `components/TopBar/components/FilterDropdown.jsx` - Option filtre
- [ ] `lib/openai/prompts/scoring/system.md` - Instruction langue
- [ ] `docs/FEATURES.md` - Documentation
- [ ] `docs/USAGE.md` - Documentation
- [ ] `npm run build` - Vérifier que tout compile

/**
 * Test du prompt Summary avec un CV existant
 * Usage: node scripts/test-summary-prompt.mjs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const PROMPTS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/prompts');
const SCHEMAS_DIR = path.join(process.cwd(), 'lib/cv-pipeline-v2/schemas');

async function loadPrompt(filename) {
  const fullPath = path.join(PROMPTS_DIR, filename);
  return (await fs.readFile(fullPath, 'utf-8')).trim();
}

async function loadSchema(filename) {
  const fullPath = path.join(SCHEMAS_DIR, filename);
  return JSON.parse(await fs.readFile(fullPath, 'utf-8'));
}

function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }
  return result;
}

/**
 * Calcule la duree en mois entre deux dates
 */
function calculateDurationMonths(startDate, endDate) {
  if (!startDate) return 0;

  const start = new Date(startDate);
  const end = endDate && endDate !== 'present' && endDate !== ''
    ? new Date(endDate)
    : new Date();

  if (isNaN(start.getTime())) return 0;
  if (isNaN(end.getTime())) return 0;

  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

/**
 * Calcule les durees de chaque experience (uniquement les vraies experiences pro)
 */
function calculateExperienceDurations(experiences) {
  if (!experiences || experiences.length === 0) {
    return { durations: [], totalYears: 0, currentTitles: [] };
  }

  // Filtrer uniquement les vraies experiences professionnelles (avec company renseignee)
  const proExperiences = experiences.filter(exp => exp.company && exp.company.trim() !== '');

  const durations = proExperiences.map(exp => {
    const months = calculateDurationMonths(exp.start_date, exp.end_date);
    const years = Math.round(months / 12 * 10) / 10;
    const isCurrent = !exp.end_date || exp.end_date === 'present' || exp.end_date === '';

    return {
      title: exp.title || 'Non spécifié',
      company: exp.company || '',
      months,
      years,
      isCurrent,
    };
  });

  const sortedByDuration = [...durations].sort((a, b) => b.months - a.months);

  const firstExp = proExperiences.reduce((earliest, exp) => {
    if (!exp.start_date) return earliest;
    const date = new Date(exp.start_date);
    return !earliest || date < earliest ? date : earliest;
  }, null);

  const totalYears = firstExp
    ? Math.round((new Date() - firstExp) / (1000 * 60 * 60 * 24 * 365))
    : 0;

  // Titres des experiences actuelles (dedupliques)
  const currentTitles = [...new Set(durations.filter(d => d.isCurrent).map(d => d.title))];

  return {
    durations: sortedByDuration.map(d => `${d.title} (${d.company}): ${d.years} an${d.years > 1 ? 's' : ''}${d.isCurrent ? ' - en cours' : ''}`),
    totalYears,
    currentTitles,
  };
}

async function main() {
  console.log('🔍 Recherche du dernier CV généré...\n');

  // Trouver le dernier CV généré (avec jobOfferId)
  const cvFile = await prisma.cvFile.findFirst({
    where: {
      jobOfferId: { not: null }
    },
    orderBy: {
      updatedAt: 'desc'
    },
    include: {
      jobOffer: true
    }
  });

  if (!cvFile) {
    console.error('❌ Aucun CV généré trouvé');
    process.exit(1);
  }

  console.log(`✅ CV généré trouvé: ${cvFile.filename}\n`);

  const cv = cvFile.content;
  const jobOffer = cvFile.jobOffer?.content || {
    title: 'Poste non spécifié',
    description: '',
    skills: { required: [], nice_to_have: [] }
  };

  console.log('📋 Offre d\'emploi:', jobOffer.title || 'N/A');
  console.log('');

  // Charger les prompts
  const systemPrompt = await loadPrompt('batch-summary-system.md');
  const userPromptTemplate = await loadPrompt('batch-summary-user.md');
  const schema = await loadSchema('batchSummarySchema.json');

  // Construire le contexte cache (simplifié)
  const cacheContext = `
# CONTEXTE OFFRE D'EMPLOI
Titre: ${jobOffer.title || 'Customer Success Manager'}
Description: ${jobOffer.description || 'N/A'}
Compétences requises: ${JSON.stringify(jobOffer.skills?.required || [])}

# EXPÉRIENCES ADAPTÉES
${JSON.stringify(cv.experience || [], null, 2)}

# COMPÉTENCES ADAPTÉES
${JSON.stringify(cv.skills || {}, null, 2)}

# PROJETS
${JSON.stringify(cv.projects || [], null, 2)}

# HEADER (pour le genre)
${JSON.stringify(cv.header || {}, null, 2)}
`;

  const fullSystemPrompt = cacheContext + '\n\n---\n\n' + systemPrompt;

  // Calculer les durées des expériences (uniquement pro)
  const expDurations = calculateExperienceDurations(cv.experience || []);
  console.log('📊 Durées calculées (exp. pro uniquement):');
  console.log('  - Total:', expDurations.totalYears, 'ans');
  console.log('  - Titres actuels:', expDurations.currentTitles.join(' et '));
  console.log('  - Détail:');
  expDurations.durations.forEach(d => console.log('    -', d));
  console.log('');

  // User prompt
  const userPrompt = replaceVariables(userPromptTemplate, {
    extrasJson: JSON.stringify(cv.extras || [], null, 2),
    currentSummaryJson: JSON.stringify(cv.summary || null, null, 2),
    targetLanguage: 'français',
    experienceDurations: expDurations.durations.join('\n'),
    totalYears: expDurations.totalYears.toString(),
    currentTitles: expDurations.currentTitles.join(' et '),
  });

  console.log('📤 Envoi à OpenAI...\n');
  console.log('--- SYSTEM PROMPT (extrait) ---');
  console.log(fullSystemPrompt.substring(0, 1500) + '...\n');
  console.log('--- USER PROMPT ---');
  console.log(userPrompt);
  console.log('\n');

  // Appel OpenAI
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: fullSystemPrompt },
      { role: 'user', content: userPrompt }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: schema
    },
    temperature: 0.3,
    max_completion_tokens: 1500
  });

  const result = JSON.parse(response.choices[0].message.content);

  console.log('✅ RÉSULTAT DU SUMMARY:\n');
  console.log('📌 Headline:', result.headline);
  console.log('');
  console.log('📝 Description:');
  console.log(result.description);
  console.log('');
  console.log('📅 Années d\'expérience:', result.years_experience);
  console.log('');
  console.log('🎯 Domains:', result.domains?.join(', '));
  console.log('');
  console.log('💪 Key Strengths:', result.key_strengths?.join(', '));
  console.log('');
  console.log('📋 Modifications:');
  (result.modifications || []).forEach(mod => {
    console.log(`  - [${mod.action}] ${mod.field}: ${mod.reason}`);
  });

  console.log('\n--- TOKENS ---');
  console.log('Prompt:', response.usage?.prompt_tokens);
  console.log('Completion:', response.usage?.completion_tokens);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

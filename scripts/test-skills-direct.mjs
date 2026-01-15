// Test direct du batch-skills avec données cachées
import { executeBatchSkills } from '../lib/cv-pipeline-v2/phases/batch-skills.js';

// Données de l'offre No-code Builder
const jobOffer = {
  title: "No-code Builder",
  skills: {
    required: ["no-code", "low-code", "n8n", "Make", "Zapier", "API", "intégrations SaaS", "logique d'automatisation", "gestion d'erreurs", "optimisation", "modèles d'IA générative", "anglais B2"],
    nice_to_have: ["Cursor", "Replit", "Brighdata", "Phantombuster", "Open AI"],
    soft_skills: ["esprit analytique", "capacité de debugging", "curiosité technologique", "autonomie", "rigueur", "organisation"]
  }
};

// Skills source du CV Tech
const skillsSource = {
  tools: [
    { name: "Claude API / Claude Code" },
    { name: "Cursor" },
    { name: "OpenAI API" },
    { name: "Figma" },
    { name: "Matlab / Simulink" },
    { name: "Git" },
    { name: "Linux / Ubuntu Server" }
  ],
  hard_skills: [
    { name: "Prompt Engineering" },
    { name: "Claude API / Claude Code" },
    { name: "Cursor" },
    { name: "OpenAI API" },
    { name: "Agents IA" },
    { name: "Déploiement de modèles (cloud / on-premise)" },
    { name: "Python" },
    { name: "C" },
    { name: "Architecture logicielle" },
    { name: "APIs" },
    { name: "Git" },
    { name: "Figma" },
    { name: "Linux / Ubuntu Server" },
    { name: "Administration système" },
    { name: "Systèmes embarqués" },
    { name: "Micro-soudure" },
    { name: "Conception électronique" },
    { name: "Matlab / Simulink" },
    { name: "Gestion de projet" },
    { name: "Coordination d'équipes internationales" }
  ],
  soft_skills: ["Autonomie", "Coordination d'équipes", "Management d'équipe", "Capacité à structurer", "Communication"],
  methodologies: []
};

// Expériences adaptées (simplifiées)
const adaptedExperiences = [
  { title: "Consultant technique senior", company: "Accenture France", skills_used: ["Qualité logicielle", "Gestion d'équipe"] },
  { title: "Fondateur & Développeur SaaS", company: "FitMyCV.io", skills_used: ["Next.js", "OpenAI API", "Développement full-stack"] }
];

const adaptedProjects = [];

async function test() {
  console.log("=== Test direct batch-skills ===\n");
  console.log("Offre:", jobOffer.title);
  console.log("Skills requis:", jobOffer.skills.required.slice(0, 5).join(", ") + "...");
  console.log("\n--- Exécution ---\n");

  const result = await executeBatchSkills({
    offerId: "test-offline",
    skills: skillsSource,
    adaptedExperiences,
    adaptedProjects,
    jobOffer,
    targetLanguage: "francais",
    userId: null,
    signal: null
  });

  console.log("\n=== RÉSULTAT ===\n");
  console.log("Success:", result.success);
  console.log("Duration:", result.duration + "ms");
  console.log("\n--- HARD SKILLS ---");
  console.log(JSON.stringify(result.adaptedSkills.hard_skills, null, 2));
  console.log("\n--- TOOLS ---");
  console.log(JSON.stringify(result.adaptedSkills.tools, null, 2));
  console.log("\n--- SOFT SKILLS ---");
  console.log(JSON.stringify(result.adaptedSkills.soft_skills, null, 2));
  console.log("\n--- MODIFICATIONS ---");
  console.log(JSON.stringify(result.modifications, null, 2));

  process.exit(0);
}

test().catch(e => {
  console.error(e);
  process.exit(1);
});

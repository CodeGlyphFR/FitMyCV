import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Dernière offre complétée
  const offer = await prisma.cvGenerationOffer.findFirst({
    where: { status: "completed" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      classificationResult: true,
      batchResults: true,
      generatedCvFileId: true,
    }
  });

  if (!offer) {
    console.log("Aucune offre trouvée");
    return;
  }

  console.log("=== Classification Result ===");
  const classification = offer.classificationResult;

  if (classification?.projects) {
    console.log("Projects classification:");
    classification.projects.forEach((p, i) => {
      console.log(`  [${i}] index=${p.index}, action=${p.action}, reason=${p.reason?.substring(0, 50)}...`);
    });
  }

  if (classification?.experiences) {
    console.log("\nExperiences classification (MOVE_TO_PROJECTS):");
    classification.experiences
      .filter(e => e.action === "MOVE_TO_PROJECTS")
      .forEach((e, i) => {
        console.log(`  [${i}] index=${e.index}, action=${e.action}, reason=${e.reason?.substring(0, 50)}...`);
      });
  }

  console.log("\n=== Batch Results - Projects ===");
  const projects = offer.batchResults?.projects || [];
  console.log(`Total projects: ${projects.length}`);
  projects.forEach((p, i) => {
    console.log(`  [${i}] name="${p.name}", role="${p.role || 'N/A'}"`);
  });

  // Vérifier le CV généré
  if (offer.generatedCvFileId) {
    const cvFile = await prisma.cvFile.findUnique({
      where: { id: offer.generatedCvFileId },
      select: { content: true }
    });

    console.log("\n=== Generated CV - Projects ===");
    const cvProjects = cvFile?.content?.projects || [];
    console.log(`Total projects in CV: ${cvProjects.length}`);
    cvProjects.forEach((p, i) => {
      console.log(`  [${i}] name="${p.name}", role="${p.role || 'N/A'}"`);
    });
  }

  // Vérifier aussi le CV source
  const task = await prisma.cvGenerationTask.findFirst({
    where: { offers: { some: { id: offer.id } } },
    select: { sourceCvFileId: true }
  });

  if (task?.sourceCvFileId) {
    const sourceCv = await prisma.cvFile.findUnique({
      where: { id: task.sourceCvFileId },
      select: { content: true }
    });

    console.log("\n=== Source CV - Projects ===");
    const sourceProjects = sourceCv?.content?.projects || [];
    console.log(`Total projects in source: ${sourceProjects.length}`);
    sourceProjects.forEach((p, i) => {
      console.log(`  [${i}] name="${p.name}", role="${p.role || 'N/A'}"`);
    });

    console.log("\n=== Source CV - Experiences ===");
    const sourceExperiences = sourceCv?.content?.experience || [];
    console.log(`Total experiences in source: ${sourceExperiences.length}`);
    sourceExperiences.forEach((e, i) => {
      console.log(`  [${i}] title="${e.title}", company="${e.company || 'N/A'}"`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

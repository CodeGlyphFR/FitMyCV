import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Récupérer la dernière CvGenerationOffer
  const offer = await prisma.cvGenerationOffer.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      subtasks: {
        where: { type: 'batch_skills' },
        select: {
          output: true,
          completedAt: true,
        }
      }
    }
  });

  if (!offer) {
    console.log("Aucune offre trouvée");
    return;
  }

  console.log("=== DERNIÈRE GÉNÉRATION ===");
  console.log("Offer ID:", offer.id);
  console.log("Generated:", offer.generatedCvFileName);
  console.log("Status:", offer.status);

  if (offer.subtasks && offer.subtasks[0]) {
    const output = offer.subtasks[0].output;
    console.log("\n=== BATCH_SKILLS OUTPUT ===");
    console.log("Completed:", offer.subtasks[0].completedAt);

    if (output) {
      console.log("\nTools count:", output.tools ? output.tools.length : 0);
      console.log("Hard skills count:", output.hard_skills ? output.hard_skills.length : 0);
      console.log("Soft skills count:", output.soft_skills ? output.soft_skills.length : 0);

      console.log("\n=== MODIFICATIONS PAR CATÉGORIE ===");
      const mods = output.modifications || [];
      const byCategory = {};
      mods.forEach(m => {
        const cat = m.category || 'unknown';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(m);
      });

      for (const [cat, items] of Object.entries(byCategory)) {
        console.log("\n" + cat.toUpperCase() + " (" + items.length + "):");
        items.forEach(m => console.log("  - " + m.action + ": " + m.skill));
      }
    }
  }

  // Vérifier aussi le CvFile.pendingChanges
  const cvFile = await prisma.cvFile.findFirst({
    where: { filename: offer.generatedCvFileName },
    select: {
      pendingChanges: true,
    }
  });

  if (cvFile && cvFile.pendingChanges) {
    console.log("\n=== PENDING CHANGES (pour affichage) ===");
    const changes = cvFile.pendingChanges;
    const bySection = {};
    changes.forEach(c => {
      const sec = c.section || 'unknown';
      if (!bySection[sec]) bySection[sec] = [];
      bySection[sec].push(c);
    });

    for (const [sec, items] of Object.entries(bySection)) {
      console.log("\n" + sec.toUpperCase() + " (" + items.length + "):");
      items.slice(0, 3).forEach(c => console.log("  - " + (c.change || c.itemName || c.field)));
      if (items.length > 3) console.log("  ... + " + (items.length - 3) + " autres");
    }
  } else {
    console.log("\n=== PENDING CHANGES: Aucun ===");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

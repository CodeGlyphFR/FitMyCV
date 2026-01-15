import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const offer = await prisma.cvGenerationOffer.findFirst({
    where: { status: "completed" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      batchResults: true
    }
  });
  
  if (!offer) {
    console.log("Aucune offre trouvee");
    return;
  }
  
  console.log("Offer ID:", offer.id);
  
  const br = offer.batchResults;
  if (!br) {
    console.log("Pas de batchResults");
    return;
  }
  
  console.log("\n=== Experiences ===");
  if (Array.isArray(br.experiences)) {
    br.experiences.forEach((exp, i) => {
      console.log("Experience", i, "- title:", exp.title);
      console.log("  hasModifications:", !!exp.modifications);
      console.log("  modifications count:", exp.modifications ? exp.modifications.length : 0);
    });
  }
  
  console.log("\n=== Skills ===");
  if (br.skills) {
    console.log("hasModifications:", !!br.skills.modifications);
    console.log("modifications count:", br.skills.modifications ? br.skills.modifications.length : 0);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

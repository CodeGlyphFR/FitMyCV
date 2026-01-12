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
  
  const br = offer.batchResults;
  
  console.log("=== Skills structure ===");
  console.log(JSON.stringify(br.skills, null, 2).substring(0, 2000));
  
  console.log("\n=== Experience 0 structure ===");
  console.log(JSON.stringify(br.experiences[0], null, 2).substring(0, 2000));
}

main().catch(console.error).finally(() => prisma.$disconnect());

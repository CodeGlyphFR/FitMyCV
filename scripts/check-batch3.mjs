import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Dernière subtask skills
  const skillsSubtask = await prisma.cvGenerationSubtask.findFirst({
    where: { type: "batch_skills" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      modifications: true,
      output: true
    }
  });
  
  console.log("=== Skills Subtask ===");
  console.log("Modifications field:", JSON.stringify(skillsSubtask.modifications, null, 2));
  console.log("\nOutput.modifications:", JSON.stringify(skillsSubtask.output?.modifications, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

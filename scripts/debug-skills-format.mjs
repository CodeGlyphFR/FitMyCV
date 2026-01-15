import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // CV adapté - vérifier la date de création
  const adaptedCv = await prisma.cvFile.findFirst({
    where: { filename: { contains: 'adapted_no-code-builder' } },
    select: { 
      filename: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  console.log("CV adapté:", adaptedCv?.filename);
  console.log("Créé le:", adaptedCv?.createdAt);
  console.log("Mis à jour:", adaptedCv?.updatedAt);
  
  // Vérifier aussi la CvGenerationOffer correspondante
  const offer = await prisma.cvGenerationOffer.findFirst({
    where: { 
      generatedCvFileName: { contains: 'adapted_no-code-builder' }
    },
    include: {
      subtasks: {
        where: { type: 'batch_skills' },
        select: { 
          status: true,
          output: true,
          completedAt: true,
        }
      }
    }
  });
  
  if (offer?.subtasks?.[0]) {
    const subtask = offer.subtasks[0];
    console.log("\n=== Subtask batch_skills ===");
    console.log("Status:", subtask.status);
    console.log("Completed:", subtask.completedAt);
    
    const output = subtask.output;
    if (output) {
      console.log("\nTools dans output:", output.tools?.length || 0);
      console.log("Modifications:", output.modifications?.length || 0);
      if (output.modifications) {
        const toolMods = output.modifications.filter(m => m.category === 'tools');
        console.log("Modifications tools:", toolMods.length);
        toolMods.forEach(m => console.log(`  - ${m.action}: ${m.skill}`));
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

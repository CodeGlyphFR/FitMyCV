/**
 * Script pour activer export_pdf dans le plan Gratuit
 */
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const gratuit = await prisma.subscriptionPlan.findUnique({
    where: { name: 'Gratuit' },
    include: { featureLimits: true },
  });

  if (!gratuit) {
    console.log('Plan Gratuit introuvable');
    return;
  }

  const exportPdf = gratuit.featureLimits.find(f => f.featureName === 'export_pdf');

  if (exportPdf) {
    await prisma.subscriptionPlanFeatureLimit.update({
      where: { id: exportPdf.id },
      data: {
        isEnabled: true,
        usageLimit: 5,
      },
    });
    console.log('✅ export_pdf activé dans le plan Gratuit (limit: 5)');
  } else {
    console.log('❌ export_pdf non trouvé');
  }
}

fix()
  .finally(() => prisma.$disconnect());

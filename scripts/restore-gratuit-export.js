/**
 * Script pour désactiver export_pdf dans le plan Gratuit (restauration)
 */
require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function restore() {
  const gratuit = await prisma.subscriptionPlan.findUnique({
    where: { name: 'Gratuit' },
    include: { featureLimits: true },
  });

  if (!gratuit) {
    console.log('❌ Plan Gratuit introuvable');
    return;
  }

  const exportPdf = gratuit.featureLimits.find(f => f.featureName === 'export_pdf');

  if (exportPdf) {
    await prisma.subscriptionPlanFeatureLimit.update({
      where: { id: exportPdf.id },
      data: {
        isEnabled: false,
        usageLimit: 0,
      },
    });
    console.log('✅ export_pdf désactivé dans le plan Gratuit (isEnabled=false, limit=0)');
  } else {
    console.log('❌ export_pdf non trouvé dans le plan Gratuit');
  }
}

restore()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

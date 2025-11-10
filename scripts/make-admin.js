/**
 * Script pour promouvoir un utilisateur en admin
 *
 * Usage:
 *   node scripts/make-admin.js <email>
 *
 * Exemple:
 *   node scripts/make-admin.js admin@example.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function makeAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Erreur: Email requis');
    console.log('\nUsage: node scripts/make-admin.js <email>');
    console.log('Exemple: node scripts/make-admin.js admin@example.com');
    process.exit(1);
  }

  try {
    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      console.error(`❌ Utilisateur avec l'email "${email}" introuvable`);
      process.exit(1);
    }

    if (user.role === 'ADMIN') {
      console.log(`ℹ️  L'utilisateur ${user.email} est déjà admin`);
      process.exit(0);
    }

    // Promouvoir en admin
    await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
    });

    console.log(`✅ Utilisateur promu en admin avec succès !`);
    console.log(`\nDétails:`);
    console.log(`  Nom: ${user.name || 'N/A'}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Ancien rôle: ${user.role}`);
    console.log(`  Nouveau rôle: ADMIN`);
    console.log(`\n🎉 Vous pouvez maintenant accéder au dashboard admin: /admin/analytics`);

  } catch (error) {
    console.error('❌ Erreur lors de la promotion:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();

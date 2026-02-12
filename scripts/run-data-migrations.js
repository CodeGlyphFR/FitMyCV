const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function run() {
  // 1. Création de la table de suivi si elle n'existe pas
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_data_migrations" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT UNIQUE NOT NULL,
      "applied_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationDir = path.join(__dirname, '../prisma/data-migrations');
  
  if (!fs.existsSync(migrationDir)) {
    console.log("ℹ️ Aucun dossier de migration de données trouvé.");
    return;
  }

  // 2. Lecture et tri des fichiers .js
  const files = fs.readdirSync(migrationDir)
    .filter(f => f.endsWith('.js'))
    .sort();

  if (files.length === 0) {
    console.log("ℹ️ Aucune migration de données à traiter.");
    return;
  }

  // 3. Boucle d'exécution
  for (const file of files) {
    const alreadyApplied = await prisma.$queryRaw`
      SELECT id FROM "_data_migrations" WHERE name = ${file}
    `;
    
    if (alreadyApplied.length === 0) {
      console.log(`🚀 Exécution de la migration : ${file}`);
      
      try {
        const migration = require(path.join(migrationDir, file));
        // On attend que la fonction exportée par le script s'exécute
        await migration(prisma);
        
        // Enregistrement du succès en base
        await prisma.$executeRaw`
          INSERT INTO "_data_migrations" (name) VALUES (${file})
        `;
        console.log(`✅ ${file} appliquée avec succès.`);
      } catch (error) {
        console.error(`❌ Erreur lors de l'application de ${file}:`, error);
        process.exit(1);
      }
    }
  }
}

run()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

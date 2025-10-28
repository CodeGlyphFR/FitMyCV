import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

// Flag pour savoir si les foreign keys ont été activées
let foreignKeysEnabled = false;

// Créer le client Prisma avec activation des foreign keys pour SQLite
const createPrismaClient = () => {
  const client = new PrismaClient();

  // Activer les foreign keys pour SQLite via une extension Prisma
  // Cela garantit que le PRAGMA est exécuté une fois au démarrage
  return client.$extends({
    query: {
      $allOperations: async ({ operation, model, args, query }) => {
        // Activer les foreign keys une seule fois au premier appel
        if (!foreignKeysEnabled) {
          try {
            await client.$executeRawUnsafe('PRAGMA foreign_keys = ON');
            foreignKeysEnabled = true;
            console.log('[Prisma] Foreign keys activées pour SQLite');
          } catch (error) {
            // Ignorer l'erreur si la DB n'est pas SQLite
            foreignKeysEnabled = true; // Ne pas réessayer
          }
        }

        // Exécuter l'opération d'origine
        return query(args);
      },
    },
  });
};

const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

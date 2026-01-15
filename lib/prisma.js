import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

/**
 * Singleton PrismaClient pour éviter les connexions multiples en développement
 * Prisma 7: Utilise engineType = "library" (Node-API) au lieu du moteur client
 * L'URL de connexion est configurée dans prisma.config.ts
 */
const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

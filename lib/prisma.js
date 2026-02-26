import { PrismaClient } from "@prisma/client";
import { encryptJsonField, decryptJsonField } from "./security/fieldEncryption.js";

const globalForPrisma = globalThis;

// Champs chiffrés par modèle
const CVFILE_ENCRYPTED_FIELDS = ['content', 'pendingChanges', 'jobOfferSnapshot'];
const CVVERSION_ENCRYPTED_FIELDS = ['content'];

/**
 * Chiffre les champs spécifiés dans un objet data (mutation in-place)
 */
function encryptFields(data, fields) {
  if (!data) return;
  for (const field of fields) {
    if (field in data && data[field] !== undefined) {
      data[field] = encryptJsonField(data[field]);
    }
  }
}

/**
 * Déchiffre les champs spécifiés dans un résultat (mutation in-place)
 */
function decryptFields(record, fields) {
  if (!record) return;
  for (const field of fields) {
    if (field in record && record[field] !== undefined) {
      record[field] = decryptJsonField(record[field]);
    }
  }
}

/**
 * Déchiffre un résultat CvFile (+ versions imbriquées si présentes)
 */
function decryptCvFileResult(result) {
  if (!result) return result;
  if (Array.isArray(result)) {
    for (const item of result) decryptCvFileResult(item);
    return result;
  }
  decryptFields(result, CVFILE_ENCRYPTED_FIELDS);
  // Déchiffrer les versions imbriquées (via include)
  if (result.versions && Array.isArray(result.versions)) {
    for (const version of result.versions) {
      decryptFields(version, CVVERSION_ENCRYPTED_FIELDS);
    }
  }
  return result;
}

/**
 * Déchiffre un résultat CvVersion
 */
function decryptCvVersionResult(result) {
  if (!result) return result;
  if (Array.isArray(result)) {
    for (const item of result) decryptFields(item, CVVERSION_ENCRYPTED_FIELDS);
    return result;
  }
  decryptFields(result, CVVERSION_ENCRYPTED_FIELDS);
  return result;
}

/**
 * Crée le PrismaClient étendu avec chiffrement transparent des champs CV
 */
function createExtendedClient(baseClient) {
  return baseClient.$extends({
    query: {
      cvFile: {
        async create({ args, query }) {
          encryptFields(args.data, CVFILE_ENCRYPTED_FIELDS);
          const result = await query(args);
          return decryptCvFileResult(result);
        },
        async update({ args, query }) {
          encryptFields(args.data, CVFILE_ENCRYPTED_FIELDS);
          const result = await query(args);
          return decryptCvFileResult(result);
        },
        async upsert({ args, query }) {
          if (args.create) encryptFields(args.create, CVFILE_ENCRYPTED_FIELDS);
          if (args.update) encryptFields(args.update, CVFILE_ENCRYPTED_FIELDS);
          const result = await query(args);
          return decryptCvFileResult(result);
        },
        async updateMany({ args, query }) {
          encryptFields(args.data, CVFILE_ENCRYPTED_FIELDS);
          return query(args);
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          return decryptCvFileResult(result);
        },
        async findFirst({ args, query }) {
          const result = await query(args);
          return decryptCvFileResult(result);
        },
        async findMany({ args, query }) {
          const result = await query(args);
          return decryptCvFileResult(result);
        },
      },
      cvVersion: {
        async create({ args, query }) {
          encryptFields(args.data, CVVERSION_ENCRYPTED_FIELDS);
          const result = await query(args);
          return decryptCvVersionResult(result);
        },
        async update({ args, query }) {
          encryptFields(args.data, CVVERSION_ENCRYPTED_FIELDS);
          const result = await query(args);
          return decryptCvVersionResult(result);
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          return decryptCvVersionResult(result);
        },
        async findFirst({ args, query }) {
          const result = await query(args);
          return decryptCvVersionResult(result);
        },
        async findMany({ args, query }) {
          const result = await query(args);
          return decryptCvVersionResult(result);
        },
      },
    },
  });
}

/**
 * Singleton PrismaClient pour éviter les connexions multiples en développement
 * Prisma 7: Utilise engineType = "library" (Node-API) au lieu du moteur client
 * L'URL de connexion est configurée dans prisma.config.ts
 */
const prisma = globalForPrisma.prisma ?? createExtendedClient(new PrismaClient());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

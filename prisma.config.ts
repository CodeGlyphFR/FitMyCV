import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Le script gère lui-même la confirmation (auto-confirm en dev, refuse en prod sans --yes)
    seed: 'node prisma/seed.js --yes',
  },
});

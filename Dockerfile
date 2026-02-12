# --- Stage 1: Dépendances ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# --- Stage 2: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# On simule l'environnement pour le build Next.js
RUN cp .env.example .env
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# --- Stage 3: Runner ---
FROM node:20.19-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Indispensable pour que Prisma (moteurs binaires) fonctionne sur Alpine
RUN apk add --no-cache libc6-compat openssl

# --- RÉCUPÉRATION DE L'APPLICATION (MODE STANDALONE) ---
# On copie le contenu du dossier standalone généré par Next.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# --- PRÉPARATION POUR LES MIGRATIONS ---
# On copie le schéma Prisma (nécessaire pour npx prisma migrate deploy)
COPY --from=builder /app/prisma ./prisma

# On récupère le CLI et les moteurs Prisma du builder
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# On s'assure que Prisma a les droits d'exécution
RUN chmod +x ./node_modules/.bin/prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Lancement de l'application (server.js est créé par le mode standalone)
CMD ["node", "server.js"]

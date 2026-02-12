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
# .env.example est nécessaire pour valider le build Next.js
RUN cp .env.example .env
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# --- Stage 3: Runner ---
FROM node:20.19-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Indispensable pour Prisma sur Alpine
RUN apk add --no-cache libc6-compat openssl

# --- RÉCUPÉRATION DE L'APPLICATION (MODE STANDALONE) ---
# On copie le contenu du dossier standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# --- PRÉPARATION POUR LES MIGRATIONS (FIX WASM PRISMA 6) ---
# On copie le dossier prisma (schéma)
COPY --from=builder /app/prisma ./prisma

# CORRECTIF : On copie les dossiers complets au lieu de juste le binaire .bin
# Cela permet au CLI de trouver ses fichiers .wasm internes
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# On crée un lien symbolique propre pour la commande prisma
RUN ln -s /app/node_modules/prisma/build/index.js /usr/local/bin/prisma && chmod +x /usr/local/bin/prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Lancement de l'application
CMD ["node", "server.js"]

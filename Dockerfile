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

RUN cp .env.example .env

ENV NODE_ENV=production

RUN npx prisma generate
RUN npm run build

# --- Stage 3: Runner ---
FROM node:20.19-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# ... (tes autres copies standalone)

# On récupère TOUTE la famille Prisma (le CLI, le Client et les Engines)
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# On s'assure que Prisma a les droits d'exécution
RUN chmod +x ./node_modules/.bin/prisma

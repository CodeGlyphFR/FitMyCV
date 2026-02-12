# --- Stage 1: Dépendances complètes ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# --- Stage 2: Dépendances de PRODUCTION (Prisma 6 + WASM + Effect) ---
FROM node:20-alpine AS production-deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

# --- Stage 3: Build de l'application ---
FROM node:20-alpine AS builder
WORKDIR /app

# 1. On récupère les modules de build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 2. INJECTION DE LA CLÉ RECAPTCHA (Moment crucial)
# Ces variables doivent être présentes PENDANT le 'npm run build'
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY

RUN cp .env.example .env
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# --- Stage 4: Runner (Image finale légère) ---
FROM node:20.19-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Dépendances système pour Prisma sur Alpine
RUN apk add --no-cache libc6-compat openssl

# On récupère les dépendances de prod (pour les migrations et le runtime)
COPY --from=production-deps /app/node_modules ./node_modules

# On récupère le build Next.js Standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
# On force l'écoute sur toutes les interfaces pour Docker
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

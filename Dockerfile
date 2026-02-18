# ============================================================
# Multi-stage Docker build for FitMyCV (Next.js 16 Standalone)
# ============================================================

# --- Stage 1: All dependencies (build + dev) ---
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

# --- Stage 2: Production dependencies only ---
FROM node:20-alpine AS production-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --omit=dev

# --- Stage 3: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public env vars injected at build time (baked into client JS by Next.js)
ARG NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_APP_URL

ENV NEXT_PUBLIC_RECAPTCHA_SITE_KEY=$NEXT_PUBLIC_RECAPTCHA_SITE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Dummy .env for Prisma schema validation during build
RUN cp .env.example .env
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# --- Stage 4: Production runner ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Chromium pour Puppeteer (export PDF + extraction URL) + polices pour le rendu
# GraphicsMagick + Ghostscript pour pdf2pic (conversion PDF → images lors de l'import)
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    chromium \
    font-noto \
    font-freefont \
    graphicsmagick \
    ghostscript

# Puppeteer : utiliser Chromium système au lieu de télécharger le sien
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

# 1. Production node_modules (Prisma CLI, stripe, etc.)
COPY --from=production-deps /app/node_modules ./node_modules

# 2. Next.js standalone server (overlays minimal deps)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 3. Prisma (schema + migrations + data-migrations)
COPY --from=builder /app/prisma ./prisma

# 4. Post-deploy scripts (migrations runner, stripe sync)
COPY --from=builder /app/scripts ./scripts

# 5. Full package.json (needed for npm run scripts)
COPY --from=builder /app/package.json ./package.json

# Créer un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(r.ok)process.exit(0);else process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

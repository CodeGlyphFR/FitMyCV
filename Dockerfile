# 1. Installer tout pour le build
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# 2. Installer uniquement ce qui est nécessaire pour faire tourner l'app et Prisma
FROM node:20-alpine AS production-deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

# 3. Build de l'application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cp .env.example .env
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# 4. Image finale (le Runner)
FROM node:20.19-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat openssl

# On récupère les dépendances de prod (Prisma CLI + Effect inclus)
COPY --from=production-deps /app/node_modules ./node_modules

# On récupère le build Next.js
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

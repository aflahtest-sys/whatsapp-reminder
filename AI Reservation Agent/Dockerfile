FROM node:22-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Install dependencies (including dev deps: prisma CLI, tsx for seeding)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build the Next.js app (standalone output)
FROM base AS builder
# Prisma generate does not need a live DB, only a resolvable datasource URL.
ENV DATABASE_URL="postgresql://queensgarden:queensgarden@db:5432/queensgarden?schema=public"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Runtime image
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

COPY --from=builder /app/public ./public
# Full node_modules keeps prisma CLI + engines + tsx available for migrate/seed at startup.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Migrate + seed (idempotent) then start the standalone server.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node server.js"]

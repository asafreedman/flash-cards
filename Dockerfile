FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first for better layer caching.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run db:generate && npm run build && npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache openssl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma ./prisma

# Keep Prisma CLI available in the runtime image so pipeline migrations can run without npm install.
RUN npm install --no-save prisma@7.9.1

EXPOSE 3000
CMD ["npm", "run", "start"]

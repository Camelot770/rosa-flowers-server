# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src/
COPY prisma ./prisma/

RUN npx prisma generate
RUN npx tsc
# Compile seed separately
RUN npx tsc --esModuleInterop --module commonjs --target es2020 --skipLibCheck --outDir dist-seed prisma/seed.ts

# Stage 2: Production
FROM node:20-alpine

RUN apk add --no-cache openssl sqlite

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/dist-seed ./dist-seed/

RUN mkdir -p /data/uploads/bouquets /data/uploads/constructor /data/uploads/gallery

ENV DATABASE_URL=file:/data/rosa.db

EXPOSE 4000

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist-seed/seed.js && node dist/index.js"]

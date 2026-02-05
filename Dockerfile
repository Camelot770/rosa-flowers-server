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

# Stage 2: Production
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist/
COPY public ./public/

RUN mkdir -p /data/uploads/bouquets /data/uploads/constructor /data/uploads/gallery

EXPOSE 4000

CMD ["node", "dist/index.js"]

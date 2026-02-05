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

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist/
COPY public ./public/

RUN mkdir -p /app/uploads/bouquets /app/uploads/constructor /app/uploads/gallery

EXPOSE 4000

CMD ["node", "dist/index.js"]

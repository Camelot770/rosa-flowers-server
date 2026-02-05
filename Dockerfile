FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY prisma ./prisma/
RUN npx prisma generate

COPY dist ./dist/
COPY public ./public/

RUN mkdir -p /app/uploads/bouquets /app/uploads/constructor /app/uploads/gallery

EXPOSE 4000

CMD ["node", "dist/index.js"]

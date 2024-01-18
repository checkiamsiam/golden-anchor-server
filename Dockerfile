FROM node:18-alpine AS base

# Install dependencies only when needed and build app
FROM base AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package*.json ./

COPY tsconfig*.json ./

RUN npm install --ignore-scripts 

COPY . ./

RUN npx prisma generate

RUN npm run build


# app runner
FROM base AS runner

WORKDIR /app

COPY --from=builder app/dist ./dist

COPY --from=builder app/prisma/schema.prisma ./prisma/schema.prisma

COPY .env ./

COPY package.json ./

ENV NODE_ENV=production

RUN npm install --omit=dev --ignore-scripts 

RUN npx prisma generate

EXPOSE 5000

CMD ["node", "dist/index.js"]  
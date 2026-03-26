# Stage 1: Build dashboard (React/Vite)
FROM node:20-alpine AS dashboard-builder
WORKDIR /app
COPY package.json openapi.json ./
COPY dashboard/package*.json ./dashboard/
WORKDIR /app/dashboard
RUN npm install
COPY dashboard/ ./
RUN npm run build

# Stage 2: Compile TypeScript backend
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY index.ts ./
COPY src/ ./src/
RUN npm run build

# Stage 3: Install production dependencies
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# Stage 4: Production image
FROM node:20-alpine AS production
WORKDIR /app
COPY package.json openapi.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json openapi.json ./dist/
COPY --from=dashboard-builder /app/dashboard/dist ./dashboard/dist
EXPOSE 3000
CMD ["node", "dist/index.js"]

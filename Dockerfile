# Stage 1: Build frontend (Vite SPA)
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY src/ ./src/
COPY public/ ./public/
COPY server/types/ ./server/types/

RUN npx vite build


# Stage 2: Compile backend TypeScript
FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.server.json ./
COPY server/ ./server/

RUN npx tsc --project tsconfig.server.json --outDir dist/server --noEmit false


# Stage 3: Production dependencies (with native better-sqlite3)
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev


# Stage 4: Runtime
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache nginx

# Production node_modules (with native better-sqlite3)
COPY --from=deps /app/node_modules ./node_modules/

# Compiled backend JS
COPY --from=backend-builder /app/dist/server ./server/

# Built SPA
COPY --from=frontend-builder /app/dist /usr/share/nginx/html/

# Nginx config for single-container mode
COPY docker/nginx.production.conf /etc/nginx/nginx.conf

# Entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# package.json needed for ESM module resolution
COPY package.json ./

# Create runtime directories for volumes
RUN mkdir -p /app/data /app/media

ENV NODE_ENV=production
ENV DB_PATH=/app/data/autoblow.db
ENV MEDIA_DIR=/app/media
ENV PORT=3001

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --spider -q http://localhost/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]

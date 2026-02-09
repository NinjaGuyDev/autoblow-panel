# Multi-stage frontend build: Vite build -> nginx Alpine
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy build configuration
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Copy server types (needed by apiClient.ts)
COPY server/types/ ./server/types/

# Build frontend
RUN npm run build

# Production stage with nginx
FROM nginx:1.25-alpine

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# =============================================================================
# Dockerfile — @eln/frontend
#
# Multi-stage build:
#   deps     — install ALL dependencies (dev + prod)
#   builder  — compile shared + vite frontend
#   production — Nginx serving static files with API proxy
# =============================================================================

FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Root manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json turbo.json ./

# Package manifests (all workspace members)
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY --from=deps /app /app

COPY tsconfig.base.json turbo.json ./
COPY apps/frontend ./apps/frontend
COPY packages/shared ./packages/shared

# Build shared first, then frontend
RUN pnpm --filter @eln/shared run build && \
    pnpm --filter @eln/frontend run build

# ---------------------------------------------------------------------------
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom nginx config with API proxy
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend assets from builder
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

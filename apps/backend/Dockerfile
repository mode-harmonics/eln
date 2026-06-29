# =============================================================================
# Dockerfile — @eln/backend
#
# Multi-stage build:
#   deps     — install ALL dependencies (dev + prod)
#   builder  — compile shared + backend
#   production — minimal runtime image with only production deps + dist
# =============================================================================

FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Root manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json turbo.json ./

# Package manifests (all workspace members — pnpm needs the full graph)
COPY apps/backend/package.json apps/backend/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

COPY --from=deps /app /app

COPY tsconfig.base.json turbo.json ./
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

RUN pnpm --filter @eln/shared run build && \
    pnpm --filter @eln/backend run build

# ---------------------------------------------------------------------------
FROM node:20-alpine AS production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Manifests for pnpm workspace resolution
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared/package.json packages/shared/

# Install only production deps — pnpm creates valid symlinks for @eln/shared
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts (NOT node_modules — that would break symlinks)
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

RUN mkdir -p /app/apps/backend/uploads

# Copy entrypoint script
COPY apps/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chown -R appuser:appgroup /app

USER appuser
EXPOSE 3000
ENV NODE_ENV=production

ENTRYPOINT ["/app/docker-entrypoint.sh"]

CMD ["node", "apps/backend/dist/main.js"]

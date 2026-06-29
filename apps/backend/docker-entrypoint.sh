#!/bin/sh
# =============================================================================
# docker-entrypoint.sh — @eln/backend
#
# Runs database migrations (and optionally seeds) before starting the NestJS
# application. Used in the production Docker image.
#
# Environment variables:
#   RUN_SEED  — set to "true" to also execute the seed script (default: false)
# =============================================================================
set -e

echo "→ Running database migrations..."
npx typeorm migration:run -d apps/backend/dist/data-source.js
echo "✓ Migrations complete."

if [ "${RUN_SEED}" = "true" ]; then
  echo "→ Seeding database..."
  node apps/backend/dist/seed.js
  echo "✓ Seed complete."
fi

echo "→ Starting application..."
exec node apps/backend/dist/main.js

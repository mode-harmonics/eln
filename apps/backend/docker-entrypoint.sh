#!/bin/sh
# =============================================================================
# docker-entrypoint.sh — @eln/backend
#
# Runs database migrations and first-administrator initialization before starting the NestJS
# application. Used in the production Docker image.
#
# Environment variables:
#   RUN_SEED  — set to "false" only for an already initialized database
# =============================================================================
set -e

case "${RUN_SEED:-true}" in
  true)
    if [ -z "${ELN_BOOTSTRAP_USERNAME:-}" ] || [ -z "${ELN_BOOTSTRAP_PASSWORD:-}" ]; then
      echo "ELN_BOOTSTRAP_USERNAME and ELN_BOOTSTRAP_PASSWORD are required for initial administrator setup." >&2
      exit 1
    fi
    ;;
  false) ;;
  *) echo "RUN_SEED must be true or false." >&2; exit 1 ;;
esac

echo "→ Running database migrations..."
pnpm --filter @eln/backend run typeorm:run:prod
echo "✓ Migrations complete."

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "→ Initializing administrator..."
  pnpm --filter @eln/backend run seed:prod
  echo "✓ Administrator ready."
fi

echo "→ Starting application..."
exec node apps/backend/dist/main.js

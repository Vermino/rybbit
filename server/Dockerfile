# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder

WORKDIR /app

# Copy and build shared package first
COPY shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# Install server dependencies
WORKDIR /app/server
COPY server/package*.json ./
# Prefer deterministic install; fall back if lockfile is missing/out of sync
RUN npm ci || npm install

# Copy server source code
COPY server/ .

# Build the application
RUN npm run build

# Runtime image
FROM node:20-alpine

WORKDIR /app

# Install PostgreSQL client for migrations
RUN apk add --no-cache postgresql-client

# Copy built application and dependencies
COPY --from=builder /app/server/package*.json ./
COPY --from=builder /app/server/GeoLite2-City.mmdb ./GeoLite2-City.mmdb
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/node_modules ./node_modules
COPY --from=builder /app/server/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/server/public ./public
COPY --from=builder /app/server/src ./src
COPY --from=builder /app/shared ./shared

# Overwrite entrypoint with a sanitized script to avoid CRLF/BOM issues
RUN printf '%s\n' \
    '#!/bin/sh' \
    'set -e' \
    '' \
    'echo "Running database migrations..."' \
    'npm run db:push -- --force' \
    '' \
    'echo "Starting application..."' \
    'exec "$@"' \
    > /docker-entrypoint.sh \
    && chmod +x /docker-entrypoint.sh

# Expose the API port
EXPOSE 3001

# Use our custom entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]

# syntax=docker/dockerfile:1
# Next.js production image for DigitalOcean App Platform.
# Uses Debian Bookworm slim + native libs needed by @napi-rs/canvas
# (libuuid1, fontconfig, freetype) and other native deps.

FROM node:20-bookworm-slim AS base

# System libs needed at both build and runtime for native modules.
# - libuuid1, fontconfig, libfreetype6: @napi-rs/canvas
# - ca-certificates: outbound HTTPS to exchanges, Sentry, Upstash, etc.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libuuid1 \
      fontconfig \
      libfontconfig1 \
      libfreetype6 \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------- deps stage: install with cache ----------
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# ---------- build stage ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Skip Sentry source-map upload during the container build (no auth token here).
# Sentry can still capture runtime errors at request time.
ENV SENTRY_SUPPRESS_INSTRUMENTATION_FILE_WARNING=1
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- runtime stage ----------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--enable-source-maps"

# Copy production artifacts only
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

# Print boot info so we can see which step crashes if it does
RUN echo '#!/bin/sh\nset -e\necho "[boot] Node $(node --version) on $(uname -m)"\necho "[boot] PORT=${PORT} HOSTNAME=${HOSTNAME}"\necho "[boot] starting next start..."\nexec npm start' > /app/start.sh \
 && chmod +x /app/start.sh

EXPOSE 8080
CMD ["/app/start.sh"]

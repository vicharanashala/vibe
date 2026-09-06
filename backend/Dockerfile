FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate && npm install -g rimraf

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
COPY scripts ./scripts
RUN pnpm install

COPY . .
RUN pnpm tsc

FROM node:22-slim

RUN apt-get update && apt-get install -y dumb-init wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY scripts ./scripts

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules

# Tailscale Setup

COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscaled /app/tailscaled
COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscale /app/tailscale
RUN mkdir -p /var/run/tailscale /var/cache/tailscale /var/lib/tailscale

# Cloud Run will automatically handles port binding (TODO: remove this after cloud run deployment)
# EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${APP_PORT}/health || exit 1

CMD ["sh", "/app/scripts/start.sh"]

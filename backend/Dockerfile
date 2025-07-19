FROM node:22-alpine AS builder

RUN apk add --no-cache git
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate && npm install -g rimraf

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
COPY scripts ./scripts
RUN pnpm install

COPY . .
RUN pnpm tsc || echo "TypeScript compilation had errors but continuing build"

ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
RUN if [ -n "$SENTRY_AUTH_TOKEN" ]; then \
    pnpx @sentry/wizard@latest -i sourcemaps --saas --org $SENTRY_ORG --project $SENTRY_PROJECT --auth-token $SENTRY_AUTH_TOKEN --url ./build; \
    fi

FROM node:22-alpine

RUN apk add --no-cache dumb-init git wget

WORKDIR /app

COPY package.json ./
COPY scripts ./scripts
RUN npm install

COPY --from=builder /app/build ./build
COPY --from=builder /app/src/modules ./src/modules
COPY --from=builder /app/scripts/start-backend.sh ./start.sh

# Tailscale Setup

COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscaled /app/tailscaled
COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscale /app/tailscale
RUN mkdir -p /var/run/tailscale /var/cache/tailscale /var/lib/tailscale

RUN /app/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
RUN /app/tailscale up --auth-key=${TAILSCALE_AUTHKEY} --hostname=gcp

ENV ALL_PROXY=socks5://localhost:1055/

ARG APP_PORT

# Cloud Run will automatically handles port binding (TODO: remove this after cloud run deployment)
# EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${APP_PORT}/health || exit 1

CMD ["/app/start.sh"]

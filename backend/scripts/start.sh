#!/bin/sh

if [ -n "${TAILSCALE_AUTHKEY}" ]; then
  /app/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
  /app/tailscale up --auth-key="${TAILSCALE_AUTHKEY}" --hostname=gcp
fi

dumb-init node build/index.js

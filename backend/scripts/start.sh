#!/bin/sh

/app/tailscaled --socks5-server=localhost:1055 &
/app/tailscale up --auth-key=${TAILSCALE_AUTHKEY} --hostname=gcp

ALL_PROXY=socks5://localhost:1055/

dumb-init node build/index.js

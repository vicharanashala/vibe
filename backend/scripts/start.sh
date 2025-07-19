#!/bin/sh

/app/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
/app/tailscale up --auth-key=${TAILSCALE_AUTHKEY} --hostname=gcp
/app/tailscale status

curl http://100.100.108.11:8017/

ALL_PROXY=socks5://localhost:1055/

dumb-init node build/index.js

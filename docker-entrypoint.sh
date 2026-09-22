#!/bin/sh
set -e

STORE_DIR="${SWITCHDRAW_STORE_DIR:-/data/switches}"

mkdir -p "$STORE_DIR"
chown -R node:node "$STORE_DIR"

exec su-exec node "$@"

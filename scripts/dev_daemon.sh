#!/bin/sh
# Start a LOCAL DEV noisy-coding daemon next to the production container.
#
# Production owns the default ports (8765-8767); this daemon takes the dev
# HTTP port below (WS bridge follows automatically on port+1). The MCP
# server needs no port here: register it in stdio mode with the same env —
# see docs/local-development.md. The dashboard is served from
# dashboard/dist, so it is built first when missing.
set -e

DEV_HTTP_PORT="${NOISY_CODING_DEV_HTTP_PORT:-7765}"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

if [ ! -f dashboard/dist/index.html ]; then
    echo "dashboard/dist missing — building the dashboard once…"
    (cd dashboard && npm install && npm run build)
fi

echo "LOCAL DEV daemon → http://127.0.0.1:${DEV_HTTP_PORT}"
NOISY_CODING_LISTENER_PORT="$DEV_HTTP_PORT" \
exec uv run noisy-coding-listener

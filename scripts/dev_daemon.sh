#!/bin/sh
# Start a LOCAL DEV noisy-coding daemon next to the production install.
#
# Production owns the default ports (8765-8767) and the default config dir
# (~/.config/noisy-coding). This daemon takes the dev HTTP port below (WS
# bridge follows automatically on port+1) AND a SEPARATE config dir, so dev
# state (history, conversations, settings, voice claims) never mixes with
# production - two daemons sharing one dir fight over it, last writer wins.
# The MCP server and the hooks need no config dir here: they are dir-
# agnostic and reach the daemon by port. See docs/local-development.md. The
# dashboard is served from dashboard/dist, so it is built first when missing.
set -e

DEV_HTTP_PORT="${NOISY_CODING_DEV_HTTP_PORT:-7765}"
# Isolated from production on disk. Override to point elsewhere; never let it
# fall back to the default dir, or the split becomes port-only and the two
# daemons clobber each other's history.
DEV_CONFIG_DIR="${NOISY_CODING_DEV_CONFIG_DIR:-$HOME/.config/noisy-coding-dev}"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

if [ ! -f dashboard/dist/index.html ]; then
    echo "dashboard/dist missing — building the dashboard once…"
    (cd dashboard && npm install && npm run build)
fi

# First run seeds the dev dir with just the credentials/providers from
# production so voice works without a re-setup; everything else starts empty.
if [ ! -d "$DEV_CONFIG_DIR" ]; then
    mkdir -p "$DEV_CONFIG_DIR"
    for f in credentials.json providers.json; do
        [ -f "$HOME/.config/noisy-coding/$f" ] && cp "$HOME/.config/noisy-coding/$f" "$DEV_CONFIG_DIR/$f"
    done
    echo "seeded new dev config dir $DEV_CONFIG_DIR (credentials/providers only)"
fi

echo "LOCAL DEV daemon → http://127.0.0.1:${DEV_HTTP_PORT}  (config: ${DEV_CONFIG_DIR})"
NOISY_CODING_LISTENER_PORT="$DEV_HTTP_PORT" \
NOISY_CODING_CONFIG_DIR="$DEV_CONFIG_DIR" \
exec uv run noisy-coding-listener

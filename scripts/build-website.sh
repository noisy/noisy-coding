#!/usr/bin/env bash
# Build the marketing website. Rule: synthetic screenshots are ALWAYS
# rebuilt from scratch first, so the site never ships stale renders.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT/scripts/marketing-shots.sh"

# The Vue website (website/) is built AFTER marketing-shots.sh so its
# imported img/generated/ assets are never stale. The static design-concepts
# pages keep referencing img/generated/ directly.
if [ -d "$ROOT/website/node_modules" ]; then
  (cd "$ROOT/website" && npm run build)
else
  (cd "$ROOT/website" && npm install && npm run build)
fi
echo "Synthetic screenshots rebuilt; website built to website/dist."

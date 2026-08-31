#!/usr/bin/env bash
# Build the marketing website. Rule: synthetic screenshots are ALWAYS
# rebuilt from scratch first, so the site never ships stale renders.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$ROOT/scripts/marketing-shots.sh"

# Website build steps go here once the final design gets a real project.
# For now the design-concepts pages reference img/generated/ directly, so
# regenerating the shots is the whole build.
echo "Synthetic screenshots rebuilt; design-concepts pages are current."

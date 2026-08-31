#!/usr/bin/env bash
# Capture every Companion/Marketing story as a marketing PNG.
#
# Builds the dashboard storybook, serves the static build on a free port,
# and screenshots each story with headless Chrome into
# design-concepts/img/generated/<StoryName>.png. Re-run after any widget
# change to refresh the shots.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DASH="$ROOT/dashboard"
OUT="$ROOT/design-concepts/img/generated"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Story ids come from the story title plus the export name. The Companion
# wallpaper shots are ONE story - the combo is selected through story args
# (backdrop + content preset), appended to the URL after the id.
# Format: <output-name>:<story-id-with-optional-&args>:<width>x<height>
WIDGET="synthetic-screenshots-companion--widget"
STORIES=(
  "FixingTestsSpace:$WIDGET&args=backdrop:space;preset:fixing-tests:trim"
  "FixingTestsMesh:$WIDGET&args=backdrop:mesh;preset:fixing-tests:trim"
  "CodeReviewDusk:$WIDGET&args=backdrop:dusk;preset:code-review:trim"
  "CodeReviewSpace:$WIDGET&args=backdrop:space;preset:code-review:trim"
  "LongRefactorMesh:$WIDGET&args=backdrop:mesh;preset:long-refactor:trim"
  "LongRefactorSpace:$WIDGET&args=backdrop:space;preset:long-refactor:trim"
  "AwayFromKeyboardDusk:$WIDGET&args=backdrop:dusk;preset:away-from-keyboard:trim"
  "ShippingSpace:$WIDGET&args=backdrop:space;preset:shipping:trim"
  "TerminalVoiceFix:synthetic-screenshots-companion-over-claude-code--terminal-voice-fix:1200x760"
  "TerminalDiffReview:synthetic-screenshots-companion-over-claude-code--terminal-diff-review:1200x760"
  "TerminalHandsFree:synthetic-screenshots-companion-over-claude-code--terminal-hands-free:1200x760"
  "dashboard-content:synthetic-screenshots-app--content:1600x1000"
)

echo "==> building storybook"
(cd "$DASH" && npm run build-storybook)

# Pick a free port, avoiding the ones the stream setup already uses.
PORT=""
for p in 6890 6891 6892 6893 6894; do
  if ! lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then PORT="$p"; break; fi
done
[ -n "$PORT" ] || { echo "no free port found" >&2; exit 1; }

echo "==> serving storybook-static on port $PORT"
python3 -m http.server "$PORT" --directory "$DASH/storybook-static" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

# Wait for the server to answer.
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:$PORT/iframe.html" >/dev/null && break
  sleep 0.2
done

mkdir -p "$OUT"
for entry in "${STORIES[@]}"; do
  # Split on the FIRST and LAST colon only - the id part may contain
  # colons of its own (story args like backdrop:space).
  name="${entry%%:*}"
  rest="${entry#*:}"
  size="${rest##*:}"
  id="${rest%:*}"
  echo "==> capturing $name ($size)"
  # size "trim": the story frame wraps its content, so capture a generous
  # window and crop away the solid sentinel background around the frame.
  scale=()
  if [ "$size" = "trim" ]; then
    win="1100,900"
    scale=(--force-device-scale-factor=2) # crisp 2x for web use
  else
    win="${size%x*},${size#*x}"
  fi
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size="$win" "${scale[@]}" \
    --screenshot="$OUT/$name.png" \
    --virtual-time-budget=5000 \
    "http://127.0.0.1:$PORT/iframe.html?id=$id&viewMode=story" 2>/dev/null
  if [ "$size" = "trim" ]; then
    python3 - "$OUT/$name.png" <<'PYEOF'
import sys
from PIL import Image, ImageChops
path = sys.argv[1]
img = Image.open(path).convert("RGB")
sentinel = Image.new("RGB", img.size, (1, 2, 3))  # SENTINEL_BG in the story
bbox = ImageChops.difference(img, sentinel).getbbox()
if bbox is None:
    sys.exit(f"{path}: nothing but sentinel - story failed to render")
img.crop(bbox).save(path)
PYEOF
  fi
done

echo "==> done: $OUT"
ls -la "$OUT"

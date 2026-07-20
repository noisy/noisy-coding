#!/bin/sh
# Fail-open bridge between Claude Code hooks and the noisy-coding
# container. Before the container exists (fresh install — setup has not
# run yet) or while it is stopped, hooks must be SILENT: a wall of
# "No such container" errors on every prompt is the worst possible first
# impression. The one thing that must survive intact is the Stop hook's
# rewake contract: exit code 2 with the transcript on stderr.
#
# This script also carries the session title across the container
# boundary: the /rename title lives in the session transcript, a HOST
# file the containerized hooks cannot read. So the title is extracted
# here, host-side, and handed in as NOISY_CODING_SESSION_TITLE. On
# Windows this runs under Git Bash (the Claude Code default shell);
# without Git Bash there is no title and the dashboard falls back to
# the short session id.
#
# Usage: exec.sh <script.py> [ENV_VAR=value]

SCRIPT="$1"
ENV_ASSIGNMENT="$2"

# Buffer stdin: we need to both mine it for transcript_path and forward
# it untouched to the hook inside the container.
INPUT=$(cat)

TRANSCRIPT=$(printf '%s' "$INPUT" | sed -n 's/.*"transcript_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
TITLE=""
if [ -n "$TRANSCRIPT" ] && [ -r "$TRANSCRIPT" ]; then
    TITLE=$(grep -o '"customTitle"[[:space:]]*:[[:space:]]*"[^"]*"' "$TRANSCRIPT" \
        | tail -1 | sed 's/.*:[[:space:]]*"\(.*\)"/\1/')
fi

if [ -n "$ENV_ASSIGNMENT" ]; then
    OUTPUT=$(printf '%s' "$INPUT" | docker exec -i \
        -e "$ENV_ASSIGNMENT" -e "NOISY_CODING_SESSION_TITLE=$TITLE" \
        noisy-coding python3 "/app/hooks/$SCRIPT" 2>&1)
else
    OUTPUT=$(printf '%s' "$INPUT" | docker exec -i \
        -e "NOISY_CODING_SESSION_TITLE=$TITLE" \
        noisy-coding python3 "/app/hooks/$SCRIPT" 2>&1)
fi
CODE=$?

if [ $CODE -eq 2 ]; then
    # Rewake: the voice transcript rides stderr and the 2 wakes the model.
    printf '%s\n' "$OUTPUT" >&2
    exit 2
fi
if [ $CODE -eq 0 ]; then
    # Success: hook JSON (additionalContext / decision) rides stdout.
    printf '%s' "$OUTPUT"
fi
exit 0

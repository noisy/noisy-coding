#!/bin/sh
# Fail-open bridge between Claude Code hooks and the noisy-coding
# container. Before the container exists (fresh install — setup has not
# run yet) or while it is stopped, hooks must be SILENT: a wall of
# "No such container" errors on every prompt is the worst possible first
# impression. The one thing that must survive intact is the Stop hook's
# rewake contract: exit code 2 with the transcript on stderr.
#
# Usage: exec.sh <script.py> [ENV_VAR=value]

SCRIPT="$1"
ENV_ASSIGNMENT="$2"

if [ -n "$ENV_ASSIGNMENT" ]; then
    OUTPUT=$(docker exec -i -e "$ENV_ASSIGNMENT" noisy-coding python3 "/app/hooks/$SCRIPT" 2>&1)
else
    OUTPUT=$(docker exec -i noisy-coding python3 "/app/hooks/$SCRIPT" 2>&1)
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

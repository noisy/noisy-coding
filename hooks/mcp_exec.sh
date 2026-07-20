#!/bin/sh
# stdio MCP launcher: wait for the noisy-coding container, then hand the
# stream to the MCP server inside it.
#
# Why not plain HTTP to :8767? Claude Code connects a plugin's HTTP MCP
# server the moment the plugin loads — on a fresh install that is BEFORE
# the container has started, the connection is refused, and the server
# stays failed until a /reload-plugins or full restart (#12). A stdio
# server is spawned per session and this launcher simply waits out the
# gap, so the race disappears by construction: the worst case is the
# speak tool arriving a few seconds late.
#
# Waits up to ~120 s (docker pull on first setup is slow), checking twice
# a second; exits quietly if the container never appears.

tries=0
until docker exec noisy-coding true 2>/dev/null; do
    tries=$((tries + 1))
    if [ "$tries" -ge 240 ]; then
        echo "noisy-coding container not running" >&2
        exit 1
    fi
    sleep 0.5
done

# The image sets NOISY_CODING_MCP_TRANSPORT=http for its long-running
# server on 8767 — this per-session instance must speak stdio instead.
# CLAUDE_CODE_SESSION_ID rides along so the server knows WHICH session it
# speaks for (#15) — docker exec does not inherit the host environment.
exec docker exec -i \
    -e NOISY_CODING_MCP_TRANSPORT=stdio \
    -e "CLAUDE_CODE_SESSION_ID=${CLAUDE_CODE_SESSION_ID:-}" \
    noisy-coding noisy-coding-mcp

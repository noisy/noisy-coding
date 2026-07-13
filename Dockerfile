# noisy-coding in a box — works on ANY host OS.
#
# The container is hardware-free: all audio flows through the dashboard
# page (the browser tab is the microphone AND the speaker), and the MCP
# server is exposed over streamable HTTP. The host needs nothing but
# Docker and a browser:
#
#   docker compose up -d
#   open http://127.0.0.1:8765        → pick THIS BROWSER TAB (mic + output)
#   claude mcp add --transport http noisy-coding http://127.0.0.1:8767/mcp
#
# Optional Linux-only native audio (host Pulse socket) stays possible —
# see the commented variant in docker-compose.yml.

# --- stage 1: build the Vue HUD ---
FROM node:22-slim AS hud
WORKDIR /build
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# --- stage 2: runtime ---
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

# libportaudio2: sounddevice imports it even when no device ever opens.
# Pulse client libs + mpv only serve the optional Linux native-audio
# variant; the default path never touches them.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libportaudio2 \
        libasound2-plugins \
        libpulse0 \
        mpv \
    && rm -rf /var/lib/apt/lists/* \
    && printf 'pcm.!default { type pulse }\nctl.!default { type pulse }\n' > /etc/asound.conf

WORKDIR /app
COPY pyproject.toml README.md ./
COPY src/ src/
# Editable install keeps sources under /app, so the daemon finds the built
# HUD at /app/dashboard/dist (same repo layout as a dev checkout).
RUN uv pip install --system -e .
COPY --from=hud /build/dist/ dashboard/dist/

# Published ports can't reach loopback-only servers inside a container.
ENV NOISY_CODING_BIND=0.0.0.0 \
    NOISY_CODING_MCP_TRANSPORT=http \
    NOISY_CODING_MCP_BIND=0.0.0.0 \
    NOISY_CODING_NO_AUTOSPAWN=1 \
    NOISY_CODING_OUTPUT_DEVICE=browser
EXPOSE 8765 8766 8767

# Two processes, one box: the listener daemon (HTTP 8765 + tab-audio WS
# 8766) in the background, the MCP server (streamable HTTP 8767) as PID 1.
CMD ["sh", "-c", "noisy-coding-listener & exec noisy-coding-mcp"]

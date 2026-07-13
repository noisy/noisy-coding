# grok-voice listener daemon — Linux-only image.
#
# The daemon needs the HOST's microphone and speakers; on Linux that means
# passing the PulseAudio/PipeWire socket in (see docker-compose.yml). On
# macOS Docker runs in a VM with no host audio — use the native install.

# --- stage 1: build the Vue HUD ---
FROM node:22-slim AS hud
WORKDIR /build
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# --- stage 2: runtime ---
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

# PortAudio for the mic, the ALSA→Pulse bridge + Pulse client libs to reach
# the host's sound server, mpv to play Claude's voice.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libportaudio2 \
        libasound2-plugins \
        libpulse0 \
        mpv \
    && rm -rf /var/lib/apt/lists/* \
    # Route ALSA (what PortAudio speaks) through PulseAudio by default.
    && printf 'pcm.!default { type pulse }\nctl.!default { type pulse }\n' > /etc/asound.conf

WORKDIR /app
COPY pyproject.toml README.md ./
COPY src/ src/
# Editable install keeps sources under /app, so the daemon finds the built
# HUD at /app/dashboard/dist (same repo layout as a dev checkout).
RUN uv pip install --system -e .
COPY --from=hud /build/dist/ dashboard/dist/

# The published port can't reach a loopback-only server inside a container.
ENV GROK_VOICE_BIND=0.0.0.0
EXPOSE 8765

CMD ["grok-voice-listener"]

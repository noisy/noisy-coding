---
description: Start the noisy-coding voice backend (Docker) and walk through first-time setup
---

Set up the noisy-coding voice backend for this user. Follow these steps in order and narrate briefly as you go:

1. Check Docker: run `docker --version`. If missing, tell the user to install Docker Desktop (or the docker engine on Linux) and stop.
2. Check whether the backend already runs: `curl -s -m 2 http://127.0.0.1:8765/status`. If it answers, skip to step 4.
3. Start the backend from the published image (multi-arch, hardware-free — all audio flows through the dashboard page):
   ```
   docker run -d --name noisy-coding \
     -p 127.0.0.1:8765-8767:8765-8767 \
     -v noisy-coding-config:/root/.config/noisy-coding \
     --restart unless-stopped \
     noisy/noisy-coding:latest
   ```
   If the container name already exists, `docker start noisy-coding` instead.
4. Verify the services NON-INVASIVELY — exactly like this, no raw TCP probes:
   - `curl -s http://127.0.0.1:8765/status` must return JSON (the daemon),
   - `docker port noisy-coding` must list 8765, 8766 and 8767 (do NOT `nc -z` port 8766 — a bare TCP open on the WebSocket bridge dumps harmless-but-scary handshake tracebacks into the container logs),
   - the MCP endpoint needs no probe; if you must, know that a plain `curl http://127.0.0.1:8767/mcp` returning `406 Not Acceptable` IS the healthy answer (MCP requires an `Accept: text/event-stream` header).
5. Tell the user to finish in the browser at http://127.0.0.1:8765 —
   - paste their xAI API key when asked (from console.x.ai),
   - click the big amber **ENABLE TAB AUDIO** banner (the container preselects this tab as microphone and speaker; the click grants the mic permission),
   - keep that tab open while talking.
6. CLOSE THE LOOP — do not declare success yet. Ask the user to say when they've pasted the key and clicked the banner, then poll `curl -s http://127.0.0.1:8765/status` and confirm BOTH `"api_key_set": true` AND `"tab_audio": true`. Only then report the setup as complete. If either stays false, debug with the user (key rejected? mic permission denied?).
7. The plugin already registered the MCP server (http://127.0.0.1:8767/mcp) and the voice hooks — remind the user to restart Claude Code once (first install only; without it the speak tool is absent and Claude cannot answer aloud, though the user's speech already comes through). After the restart, messages tagged [VOICE] are the user's real spoken words delivered by this plugin's hooks — see the plugin's voice-conversations skill for the conventions.

Do not configure anything through environment variables — every setting lives in the dashboard UI.

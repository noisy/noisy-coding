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
4. Verify all three services: `curl -s http://127.0.0.1:8765/status` (daemon), and confirm ports 8766 (tab-audio WebSocket) and 8767 (MCP) are listening.
5. Tell the user to finish in the browser at http://127.0.0.1:8765 —
   - paste their xAI API key when asked (from console.x.ai),
   - Settings → MICROPHONE: THIS BROWSER TAB (allow the mic permission),
   - Settings → OUTPUT: THIS BROWSER TAB,
   - keep that tab open while talking.
6. The plugin already registered the MCP server (http://127.0.0.1:8767/mcp) and the voice hooks — remind the user to restart Claude Code (or run /mcp) once, then just talk: their speech reaches Claude even while it works, and Claude answers aloud.

Do not configure anything through environment variables — every setting lives in the dashboard UI.

---
description: Update the noisy-coding voice backend (Docker) to the latest release
---

Update the user's noisy-coding backend. Follow these steps in order and narrate briefly:

1. Check what is running: `docker inspect noisy-coding --format '{{.Config.Image}} {{.Image}}'`. If the container does not exist, stop and point the user at `/noisy-coding:setup` instead.
2. Record the current image digest, then pull: `docker pull noisy/noisy-coding:latest`. If the digest did not change, tell the user they are already on the latest version and stop.
3. Fetch the release notes and tell the user WHY this update is worth it BEFORE recreating anything: `gh api repos/noisy/noisy-coding/releases --paginate -q '.[0:3]'` (or `curl -s https://api.github.com/repos/noisy/noisy-coding/releases`). Quote the **Highlights** sections of the releases newer than what they run — those bullets are written for exactly this purpose. Ask the user to confirm the restart (it cuts any voice conversation for a few seconds).
4. Recreate the container, preserving the config volume (API key, settings, history live there and MUST survive):
   ```
   docker rm -f noisy-coding
   docker run -d --name noisy-coding \
     -p 127.0.0.1:8765-8767:8765-8767 \
     -v noisy-coding-config:/root/.config/noisy-coding \
     --restart unless-stopped \
     noisy/noisy-coding:latest
   ```
5. Verify NON-INVASIVELY, exactly like setup does: `curl -s http://127.0.0.1:8765/status` must return JSON with `"api_key_set": true` (the volume survived). Do NOT probe port 8766 with raw TCP.
6. THE CONTAINER IS ONLY HALF THE SYSTEM — always close with the plugin check, never skip it:
   - Read the installed plugin version (`claude plugin list`) and compare with the version just released. If they differ, UPDATE IT NOW yourself — `claude plugin update noisy-coding@noisy` works from inside the session — and tell the user the one thing you cannot do for them: run `/reload-plugins` (or restart) in every live session, in every Claude profile they use (a second profile needs its own `CLAUDE_CONFIG_DIR=<profile> claude plugin update ...`).
   - If versions match, say so explicitly ("plugin already current — container was the only half to refresh"), so the user never wonders whether a step is missing.
   - Installer users (no plugin): re-run `docker exec -i noisy-coding python3 /app/hooks/install.py --docker` instead when the release notes mention hook changes.
7. Remind the user to reload the dashboard tab (hard refresh — the UI and favicon are served by the new container) and re-click ENABLE TAB AUDIO if the banner reappears.

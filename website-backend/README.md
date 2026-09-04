# website-backend

The demo-token service for the TRY IT LIVE section on the marketing site.
Deliberately SEPARATE from the application: the daemon/app backend must not
be entangled with the website. This service does one thing - it mints
short-lived xAI ephemeral tokens so a visitor's browser can open a Grok
realtime voice session without our API key ever reaching the client.

## Run

```
cd website-backend
npm install
XAI_DEMO_API_KEY=... npm run dev    # port 8788 (DEMO_BACKEND_PORT to change)
```

The website's vite dev server (port 5199) proxies `/api` here, so the
frontend needs no configuration. Without the backend running - or without a
key - the site silently stays on the scripted demo.

## The key

- Env var `XAI_DEMO_API_KEY`, nothing else. Never committed, never logged,
  never echoed in a response. `.env.example` carries the NAME only.
- The server logs only a boolean ("key configured: true/false").

## Endpoint

`POST /api/demo-token` (Origin-checked, CORS for allowed origins only)

- 200: `{ token, expires_at, session: { ws_url, model, max_seconds, instructions } }`
- 503 `{ error: "demo-paused", reason }`: no key, kill switch, daily budget
  exhausted, or upstream trouble - the frontend treats ALL of these as
  "stay scripted", silently.
- 429 `{ error: "rate-limited", reason }`: per-IP concurrent or daily cap.
- 403: origin not allowed.

## Anti-abuse (v1, in-memory)

- Token TTL 120s (mint-side, `expires_after.seconds`); session ceiling 180s
  enforced by the frontend driver (`session.max_seconds`).
- Per IP: 1 concurrent session, 10/day. Global: 200 sessions/day, then
  demo-paused until UTC midnight (circuit breaker).
- Kill switch: `DEMO_PAUSED=1`.
- Origin allowlist: `DEMO_ALLOWED_ORIGINS` (comma-separated, default
  `http://localhost:5199`).
- Turnstile: hook stubbed (`verifyHuman`), not integrated.

## Known gaps / planned

- Turnstile verification (stub in place).
- Prod deploy (serverless or a tiny node service) + the real site origin in
  the allowlist; put a proxy in front and trust XFF only there.
- Persona injection: the agent brief is served by this backend and injected
  by the driver via `session.update`. If/when the xAI mint endpoint supports
  binding session config server-side, move it into the mint call so the
  client cannot alter it.
- Limiter state is in-memory: restarts reset it, one process only.

## Smoke test (no key needed)

```
npm run smoke
```

Verifies: no key -> 503 not-configured, bad/missing origin -> 403, unknown
route -> 404, kill switch -> 503.

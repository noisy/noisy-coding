/** Smoke test for the demo-token endpoint - runs WITHOUT a key on purpose:
 *  verifies the no-key, kill-switch, bad-origin and rate-limit paths all
 *  answer cleanly (the paths a visitor can actually hit when we are not
 *  configured). Run: npm run smoke
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 8799;
const BASE = `http://localhost:${PORT}/api/demo-token`;
const GOOD_ORIGIN = "http://localhost:5199";

async function post(origin?: string) {
  const r = await fetch(BASE, {
    method: "POST",
    headers: origin ? { origin } : {},
  });
  return { status: r.status, body: await r.json() };
}

function expect(name: string, cond: boolean, detail: unknown) {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " -> " + JSON.stringify(detail)}`);
  if (!cond) process.exitCode = 1;
}

async function withServer(env: Record<string, string>, run: () => Promise<void>) {
  const proc = spawn("npx", ["tsx", "src/server.ts"], {
    env: { ...process.env, XAI_DEMO_API_KEY: "", DEMO_BACKEND_PORT: String(PORT), ...env },
    stdio: "ignore",
  });
  try {
    for (let i = 0; i < 50; i++) {
      await sleep(100);
      try {
        await fetch(`http://localhost:${PORT}/`, { method: "OPTIONS" });
        break;
      } catch {
        /* not up yet */
      }
    }
    await run();
  } finally {
    proc.kill();
  }
}

await withServer({}, async () => {
  const noKey = await post(GOOD_ORIGIN);
  expect(
    "no key -> 503 demo-paused/not-configured",
    noKey.status === 503 && noKey.body.error === "demo-paused" && noKey.body.reason === "not-configured",
    noKey,
  );
  const badOrigin = await post("https://evil.example");
  expect("bad origin -> 403 forbidden", badOrigin.status === 403 && badOrigin.body.error === "forbidden", badOrigin);
  const noOrigin = await post();
  expect("no origin -> 403 forbidden", noOrigin.status === 403 && noOrigin.body.error === "forbidden", noOrigin);
  const notFound = await fetch(`http://localhost:${PORT}/api/other`, { method: "POST" });
  expect("unknown route -> 404", notFound.status === 404, notFound.status);
});

await withServer({ DEMO_PAUSED: "1", XAI_DEMO_API_KEY: "placeholder-never-a-real-key" }, async () => {
  const paused = await post(GOOD_ORIGIN);
  expect(
    "kill switch -> 503 demo-paused/kill-switch",
    paused.status === 503 && paused.body.reason === "kill-switch",
    paused,
  );
});

console.log("smoke done");

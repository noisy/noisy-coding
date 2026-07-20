/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// Point `vite dev` at another daemon (e.g. the 7765 dev instance) with
// NOISY_CODING_DAEMON_URL=http://127.0.0.1:7765 npm run dev
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (globalThis as any).process?.env ?? {};
const DAEMON = env.NOISY_CODING_DAEMON_URL ?? "http://127.0.0.1:8765";
// The client always uses relative URLs: same-origin when the daemon serves
// the built app at /next, proxied to the daemon in `vite dev`.
const DAEMON_PATHS = [
  "/status", "/utterances", "/character", "/drain", "/events",
  "/stream", "/pause", "/resume", "/mute", "/mode", "/settings",
  "/voice", "/active-agent", "/devices", "/speak", "/ptt", "/cancel",
  "/interrupt", "/voice-mute", "/credentials", "/dismiss-agent",
  "/reorder-agents",
];

export default defineConfig({
  plugins: [vue()],
  base: "./", // served from /next/ — assets must resolve relatively
  server: {
    proxy: Object.fromEntries(DAEMON_PATHS.map((path) => [path, DAEMON])),
  },
  test: {
    environment: "happy-dom",
  },
});

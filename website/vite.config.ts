import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// The website reuses the dashboard's REAL components (Companion, the
// marketing ClaudeCodeMock) through the @dashboard alias - nothing is
// copied or reimplemented here. If the site ever looks different from the
// product, that is a bug in the site.
const repo = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // GitHub Pages serves a project site from /<repo>/ - the deploy workflow
  // sets PAGES_BASE=/noisy-coding/. Local dev and a future custom domain
  // both use the default "/" (a custom domain needs no base at all).
  base: process.env.PAGES_BASE ?? "/",
  plugins: [vue()],
  // The avatars sprite (public/avatars.png) is resolved at runtime by
  // voiceSprites.ts as an absolute /avatars.png - serve the dashboard's
  // public dir so the same URL works here.
  publicDir: repo("../dashboard/public"),
  resolve: {
    alias: { "@dashboard": repo("../dashboard/src") },
    // Two node_modules trees are in play (website/ and dashboard/); make
    // sure only one Vue instance ever loads.
    dedupe: ["vue"],
  },
  server: {
    port: 5199,
    fs: { allow: [repo("..")] },
    // The demo-token backend (website-backend/, port 8788) is a SEPARATE
    // service - never part of this bundle or the app daemon. When it is
    // not running, the proxy fails and the section silently stays on the
    // scripted demo, which is the intended default.
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.DEMO_BACKEND_PORT ?? 8788}`,
        changeOrigin: false,
      },
    },
  },
});

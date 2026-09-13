import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dashboardPackage from "../dashboard/package.json";
import { fileURLToPath, URL } from "node:url";
import { createRequire } from 'node:module';
const { analyticsConfig } = createRequire(import.meta.url)('../scripts/analytics-config.cjs');

// The website reuses the dashboard's REAL components (Companion, the
// marketing ClaudeCodeMock) through the @dashboard alias - nothing is
// copied or reimplemented here. If the site ever looks different from the
// product, that is a bug in the site.
const repo = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // noisystudio.ai and local development serve from the domain root.
  // PAGES_BASE can override this for GitHub Pages project hosting.
  base: process.env.PAGES_BASE ?? "/",
  plugins: [vue()],
  define: { __APP_VERSION__: JSON.stringify(dashboardPackage.version), __POSTHOG_CONFIG__: JSON.stringify(analyticsConfig()) },
  build: { rollupOptions: { input: { main: repo("./index.html"), demoStudio: repo("./demo-studio/index.html"), dashboardDemo: repo("./dashboard-demo.html") } } },
  // The avatars sprite (public/avatars.png) is resolved at runtime by
  // voiceSprites.ts as an absolute /avatars.png - serve the dashboard's
  // public dir so the same URL works here.
  publicDir: repo("../dashboard/public"),
  resolve: {
    alias: [
      { find: /^.*\/api\/client$/, replacement: repo("../dashboard/src/storybook/daemon.fixture.ts") },
      { find: /^.*\/composables\/useMicStream$/, replacement: repo("../dashboard/src/storybook/mic.fixture.ts") },
      { find: /^.*\/composables\/useBrowserAudio$/, replacement: repo("./src/dashboard-demo/audio.fixture.ts") },
      { find: "@dashboard", replacement: repo("../dashboard/src") },
    ],
    // Two node_modules trees are in play (website/ and dashboard/); make
    // sure only one Vue instance ever loads.
    dedupe: ["vue", "xstate"],
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

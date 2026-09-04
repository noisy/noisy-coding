# noisy-coding website

The marketing site. It renders the REAL product components (Companion, the
marketing terminal mock) from `dashboard/src` through the `@dashboard`
alias - nothing copied, nothing reimplemented.

## Dev

```
npm install
npm run dev        # port 5199
```

## Deploy (GitHub Pages)

Deploys automatically via `.github/workflows/deploy-website.yml` on every
push to `main` that touches `website/` or the dashboard components the site
renders (also runnable by hand: Actions > deploy-website > Run workflow).

- The Pages artifact is EXACTLY `website/dist` - the compiled bundle only.
  No source, no backend, no other repo files are ever served.
- One-time setup: repo Settings > Pages > Source: **GitHub Actions**.
- The build runs with `PAGES_BASE=/<repo>/` because a project Pages site is
  served from that prefix; `vite.config.ts` reads it as `base`. Sourcemaps
  are off (Vite default).
- Portrait sprite note: product code references `/avatars.png` absolutely;
  `App.vue` overrides it with a base-aware Vite asset so portraits work
  under the Pages prefix.

### Custom domain later

1. Settings > Pages > Custom domain (plus the DNS CNAME/A records).
2. Set `PAGES_BASE: /` in the workflow (or remove the env - `/` is the
   default) and redeploy: on a custom domain the site is served from the
   root, so no base prefix.

## TRY IT LIVE (dormant in v1)

The live demo section is feature-flagged off - `TRY_LIVE_ENABLED` in
`src/App.vue`. See `src/demo/live-demo-architecture.md` for how to bring it
back (flag + website-backend with a key). The dormant code tree-shakes out
of the production bundle: the built site makes no `/api` calls.

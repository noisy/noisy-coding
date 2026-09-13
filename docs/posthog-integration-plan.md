# PostHog integration plan

Goal: collect explicit website and Electron usage events in project 607066 (US), in one PR targeting v3-desktop.

Architecture: use posthog-js only on the marketing entry point and posthog-node only in the Electron main process. Each surface asks for optional analytics; source runs and unconfigured builds send nothing. No replay, DOM autocapture, transcripts, audio, file paths, or account credentials are collected. Website and desktop anonymous identities remain separate until the product has a shared login.

- [x] Website: add a consent-controlled analytics adapter, pageview/setup-guide events, preference UI, focused tests, and build configuration. Commit after checks pass.
- [x] Electron: persist the preference and random install ID, capture lifecycle/window events, flush within a bounded shutdown, package the capture configuration, and test disabled/re-enabled/relaunch behavior. Commit after checks pass.
- [ ] Delivery: document the event contract and configuration, wire CI and Pages builds, run focused checks, inspect the diff for capture tokens, and create a single PR.

Configuration: a gitignored analytics.local.json supplies this worktree; CI reads POSTHOG_PROJECT_TOKEN and POSTHOG_HOST. Only the publishable capture token is used. The personal API key and PostHog coding-agent setup are unnecessary for this integration.

Follow-up requirements: Pages base path follows the configured custom domain; desktop events carry app version and production/dev variant; a shared desktop device-exclusion marker and persistent browser exclusion override consent.

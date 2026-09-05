# Interface Redesign Implementation Plan

**Goal:** Replace tactical styling with a coherent, legible desktop product while preserving voice controls.

**Architecture:** Retain the Vue state and API layer. Replace styles in the components that own them; introduce a shared dashboard layout stylesheet for the real app and its marketing fixture. Add isolated full-app Storybook fixtures to exercise the actual handlers without a daemon.

**Tech Stack:** Vue 3, TypeScript, Vite, Storybook 8, Vitest.

## Global constraints

- Use the existing worktree and branch, without changing its base.
- Do not modify other worktrees, the running voice daemon, credentials, or live configuration.
- No additional dependencies, backend features, merge, release, or deployment.
- Keep existing component interfaces and identity routing.

## Tasks

- [x] Install locked dashboard dependencies with `npm ci --no-audit --no-fund`; establish `npm test` baseline; open and screenshot Storybook before implementation.
- [x] Replace `dashboard/src/styles/tokens.css` and `hud.css`; redesign `App.vue`, `HudPanel.vue`, conversation components, tabs, voice controls, and secondary surfaces in their own styles.
- [x] Redesign `Companion.vue`, preserve scrolling/native controls and add explicit state labels; align `CompanionView.vue` and `CompanionFloat.vue` chrome.
- [x] Update Storybook preview and add full-app isolated fixtures and compact states; use real component composition for website/dashboard screenshots.
- [x] Inspect desktop, narrow, constrained-height, overflow, focus, and state fixtures in the connected browser; fix observed problems.
- [x] Run `npm test`, `npm run build`, and `npm run build-storybook` in dashboard; build affected website and inspect desktop integration. Review the final diff and document results.

Results and limits: [verification record](../specs/2026-09-05-interface-redesign-verification.md).

## Review refinements

- [x] Replace the turn-history ring and update its tests, standalone stories, and shared dashboard consumer.
- [x] Match header action sizes and make the development badge prominent at desktop and mobile widths.
- [x] Replace pixel portraits with larger shared voice identities in messages, voice controls, the companion, and Storybook.
- [x] Restore transparent companion surfaces, combine drag instructions with the session header, and preserve scrollable history at the 280 × 200 minimum size.
- [x] Add light, dark, colorful, and minimum-size transparency previews using the actual window component; verify height-only resizing and keyboard history scrolling.
- [x] Re-run frontend tests and affected production builds; record native integration limits.

# Noisy Coding website

Vue/Vite product showcase using the application's graphite tokens, VoiceAvatar and CharacterReadout components through the `@dashboard` alias. Character demo state is local to the page. It never connects to the voice daemon or requests microphone access. The hero renders HeroSceneG using the actual Companion and ClaudeCodeMock on a Mac desktop backdrop. It starts when visible, offers stop/replay controls, and shows a static final scene for reduced motion. The backend/live-audio demonstration and other scene experiments remain dormant.

## Development

Run `npm ci` then `npm run dev` in `website/` (default port 5199). Use `npm run dev -- --port 5201 --strictPort` for an isolated preview when the original checkout is already running.

## Product screenshots

The page imports `src/assets/shots/*.png`. See that directory's README for source stories and capture dimensions. `scripts/marketing-shots.sh` regenerates the Storybook shots and copies the four website assets into that directory. It requires Chrome and Python/Pillow. `scripts/build-website.sh` regenerates them before building the website. Browser tooling can also capture the same stories; inspect rendered output before replacing assets.

## Build and deployment

`npm run build` emits only the static site in `website/dist`. `PAGES_BASE=/noisy-coding/ npm run build` builds for GitHub Pages project hosting. Vite resolves the imported portraits, favicon and screenshots with the configured base.

The existing deploy-website workflow publishes `website/dist` on matching changes to main or v3-desktop. It does not serve source, the daemon, or website-backend. Feature branches are previewed locally and are not deployed by this workflow.

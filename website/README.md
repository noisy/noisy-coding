# Noisy Coding website

Vue/Vite product showcase using the application's graphite tokens, VoiceAvatar and CharacterReadout components through the `@dashboard` alias. Character demo state is local to the page. It never connects to the voice daemon or requests microphone access. The hero renders HeroSceneG using the actual Companion and ClaudeCodeMock on a Mac desktop backdrop. It starts when visible, loops automatically without labels or playback controls, and shows a static final scene for reduced motion. The wallpaper has no outer window frame. The backend/live-audio demonstration and other scene experiments remain dormant.

## Development

Run `npm ci` then `npm run dev` in `website/` (default port 5199). Use `npm run dev -- --port 5201 --strictPort` for an isolated preview when the original checkout is already running.

## Product screenshots

The page imports `src/assets/shots/*.png`. See that directory's README for source stories and capture dimensions. `scripts/marketing-shots.sh` regenerates the Storybook shots and copies the four website assets into that directory. It requires Chrome and Python/Pillow. `scripts/build-website.sh` regenerates them before building the website. Browser tooling can also capture the same stories; inspect rendered output before replacing assets.

## Build and deployment

`npm run build` emits only the static site in `website/dist`. `PAGES_BASE=/noisy-coding/ npm run build` builds for GitHub Pages project hosting. Vite resolves the imported portraits, favicon and screenshots with the configured base.

The existing deploy-website workflow publishes `website/dist` on matching changes to main or v3-desktop. It does not serve source, the daemon, or website-backend. Feature branches are previewed locally and are not deployed by this workflow.

The hero and production CompanionView share `dashboard/src/styles/companion-window.css`. The hero supplies a fixed 420 × 400 window and marks it inert: it demonstrates the resting widget, not hover interactions. Its title-bar row stays reserved but invisible; the real component scrolls overflowing messages inside the available thread space.

## Hero layout comparison

The development preview shows five new hero layouts: `briefing`, `top-aligned`, `caption-side`, `inset`, and `ribbon`. Use `?hero=top-aligned&compare=1` to compare them in production. Top aligned is the selected default; the floating selector appears only while the hero is visible. All layouts keep the same HeroSceneG instance mounted. The previous five layouts have been removed.

All five were checked at 1280px and 390px widths with no horizontal document overflow or browser errors.

## Voice demonstration

`CrewSection.vue` presents the shared `CompanionCrewScene.vue` and its original five xAI recordings. Click a portrait for its scenario beat or Hear the conversation for the full sequence. Audio starts only after a click and mutes when the scene leaves view. Mobile uses a tighter static camera; desktop retains the original handover zooms. The recordings ship as Vite assets and need no runtime API key. This is explicitly a scripted example, not a live microphone session.

## Embedded dashboard

`DashboardShowcase.vue` embeds `dashboard-demo.html`, a second Vite entry that mounts the production dashboard App with Storybook daemon and microphone fixtures. Browser audio is replaced by a local stub, and initial avatars use the human editorial set. The iframe isolates dashboard styles and offers a full-size link. Both HTML entries are shipped by the website build; URLs respect PAGES_BASE.

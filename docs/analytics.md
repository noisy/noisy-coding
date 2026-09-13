# Usage analytics

The marketing website and packaged Electron app use one PostHog project, separated by the `surface` event property (`website` or `desktop`). The current project is [607066 in the US region](https://us.posthog.com/project/607066). Source launches and unconfigured builds send nothing. Packaged production and dev variants can collect usage only after consent.

## What is collected

Analytics is optional. Website visitors choose in the footer; desktop users choose **Share optional usage analytics** in the menu bar. Turning it off stops new captures and discards the local analytics identity. Already delivered events are not deleted. Browser and desktop identities are separate random IDs; no cross-device identity or website-to-install attribution is claimed.

| Surface | Event | Meaning / properties |
| --- | --- | --- |
| Website | `$pageview` | A page visit after consent; URL excludes query string and fragment |
| Website | `installation_guide_opened` | Setup guide clicked; `guide` is `claude_code` or `codex`, not proof of installation |
| Desktop | `analytics_enabled` | User enabled optional usage analytics |
| Desktop | `app_started` | A subsequent application launch with consent already saved |
| Desktop | `daemon_ready`, `daemon_unavailable` | Result of startup daemon resolution |
| Desktop | `dashboard_opened` | User opened or focused the dashboard |
| Desktop | `widget_shown`, `widget_hidden` | Initial widget display or menu-bar visibility action |
| Desktop | `click_through_enabled`, `click_through_disabled` | Click-through setting changed |

Desktop events include app version, build variant (`production` or `dev`), and operating system. No audio, transcripts, messages, file paths, email addresses, API credentials, screen contents or session recordings are collected. Browser autocapture, automatic exceptions, performance capture, surveys and feature flag requests are disabled. The browser adapter strips automatic URL/referrer properties; both SDKs disable GeoIP enrichment. Network requests still reach the analytics provider.

Desktop events use immediate, best-effort delivery; there is no durable offline event queue. Failed delivery is dropped and never blocks the product. Shutdown waits at most the SDK's two-second budget. Returning-user counts cover consenting installations only, not all users. Resetting preferences or reinstalling can produce a new identity.

## Excluding your own usage

Open `https://noisystudio.ai/?analytics=off` once in each browser profile after deployment. This saves a browser exclusion that overrides the consent switch. The footer lets you remove the exclusion explicitly; clearing site data also removes it. The preference is per origin, so repeat it for an old GitHub Pages address if you still use that address.

For desktop, **Exclude this device from analytics (all variants)** writes `noisy-studio-analytics-excluded` in Electron’s shared application-data directory. Both variants check that marker before every event. It applies to this OS user, including applications already running with this integration. Remove it through the same menu to resume eligibility, then opt in separately.

## Build configuration

Set `POSTHOG_PROJECT_TOKEN` to the PostHog **project capture token**, and optionally `POSTHOG_HOST` (defaults to `https://us.i.posthog.com`) in the build environment. Do not use a personal API key. Capture tokens are necessarily embedded in the shipped website and app; they do not grant analytics read or administration access.

For local packaging, the gitignored root `analytics.local.json` can contain `projectToken` and `host`. Environment configuration overrides those values. Keep this file out of logs and commits. Vite reads the configuration during the website build. Electron's `beforePack` hook generates the ignored `desktop/analytics-config.json` and includes it in the application archive. `npm run build:analytics --prefix desktop` can generate it independently.

The Pages workflow obtains its base path from `actions/configure-pages`, so switching to `noisystudio.ai` requires no analytics code change. Page URLs use the current browser origin.

GitHub Pages reads the repository secret `POSTHOG_PROJECT_TOKEN`. This only takes effect after the PR is merged and a website build is deployed. Desktop users need a newly packaged application. No changes to the live daemon are required.

## Agent analysis

Use the official [PostHog MCP](https://posthog.com/docs/model-context-protocol) for analysis, authenticated separately with an authorized user account. The capture token is not sufficient for reading data. This PR does not grant MCP account access or enable PostHog's coding-agent service.

Useful first questions: website visits versus guide clicks; distinct consenting desktop installations by version; startup readiness rate; and returning installations that open the dashboard. Keep browser visitors and desktop installations separate until a shared account or deliberate attribution flow exists.

## Verification

Run website tests, `typecheck:analytics`, the website build, and desktop tests. A production preview uses the configured project only after explicit consent, so use a test project when exercising real event delivery. Confirm events in PostHog before treating a successful ingestion response as proof of reporting. Full website type checking currently reports pre-existing shared Vue ref-type errors and a missing application-version declaration.

## Website engagement funnel

The starter dashboard is extended in place. Website metrics must filter `surface = website` and the production `$current_url = https://noisystudio.ai/`, excluding local previews and validation events. Counts represent consenting, non-excluded browser IDs, not all visitors or identified people.

| Event | Dimensions | Meaning |
| --- | --- | --- |
| `page_scrolled` | — | First scroll below the top, once per page load |
| `scroll_depth_reached` | `depth_percent`: 25, 50, 75, 90, 100 | Bottom of viewport reaches the percentage of document height, once per threshold per load |
| `video_demo_interacted` | `demo`: hero/crew; `action`: play/pause/mute/unmute | Deliberate control click; autoplay and automatic visibility pauses do not count |
| `get_started_clicked` | `placement`: header/hero | Existing link to the installation section; setup intent |
| `download_clicked` | `platform`: mac/windows/linux; `placement`: header/hero/install | Reserved for a real release download link |

Call `websiteAnalytics.trackDownload(platform, placement)` in the future download link's click handler. There is currently no release download link in this branch; setup-guide links and Get started links must not emit `download_clicked`. A download click is not proof of download completion or installation.

Use unique users for reach; total event counts for repeat control usage. The core funnel is pageview → Get started (one-day conversion window). Show scroll reach and hero/crew interaction separately: visitors need not scroll or watch a demo before converting. When downloads ship, add pageview → download_clicked as the main conversion funnel. Scroll depth measures reach, not proof that text was read; anchor navigation can cross several thresholds. Pre-consent activity is not replayed. On a subsequent consented scroll, current viewport depth is measured.

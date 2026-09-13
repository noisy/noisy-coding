# Noisy Studio: technical rename and upgrade risks

The product and GitHub repository are now Noisy Studio. The website lives at
https://noisy.github.io/noisy-studio/. This second change renames Python package
and import paths, CLI commands, plugin/marketplace identifiers, MCP server names,
private npm packages, the bundled daemon executable, and repository references.

## Compatibility retained

- New CLI commands are `noisy-studio-mcp`, `noisy-studio-listener`, and
  `noisy-studio-mobile`. Their `noisy-coding-*` aliases call the same new modules.
- Python imports now use `noisy_studio`. There is no `noisy_coding` import alias:
  external Python callers must update their imports. Avoid two module identities
  for the same mutable daemon state.
- `NOISY_STUDIO_*` variables take precedence over `NOISY_CODING_*` when present,
  including an explicitly empty value. The old prefix remains a fallback. Hooks
  use the same stdlib reader as the daemon. Development scripts and desktop config
  overrides accept their corresponding old variables as well.
- Both old/new MCP prefixes are accepted by identity-sensitive hook matching.
- The Codex installer accepts both ownership markers and preserves an existing
  marker, so updating a legacy settings file does not prevent its old installer
  from recognizing it. Unrelated settings remain intact.
- On-disk `.config/noisy-coding*` directories, Electron profile directories,
  bundle IDs, `noisy-coding.*` browser keys, Docker service/container/volume names,
  and the existing MCP registry identity stay unchanged. No data is moved or deleted.
- Existing checkout directories and running installations are not modified.

## Risk assessment

| Change | Risk | Failure mode and mitigation |
| --- | --- | --- |
| Plugin IDs, marketplace ID, MCP registration names | **HIGH** | An installed plugin does not become a differently named plugin through a normal update. Installing both can duplicate hooks; switching before upgrading the daemon can lose identity matching. Upgrade the daemon first, replace the old plugin, reload hooks and restart affected sessions. |
| Python distribution and import namespace | **HIGH for Python callers**, medium for CLI users | `import noisy_coding` no longer works. Update callers to `noisy_studio`. The new distribution retains all three old CLI entry points. Use a clean/synchronized environment; uninstalling a co-installed old distribution could remove shared console-script names. |
| Frozen daemon filename | **MEDIUM** | A shell-only update with an old daemon binary fails to launch. Rebuild the daemon and shell together; distribute a complete application bundle. |
| Environment prefix | **MEDIUM** | Conflicting old/new values can select a different endpoint or config directory. New wins, old remains fallback. Avoid setting both during rollout unless the precedence is intentional. |
| Docker publication under two names | **MEDIUM** | Release credentials must be able to publish `noisy/noisy-studio` as well as the old repository; publication is not transactional. A failure can leave only one tag updated. Verify both destinations before announcing a release. Existing Compose/install flows keep pulling the old image until the new coordinate is available. |
| Private npm package names and GitHub links | **LOW** | No public npm packages are replaced. Lockfile root names change together. Pages continues deriving its base from the repository name. |
| Persistent and OS identities | **LOW in this PR** | Their legacy spelling is deliberate: renaming them could hide saved data, create new volumes, split concurrent writes, or reset OS permissions. They are not migrated here. |

## Rollout order

1. Publish a release containing the new daemon package and both-prefix identity
   matching. Keep the old Docker image coordinate and CLI aliases available.
2. For desktop installs, rebuild and install the whole app, including
   `noisy-studio-daemon`. Keep the same bundle ID and profile location.
3. Stop/reload existing agent sessions when replacing the plugin. For Claude Code,
   remove `noisy-coding@noisy`, refresh the `noisy` marketplace from
   `noisy/noisy-studio`, then install `noisy-studio@noisy`. For Codex, remove
   `noisy-coding@noisy-coding`, add/refresh the marketplace from
   `noisy/noisy-studio`, then add `noisy-studio@noisy-studio`.
4. Do not run old and new plugin hooks concurrently. Re-run the integration setup
   for the intended daemon port and review the newly named hooks. Existing Codex
   settings remain in `.config/noisy-coding/codex.json`.
5. Complete a spoken round trip in each supported host before relying on the new
   registration. Old-only daemons must not serve new-name plugins.

Merging code does not perform these release or local migration steps. The legacy
MCP registry entry and third-party listing URLs stay until publication is separately
coordinated; merely changing their names would advertise nonexistent registrations.
The Docker Hub badge and existing install commands intentionally use the old image.

## Rollback

Restore the complete previous daemon/app release and the previous plugin together.
Remove the new plugin registration before restoring the old one. Unset new-prefix
variables when reverting to a release that only reads the old prefix. Stored data
and ownership markers have not moved, so no reverse data migration is needed.
A standalone Python caller must also revert its imports/environment coherently.

## Media carried from the first PR

The two renamed scripted lines use `studio-greet` and `studio-script-1`, with the
existing browser speech fallback until replacement clips are added. Website
screenshots use the new branding. The two unreferenced historical documentation
captures, `docs/img/desktop-dashboard.png` and `docs/img/companion-desktop-dock.png`,
retain their original pixels. Existing ticket contents and captured JSONL session
fixtures remain unchanged.

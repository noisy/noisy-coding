# Noisy Studio technical rebrand

Goal: finish the code and integration rename in a separate PR against v3-desktop.

## Implementation

- Rename the Python distribution/module, CLI commands, bundled daemon, npm metadata,
  plugin manifests/skill directory, MCP registrations, repository links and Pages examples.
- Retain legacy CLI entry points. Add one stdlib environment accessor that reads the
  canonical NOISY_STUDIO variable first and falls back to NOISY_CODING. Hooks load
  the same accessor from the plugin source tree without third-party dependencies.
- Accept both MCP prefixes and both installer ownership markers. Require explicit
  plugin replacement/reload; do not register two parallel sets of hooks.
- Preserve on-disk config/profile names, browser storage keys, Docker container and
  volume identities. Publish both Docker image names on future releases; continue
  consuming the established image until the new image is available.
- Update version tooling and the lockfile together with Python metadata.
- Exercise compatibility at its boundary, run existing Python/harness/hook, dashboard,
  website and desktop suites, and build package/frontend artifacts.
- Commit coherent increments. Put risk levels, impact, mitigation and rollout/rollback
  requirements in the PR, without test-result sections.

## Risk decisions

HIGH: plugin identity changes require reinstall/reload and old-only daemons must
be upgraded before new MCP prefixes are used. Python import callers must migrate.
MEDIUM: environment precedence, package/CLI/binary paths, dual Docker publication.
LOW: repository links and private npm names. Persistent identities intentionally
retain their legacy spelling to avoid data migration, permission resets and split state.

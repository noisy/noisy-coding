---
name: creating-releases
description: How to cut a noisy-coding release — version bump, tag, GitHub release via gh, and above all HOW TO WRITE the release notes (agent-quotable Highlights, pain-first framing, upgrade notes derived from what changed). Repo-local skill for maintainers; use whenever asked to release, publish a version, or write release notes.
---

# Creating releases

Releases here are cut with `gh` from the CLI — never the GitHub web UI —
and the notes are a PRODUCT SURFACE, not a changelog dump: a future
daemon/agent will quote them verbatim to convince users to upgrade
(that's the plan behind the VersionBadge and #18). Write them for that
reader.

## Mechanics (in order)

1. `python3 scripts/bump_version.py X.Y.Z` — keeps the four version files
   in sync (pyproject, uv.lock, dashboard/package.json, plugin.json);
   NEVER bump by hand, drift once shipped a stale plugin (issue #7).
2. Commit the bump (`chore: release vX.Y.Z`), tag `vX.Y.Z`, push both:
   `git push origin main vX.Y.Z`.
3. `gh release create vX.Y.Z -R noisy/noisy-coding --title "…" --notes "…"`.
4. The tag triggers the release workflow (verify-version gate + Docker
   image with provenance). Watch it (`gh run list --workflow=release`)
   and confirm the tag appears on Docker Hub BEFORE telling the user to
   update — the image takes ~3-4 min; the marketplace needs no build.
5. Then follow the `after-production-release` skill: spoken one-liner +
   minimal refresh checklist derived from what changed.

## Version number

- PATCH — fixes, invisible changes.
- MINOR — anything the user can see or a new capability; big visible UI
  batches are MINOR too (2.8.0 was a UI overhaul).
- Krzysztof calls the number; suggest one, don't tag until he says.

## Release notes — the format that matters

```
## Highlights

> The section an upgrade-nudging agent should quote.

- **One bold sentence naming what changed for the USER.** Then 1–3
  sentences: the pain that existed, what happens now. Write pain-first —
  "X used to happen; now Y" beats a feature list.

## Also in this release

- Smaller items, one line each. Real changes only — no refactor noise.

## Upgrade notes

- Derived from WHAT CHANGED (see after-production-release): container
  only / plugin only / both halves — with the exact commands, and the
  warning that one half without the other leaves cross-boundary bugs
  alive when both changed.
```

Rules of thumb learned in practice:

- **Title** = the release's one idea, lowercase-poetic is fine
  ("the dashboard grows a face", "replies stay in their own
  conversation").
- Highlights are ranked: the item an agent should mention FIRST goes
  first. One highlight is fine for a patch; 3–4 max even for a big one.
- Name the user-visible failure honestly ("transcripts hung on
  'awaiting'", "your words landed in the wrong thread") — credibility is
  the point of the notes.
- If a release supersedes broken ones, say so bluntly ("Skip 2.7.3/2.7.4;
  2.7.5 is the one that works").
- End with the standard Claude Code attribution footer.
- Human touches survive review — "hand-tuned by eye" credit lines are
  welcome, not noise.

## Gotchas

- `latest` on Docker Hub is overwritten per push — never re-release the
  same tag after a bad build; bump again instead (the 2.7.4→2.7.5
  lesson).
- A release that changes hooks/ or the MCP launcher needs BOTH the image
  and the plugin updated on user machines — call it out or the fix stays
  half-dead (the 2.7.6 lesson: plugins 2.7.5 + daemon 2.7.6 still
  misrouted).
- Nothing from `issues-drafts/` (gitignored) or `.claude/skills/`
  (repo-local) ships in a release; `skills/` and `commands/` at the repo
  root DO ship with the plugin.

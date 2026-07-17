#!/usr/bin/env python3
"""Bump the project version in every file that carries it, in one shot.

The version lives in four places that must never drift apart:
pyproject.toml, uv.lock, dashboard/package.json and .claude-plugin/plugin.json.
Bumping them by hand is how .claude-plugin/plugin.json fell three releases
behind (issue #7). Run this instead:

    python scripts/bump_version.py 2.6.1

The release workflow re-checks consistency against the git tag, so a stale
file fails the build rather than shipping silently.
"""

from __future__ import annotations

import re
import sys
import tomllib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


def read_current_version() -> str:
    pyproject = tomllib.loads((REPO_ROOT / "pyproject.toml").read_text())
    return pyproject["project"]["version"]


def bump_pyproject(new_version: str) -> None:
    path = REPO_ROOT / "pyproject.toml"
    text = path.read_text()
    text = re.sub(
        r'^version = "[^"]+"',
        f'version = "{new_version}"',
        text,
        count=1,
        flags=re.MULTILINE,
    )
    path.write_text(text)


def bump_uv_lock(new_version: str) -> None:
    path = REPO_ROOT / "uv.lock"
    text = path.read_text()
    text = re.sub(
        r'(\[\[package\]\]\nname = "noisy-coding"\nversion = )"[^"]+"',
        rf'\1"{new_version}"',
        text,
        count=1,
    )
    path.write_text(text)


def bump_json_version(relative_path: str, new_version: str) -> None:
    # Surgical edit of the "version" line only — rewriting the whole file
    # through json.dumps would reflow indentation and inline objects that
    # these hand-maintained files rely on.
    path = REPO_ROOT / relative_path
    text = path.read_text()
    new_text, count = re.subn(
        r'"version": "[^"]+"',
        f'"version": "{new_version}"',
        text,
        count=1,
    )
    if count != 1:
        raise SystemExit(f"error: no \"version\" field found in {relative_path}")
    path.write_text(new_text)


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <new-version>", file=sys.stderr)
        return 2

    new_version = sys.argv[1].lstrip("v")
    if not SEMVER.match(new_version):
        print(f"error: '{new_version}' is not a X.Y.Z semver", file=sys.stderr)
        return 2

    current = read_current_version()
    bump_pyproject(new_version)
    bump_uv_lock(new_version)
    bump_json_version("dashboard/package.json", new_version)
    bump_json_version(".claude-plugin/plugin.json", new_version)

    print(f"bumped {current} -> {new_version} in pyproject.toml, uv.lock, "
          "dashboard/package.json, .claude-plugin/plugin.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

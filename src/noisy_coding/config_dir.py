"""Single source of truth for the on-disk config directory.

Every persistent file (API key, settings, character, history, session map,
rewake locks) lives under CONFIG_DIR. Defining it once keeps the readers in
sync and gives the rename a single place to migrate the old location from.
"""

from pathlib import Path

CONFIG_DIR = Path.home() / ".config" / "noisy-coding"
_LEGACY_CONFIG_DIR = Path.home() / ".config" / "grok-voice"


def migrate_legacy_config_dir() -> None:
    """Carry the user's data across the grok-voice -> noisy-coding rename.

    The directory holds the xAI API key, settings and conversation history —
    losing it would force a re-setup — so on first startup under the new name
    we move the old directory into place if it exists and the new one does not.
    """
    if _LEGACY_CONFIG_DIR.exists() and not CONFIG_DIR.exists():
        CONFIG_DIR.parent.mkdir(parents=True, exist_ok=True)
        _LEGACY_CONFIG_DIR.rename(CONFIG_DIR)

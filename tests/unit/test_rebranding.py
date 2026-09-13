import importlib.util
from pathlib import Path

import pytest

from noisy_studio.environment import getenv
from noisy_studio.harness.hook_common import is_identity_tool


@pytest.mark.parametrize(
    "modern,legacy,expected",
    [("9765", "7765", "9765"), (None, "7765", "7765"), ("", "7765", ""), (None, None, "8765")],
)
def test_environment_prefers_new_names_and_preserves_legacy_settings(monkeypatch, modern, legacy, expected):
    for name, value in [("NOISY_STUDIO_LISTENER_PORT", modern), ("NOISY_CODING_LISTENER_PORT", legacy)]:
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)

    assert getenv("NOISY_STUDIO_LISTENER_PORT", "8765") == expected


@pytest.mark.parametrize("tool", [
    "mcp__noisy-coding__speak", "mcp__noisy-studio__speak",
    "mcp__noisy_coding__announce", "mcp__noisy_studio__announce",
    "mcp__plugin_noisy-studio_noisy-studio__set_speaker_style",
])
def test_identity_tools_accept_old_and_new_plugin_registrations(tool):
    assert is_identity_tool(tool)


def test_installer_updates_legacy_owned_settings_without_changing_ownership(tmp_path):
    import json

    spec = importlib.util.spec_from_file_location("rebrand_installer", Path(__file__).parents[2] / "scripts/install_codex.py")
    installer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(installer)
    config = tmp_path / "codex.json"
    config.write_text(json.dumps({"managed_by": "noisy-coding", "port": 7765, "custom": "retained"}))

    installer.configure_file(config, port=9765)

    assert json.loads(config.read_text()) == {
        "managed_by": "noisy-coding", "port": 9765, "custom": "retained",
        "listen_seconds": 3600, "agent_label": "Codex",
    }

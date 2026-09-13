"""Load the shared stdlib settings reader from a plugin checkout or Docker image."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from noisy_studio.environment import getenv  # noqa: E402, F401

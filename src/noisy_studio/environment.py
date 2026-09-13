"""Read renamed settings without disconnecting existing installations."""

import os


def getenv(name: str, default=None):
    value = os.environ.get(name)
    if value is not None:
        return value
    if name.startswith("NOISY_STUDIO_"):
        return os.environ.get(name.replace("NOISY_STUDIO_", "NOISY_CODING_", 1), default)
    return default

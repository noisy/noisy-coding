# Freeze the daemon into one binary the app can carry.
#
# The desktop app must not require Python: a user downloads one thing, and
# the engine rides inside it. PyInstaller bundles the interpreter and every
# dependency into a single executable, spawned by the shell on 9765.
#
# Build:  .venv/bin/pyinstaller desktop/daemon.spec --distpath desktop/build/daemon
import sys
from pathlib import Path

ROOT = Path.cwd()

a = Analysis(
    [str(ROOT / "src" / "noisy_coding" / "listener" / "__main__.py")],
    pathex=[str(ROOT / "src")],
    binaries=[],
    datas=[
        # The built dashboard travels with the daemon - it serves these
        # files at /next/, and the app's windows load them from there.
        (str(ROOT / "dashboard" / "dist"), "dashboard/dist"),
    ],
    hiddenimports=[
        # Imported dynamically or through plugin machinery, so the static
        # analysis does not see them.
        "sounddevice",
        "_sounddevice_data",
        "webrtcvad",
        "httpx",
        "anyio",
        "certifi",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "PyQt5", "PySide6"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="noisy-coding-daemon",
    debug=False,
    strip=False,
    upx=False,
    console=True,
)

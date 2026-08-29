"""Entry point for the frozen daemon.

A console_script cannot be frozen - PyInstaller needs a real module to
start from. `python -m noisy_coding.listener` works the same way, so this
serves both the frozen binary and anyone who prefers it to the script.
"""

from noisy_coding.listener.daemon import main

if __name__ == "__main__":
    main()

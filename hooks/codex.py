#!/usr/bin/env python3
"""Compatibility shim -> codex_hook (see hooks/codex_hook.py). Remove in phase 6."""

import os
import runpy
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "codex_hook.py"),
               run_name="__main__")

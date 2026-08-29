# Desktop shell

A window around the companion widget (`/companion?transparent=1`). The
daemon stays in Python; this only provides what a browser cannot:
transparency, always-on-top, click-through, no frame.

    cd desktop && npm install && npm start          # against the daemon on 7765
    npm run start:dev                               # against vite on 5173

Point it anywhere with `NOISY_COMPANION_URL`.

- **Click-through** toggles from the menu-bar icon or `Ctrl+Alt+G`. The
  shortcut matters: once clicks pass through, the window cannot be clicked
  to turn it off again.
- **No dock icon.** It lives in the menu bar.

Not done yet: signing and notarisation (needed only to hand a build to
someone else), remembering window position, auto-update, and the tray
artwork. Windows and Linux need their own checks - transparency on Linux
depends on the compositor, and Wayland may refuse always-on-top.

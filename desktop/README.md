# Desktop shell

Electron supplies the companion window, Dock and menu-bar integration. The daemon stays in Python and serves the dashboard.

## Run modes

- `npm start`: production mode; starts the bundled daemon.
- `npm run start:dev` or `npm run local`: local development mode; attaches to an existing daemon and Vite server, without starting or stopping either.
- `NOISY_LOCAL_UI` sets the local UI URL (default `http://localhost:5173`); `NOISY_LOCAL_PORT` sets the local daemon port (default `7765`).
- Packaged development builds bake in local mode and have a separate application ID and product name.

## Application identity

Both Dock and menu-bar icons use the redesigned four-bar waveform.

| Mode | Dock | macOS menu bar |
|---|---|---|
| Production | Blue on slate | Monochrome template, adapts to light/dark system appearance |
| Local / development | Amber on warm graphite | Amber, explicitly not a template |

The runtime also sets the Dock image, so starting from source does not show the generic Electron logo. Both runtime PNGs and the loader are included in packaged apps. Menu-bar assets have 22 px and 44 px Retina variants. Each ICNS contains the full macOS icon size set.

Edit the SVG sources in `build/`, then run `npm run build:icons`. This requires macOS `iconutil` and `rsvg-convert` (`brew install librsvg`). PNGs and ICNS are committed; distribution scripts rebuild them before packaging. Run `npm test` to check mode selection, packaged resource declarations and generated formats.

## Build

- `npm run dist`: build icons, UI and daemon, then package the production app.
- `npm run dist:dev`: rebuild icons and package the development variant using existing daemon resources.
- `npm run dmg`: rebuild icons and package using existing UI/daemon resources.

Click-through is available from the menu bar or `Ctrl+Alt+G`. The Dock icon stays visible while the app runs. Signing, notarisation and platform-specific Windows/Linux checks remain separate distribution work.

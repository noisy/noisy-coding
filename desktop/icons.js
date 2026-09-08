const path = require('node:path');

/** Local mode has its own identity, even when running an unpackaged Electron. */
function loadDesktopIcons(mode, nativeImage) {
  const development = mode === 'local';
  const image = name => nativeImage.createFromPath(path.join(__dirname, 'build', name));
  const dockIcon = image(development ? 'icon-dev.png' : 'icon.png');
  const trayIcon = image(development ? 'trayDev.png' : 'trayTemplate.png');
  // macOS adapts the production mask; preserving dev color distinguishes instances.
  trayIcon.setTemplateImage(!development);
  return { dockIcon, trayIcon };
}

module.exports = { loadDesktopIcons };

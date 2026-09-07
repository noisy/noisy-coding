// Rebuild the committed PNG/ICNS assets from their SVG sources on macOS.
const { execFileSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const build = path.resolve(__dirname, '../build');

function render(source, destination, size) {
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', destination, source]);
}

for (const name of ['icon', 'icon-dev']) {
  const source = path.join(build, `${name}.svg`);
  const iconset = path.join(build, `${name}.iconset`);
  mkdirSync(iconset, { recursive: true });
  render(source, path.join(build, `${name}.png`), 1024);
  for (const size of [16, 32, 128, 256, 512]) {
    render(source, path.join(iconset, `icon_${size}x${size}.png`), size);
    render(source, path.join(iconset, `icon_${size}x${size}@2x.png`), size * 2);
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(build, `${name}.icns`)]);
}
for (const [source, name] of [['tray.svg', 'trayTemplate'], ['tray-dev.svg', 'trayDev']]) {
  render(path.join(build, source), path.join(build, `${name}.png`), 22);
  render(path.join(build, source), path.join(build, `${name}@2x.png`), 44);
}
console.log('Built production and development Dock and menu-bar icons.');

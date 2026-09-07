const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadDesktopIcons } = require('./icons');
const manifest = require('./package.json');

for (const [mode, dock, tray, template] of [
  ['production', 'icon.png', 'trayTemplate.png', true],
  ['local', 'icon-dev.png', 'trayDev.png', false],
]) {
  test(`${mode} selects the matching Dock and menu-bar identity`, () => {
    const nativeImage = { createFromPath(file) {
      assert.ok(fs.existsSync(file), file);
      return { file, setTemplateImage(value) { this.template = value; } };
    } };
    const icons = loadDesktopIcons(mode, nativeImage);
    assert.deepEqual({ dock: path.basename(icons.dockIcon.file), tray: path.basename(icons.trayIcon.file), template: icons.trayIcon.template }, { dock, tray, template });
  });
}

test('runtime Dock images and the loader are included in packaged applications', () => {
  for (const file of ['icons.js', 'build/icon.png', 'build/icon-dev.png']) assert.ok(manifest.build.files.includes(file), file);
});

for (const name of ['trayTemplate', 'trayDev']) {
  test(`${name} supplies both standard and Retina sizes`, () => {
    const dimensions = ['', '@2x'].map(suffix => {
      const png = fs.readFileSync(path.join(__dirname, 'build', `${name}${suffix}.png`));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      return [png.readUInt32BE(16), png.readUInt32BE(20)];
    });
    assert.deepEqual(dimensions, [[22, 22], [44, 44]]);
  });
}

test('production and development ship distinct macOS application icons', () => {
  const icons = ['icon', 'icon-dev'].map(name => fs.readFileSync(path.join(__dirname, 'build', `${name}.icns`)));
  for (const icon of icons) {
    assert.equal(icon.subarray(0, 4).toString(), 'icns');
    assert.equal(icon.readUInt32BE(4), icon.length);
  }
  assert.equal(icons[0].equals(icons[1]), false);
});

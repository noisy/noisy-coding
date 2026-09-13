const fs = require('node:fs');
const path = require('node:path');
const { analyticsConfig } = require('../../scripts/analytics-config.cjs');

module.exports = async function prepareAnalytics(context) {
  // electron-builder's beforePack context carries `packager` (with
  // `projectDir`, the directory the `files` list is read from), not an
  // `appDir`; the old field was undefined and the pack step threw
  // "The path argument must be of type string" (first seen packaging
  // 3.0.0-alpha.1). The file is listed in package.json "files".
  const projectDir = (context.packager && context.packager.projectDir) || path.resolve(__dirname, '..');
  fs.writeFileSync(path.join(projectDir, 'analytics-config.json'), JSON.stringify(analyticsConfig()));
};

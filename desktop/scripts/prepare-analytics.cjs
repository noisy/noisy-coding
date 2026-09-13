const fs = require('node:fs');
const path = require('node:path');
const { analyticsConfig } = require('../../scripts/analytics-config.cjs');

module.exports = async function prepareAnalytics(context) {
  fs.writeFileSync(path.join(context.appDir, 'analytics-config.json'), JSON.stringify(analyticsConfig()));
};

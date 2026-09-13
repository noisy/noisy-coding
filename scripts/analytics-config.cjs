const fs = require('node:fs');
const path = require('node:path');

function analyticsConfig() {
  const localPath = path.join(__dirname, '..', 'analytics.local.json');
  const local = fs.existsSync(localPath) ? JSON.parse(fs.readFileSync(localPath, 'utf8')) : {};
  return {
    projectToken: process.env.POSTHOG_PROJECT_TOKEN || local.projectToken || '',
    host: process.env.POSTHOG_HOST || local.host || 'https://us.i.posthog.com',
  };
}

if (require.main === module) {
  fs.writeFileSync(path.join(__dirname, '..', 'desktop', 'analytics-config.json'), JSON.stringify(analyticsConfig()));
}

module.exports = { analyticsConfig };

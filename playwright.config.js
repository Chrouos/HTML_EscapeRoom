const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:3100',
    env: { PORT: '3100', NODE_ENV: 'test' },
    reuseExistingServer: false
  }
});

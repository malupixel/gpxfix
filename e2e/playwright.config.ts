import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8250',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium', launchOptions: { args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'] } } },
  ],
  webServer: {
    command: 'node wait-for-env.cjs',
    url: 'http://127.0.0.1:8250',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

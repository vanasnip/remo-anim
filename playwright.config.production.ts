import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Production Testing
 * Testing https://remotion-recovery.vercel.app
 */
export default defineConfig({
  testDir: './tests/production',
  outputDir: './production-test-results/test-artifacts',
  timeout: 120000, // 2 minutes for network requests
  expect: {
    timeout: 15000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 2, // Retry for network stability
  workers: 3,
  reporter: [
    ['list'],
    ['json', { outputFile: 'production-test-results/test-results.json' }],
    ['html', { outputFolder: 'production-test-results/html-report', open: 'never' }],
  ],
  use: {
    baseURL: 'https://remotion-recovery.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Production testing settings
    actionTimeout: 15000,
    navigationTimeout: 30000,
    ignoreHTTPSErrors: false,
    // Headers for production testing
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    }
  },
  projects: [
    // Desktop Testing
    {
      name: 'desktop-chrome',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
    // Mobile Testing
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        isMobile: true,
      },
    },
    // Safari Testing
    {
      name: 'desktop-safari',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
  // No web server needed - testing production deployment
});
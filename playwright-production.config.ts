import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Production Testing
 * Tests the deployed Remotion Recovery application
 */
export default defineConfig({
  testDir: './tests/production',
  outputDir: './tests/production/test-artifacts',
  timeout: 120000, // 2 minutes for production tests
  expect: {
    timeout: 15000
  },
  fullyParallel: false, // Sequential for consistent measurements
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Single worker for production testing
  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/production/test-results.json' }],
    ['html', { outputFolder: 'tests/production/html-report', open: 'never' }],
  ],
  use: {
    // Production URL - no local server needed
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Reduce animations for consistent measurements
    reducedMotion: 'reduce',
  },
  projects: [
    // Desktop Production Testing
    {
      name: 'production-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
    // Mobile Production Testing
    {
      name: 'production-mobile',
      use: { 
        ...devices['Pixel 5'],
        isMobile: true,
      },
    },
  ],
  // No web server - testing production deployment
});
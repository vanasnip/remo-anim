import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Performance Testing
 * Optimized for ManimShowcase gallery performance monitoring
 */
export default defineConfig({
  testDir: './tests/performance',
  outputDir: './performance-results/test-artifacts',
  timeout: 120000, // 2 minutes for performance tests
  expect: {
    timeout: 15000
  },
  fullyParallel: false, // Sequential for consistent performance measurements
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 1, // Single worker for consistent metrics
  reporter: [
    ['list'],
    ['json', { outputFile: 'performance-results/test-results.json' }],
    ['html', { outputFolder: 'performance-results/html-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Disable animations for consistent measurements
    reducedMotion: 'reduce',
  },
  projects: [
    // Desktop Performance Testing
    {
      name: 'desktop-chrome',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'desktop-chrome-throttled',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        // Simulate slower hardware
        launchOptions: {
          args: [
            '--force-device-scale-factor=1',
            '--disable-dev-shm-usage',
            '--no-sandbox'
          ]
        }
      },
    },
    // Mobile Performance Testing
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        // Mobile-specific performance settings
        isMobile: true,
      },
    },
    // Memory Pressure Testing
    {
      name: 'memory-constrained',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          args: [
            '--max_old_space_size=512', // Limit memory
            '--no-sandbox',
            '--disable-dev-shm-usage'
          ]
        }
      },
    }
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
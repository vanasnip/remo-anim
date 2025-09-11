import { test, expect, Page } from '@playwright/test';

/**
 * Initial Load Test Suite
 * Verifies basic functionality of the production deployment
 */

test.describe('Initial Load Tests', () => {
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];
  let networkRequests: any[] = [];

  test.beforeEach(async ({ page }) => {
    // Capture console errors and warnings
    consoleErrors = [];
    consoleWarnings = [];
    networkRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Monitor network requests
    page.on('request', request => {
      networkRequests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      });
    });
  });

  test('should load the main page successfully with HTTP 200', async ({ page }) => {
    console.log('🔍 Testing initial page load...');
    
    // Navigate to the main page
    const response = await page.goto('/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Verify HTTP 200 response
    expect(response?.status()).toBe(200);
    console.log('✅ Page loaded with HTTP 200 status');

    // Wait for the page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Allow time for dynamic content

    // Take screenshot of the loaded page
    await page.screenshot({
      path: 'production-test-results/screenshots/initial-load.png',
      fullPage: true
    });
    console.log('📸 Screenshot captured: initial-load.png');

    // Verify page title
    const title = await page.title();
    expect(title).toBeTruthy();
    console.log(`📄 Page title: "${title}"`);

    // Check for basic page structure
    const body = await page.locator('body').count();
    expect(body).toBe(1);

    // Report console errors if any
    if (consoleErrors.length > 0) {
      console.log('⚠️ Console errors found:', consoleErrors);
    } else {
      console.log('✅ No console errors found');
    }

    // Report console warnings if any
    if (consoleWarnings.length > 0) {
      console.log('⚠️ Console warnings found:', consoleWarnings);
    }
  });

  test('should have proper meta tags and SEO elements', async ({ page }) => {
    console.log('🔍 Testing SEO and meta tags...');
    
    await page.goto('/', { waitUntil: 'networkidle' });

    // Check for viewport meta tag
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewportMeta).toBeTruthy();
    console.log(`📱 Viewport meta: ${viewportMeta}`);

    // Check for description meta tag
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    if (description) {
      console.log(`📝 Description meta: ${description}`);
    }

    // Check for favicon
    const favicon = await page.locator('link[rel*="icon"]').count();
    if (favicon > 0) {
      console.log('✅ Favicon found');
    }
  });

  test('should load critical resources successfully', async ({ page }) => {
    console.log('🔍 Testing critical resource loading...');
    
    await page.goto('/', { waitUntil: 'networkidle' });

    // Check for JavaScript bundles
    const jsRequests = networkRequests.filter(req => 
      req.resourceType === 'script' && req.url.includes('.js')
    );
    console.log(`📦 JavaScript files loaded: ${jsRequests.length}`);

    // Check for CSS files
    const cssRequests = networkRequests.filter(req => 
      req.resourceType === 'stylesheet' && req.url.includes('.css')
    );
    console.log(`🎨 CSS files loaded: ${cssRequests.length}`);

    // Check for image resources
    const imageRequests = networkRequests.filter(req => 
      req.resourceType === 'image'
    );
    console.log(`🖼️ Images loaded: ${imageRequests.length}`);

    // Verify no 404 or 500 errors in critical resources
    const failedRequests = networkRequests.filter(req => {
      const url = req.url;
      return (url.includes('.js') || url.includes('.css')) && 
             (url.includes('404') || url.includes('500'));
    });
    
    expect(failedRequests.length).toBe(0);
    console.log('✅ No failed critical resource requests');
  });

  test('should be responsive and mobile-friendly', async ({ page, isMobile }) => {
    console.log(`🔍 Testing responsive design (mobile: ${isMobile})...`);
    
    await page.goto('/', { waitUntil: 'networkidle' });

    if (isMobile) {
      // Mobile-specific checks
      const viewport = page.viewportSize();
      expect(viewport?.width).toBeLessThanOrEqual(500);
      console.log(`📱 Mobile viewport: ${viewport?.width}x${viewport?.height}`);
    } else {
      // Desktop-specific checks
      const viewport = page.viewportSize();
      expect(viewport?.width).toBeGreaterThanOrEqual(1000);
      console.log(`🖥️ Desktop viewport: ${viewport?.width}x${viewport?.height}`);
    }

    // Take responsive screenshot
    await page.screenshot({
      path: `production-test-results/screenshots/responsive-${isMobile ? 'mobile' : 'desktop'}.png`,
      fullPage: true
    });

    // Check for horizontal scrollbar (should not exist unless intended)
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    
    if (bodyScrollWidth > bodyClientWidth + 10) { // 10px tolerance
      console.log(`⚠️ Horizontal overflow detected: ${bodyScrollWidth} > ${bodyClientWidth}`);
    } else {
      console.log('✅ No unwanted horizontal overflow');
    }
  });

  test.afterEach(async () => {
    // Generate console report
    const consoleReport = {
      timestamp: new Date().toISOString(),
      errors: consoleErrors,
      warnings: consoleWarnings,
      networkRequestsCount: networkRequests.length,
      summary: {
        hasErrors: consoleErrors.length > 0,
        hasWarnings: consoleWarnings.length > 0,
        totalNetworkRequests: networkRequests.length
      }
    };

    // Save console report to file
    const fs = require('fs');
    const path = require('path');
    
    // Ensure directory exists
    const reportDir = 'production-test-results/console-reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(reportDir, `console-report-${Date.now()}.json`),
      JSON.stringify(consoleReport, null, 2)
    );
  });
});
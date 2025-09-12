import { test, expect, type Page } from '@playwright/test';

const DEPLOYED_URL = 'https://remotion-recovery.vercel.app';

test.describe('Remotion Optimization Verification', () => {
  let consoleMessages: string[] = [];
  let errorMessages: string[] = [];
  
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    errorMessages = [];
    
    // Capture console messages
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') {
        errorMessages.push(text);
      }
    });
    
    // Navigate to deployed app
    await page.goto(DEPLOYED_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
  });

  test('should show production mode and all 8 optimizations', async ({ page }) => {
    // Wait for optimization messages to appear
    await page.waitForTimeout(2000);
    
    // Take screenshot of initial state
    await page.screenshot({ 
      path: 'verification-reports/console-production-mode.png',
      fullPage: true 
    });
    
    // Check for production mode message
    const productionModeFound = consoleMessages.some(msg => 
      msg.includes('🚀 Remotion Performance Mode: production')
    );
    expect(productionModeFound).toBe(true);
    
    // Check for optimization features list
    const optimizationsFound = consoleMessages.some(msg => 
      msg.includes('⚡ Active Optimizations:')
    );
    expect(optimizationsFound).toBe(true);
    
    // Verify all 8 optimization features are mentioned
    const expectedOptimizations = [
      'Service Worker',
      'Performance Observer',
      'Resource Prefetching',
      'Image Optimization',
      'Memory Management',
      'Bundle Splitting',
      'CDN Preconnect',
      'Cache Management'
    ];
    
    const allOptimizationsFound = expectedOptimizations.every(opt =>
      consoleMessages.some(msg => msg.includes(opt))
    );
    expect(allOptimizationsFound).toBe(true);
    
    console.log('Console Messages:', consoleMessages);
  });

  test('should have Service Worker registered and active', async ({ page }) => {
    // Open DevTools Application tab programmatically
    await page.evaluate(() => {
      // Check if Service Worker is registered
      return navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log('Service Worker Registrations:', registrations.length);
        return registrations.length > 0;
      });
    });
    
    // Wait for Service Worker messages
    await page.waitForTimeout(3000);
    
    // Check for Service Worker registration message
    const swRegistrationFound = consoleMessages.some(msg => 
      msg.includes('Service Worker') && (msg.includes('registered') || msg.includes('active'))
    );
    
    // Take screenshot showing Service Worker state
    await page.screenshot({ 
      path: 'verification-reports/service-worker-state.png',
      fullPage: true 
    });
    
    expect(swRegistrationFound).toBe(true);
  });

  test('should have cache storage entries', async ({ page }) => {
    // Check for cache storage
    const cacheInfo = await page.evaluate(async () => {
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          const cacheDetails = [];
          
          for (const cacheName of cacheNames) {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            cacheDetails.push({
              name: cacheName,
              entryCount: keys.length,
              entries: keys.slice(0, 5).map(req => req.url) // First 5 entries
            });
          }
          
          return {
            available: true,
            caches: cacheDetails,
            totalCaches: cacheNames.length
          };
        } catch (error) {
          return { available: false, error: error.message };
        }
      }
      return { available: false, error: 'Cache API not available' };
    });
    
    console.log('Cache Information:', JSON.stringify(cacheInfo, null, 2));
    
    // Take screenshot after cache check
    await page.screenshot({ 
      path: 'verification-reports/cache-storage-state.png',
      fullPage: true 
    });
    
    expect(cacheInfo.available).toBe(true);
    if (cacheInfo.available) {
      expect(cacheInfo.totalCaches).toBeGreaterThan(0);
    }
  });

  test('should show network optimization features', async ({ page }) => {
    // Clear network and reload to capture optimization features
    await page.goto(DEPLOYED_URL, { waitUntil: 'networkidle' });
    
    // Wait for optimization stats
    await page.waitForTimeout(2000);
    
    // Check for optimization statistics
    const optimizationStatsFound = consoleMessages.some(msg => 
      msg.includes('📊 Optimization Stats:') || msg.includes('Performance Stats')
    );
    
    // Check for preconnect hints in the page
    const preconnectLinks = await page.$$eval('link[rel="preconnect"]', links => 
      links.map(link => link.getAttribute('href'))
    );
    
    console.log('Preconnect Links:', preconnectLinks);
    
    // Take screenshot showing network state
    await page.screenshot({ 
      path: 'verification-reports/network-optimization.png',
      fullPage: true 
    });
    
    // At least some optimization stats should be present
    expect(preconnectLinks.length).toBeGreaterThan(0);
  });

  test('should measure performance metrics', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate and measure load time
    await page.goto(DEPLOYED_URL, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    // Get performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
        memoryUsage: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : null
      };
    });
    
    console.log('Performance Metrics:', {
      totalLoadTime: loadTime,
      ...performanceMetrics
    });
    
    // Take screenshot of final state
    await page.screenshot({ 
      path: 'verification-reports/performance-final-state.png',
      fullPage: true 
    });
    
    // Performance expectations
    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    if (performanceMetrics.memoryUsage) {
      expect(performanceMetrics.memoryUsage.used).toBeLessThan(performanceMetrics.memoryUsage.limit);
    }
  });

  test('should generate comprehensive verification report', async ({ page }) => {
    // Wait for all optimizations to load
    await page.waitForTimeout(3000);
    
    // Collect all verification data
    const verificationReport = {
      timestamp: new Date().toISOString(),
      url: DEPLOYED_URL,
      consoleMessages: consoleMessages,
      errorMessages: errorMessages,
      optimizationChecks: {
        productionMode: consoleMessages.some(msg => msg.includes('🚀 Remotion Performance Mode: production')),
        optimizationsList: consoleMessages.some(msg => msg.includes('⚡ Active Optimizations:')),
        serviceWorker: consoleMessages.some(msg => msg.includes('Service Worker')),
        optimizationStats: consoleMessages.some(msg => msg.includes('📊') || msg.includes('Stats'))
      }
    };
    
    // Save verification report
    await page.evaluate((report) => {
      console.log('🔍 VERIFICATION REPORT:', JSON.stringify(report, null, 2));
    }, verificationReport);
    
    // Take final comprehensive screenshot
    await page.screenshot({ 
      path: 'verification-reports/comprehensive-verification.png',
      fullPage: true 
    });
    
    // All critical optimizations should be active
    expect(verificationReport.optimizationChecks.productionMode).toBe(true);
    expect(verificationReport.optimizationChecks.optimizationsList).toBe(true);
    expect(errorMessages.length).toBe(0); // No console errors
  });
});
import { test, expect, Page } from '@playwright/test';

/**
 * Production Deployment Analysis
 * Direct inspection of https://remotion-recovery.vercel.app
 */

test.describe('Production Deployment Analysis', () => {
  const PRODUCTION_URL = 'https://remotion-recovery.vercel.app';
  let consoleMessages: string[] = [];
  
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    
    // Capture all console messages
    page.on('console', msg => {
      const message = `${msg.type()}: ${msg.text()}`;
      consoleMessages.push(message);
      console.log(`Console ${message}`);
    });
    
    // Capture network errors
    page.on('pageerror', error => {
      console.log(`Page Error: ${error.message}`);
    });
    
    page.on('requestfailed', request => {
      console.log(`Request Failed: ${request.url()} - ${request.failure()?.errorText}`);
    });
  });

  test('Production Site Analysis', async ({ page }) => {
    console.log(`🔍 Analyzing production site: ${PRODUCTION_URL}`);
    
    const startTime = Date.now();
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });
    const loadTime = Date.now() - startTime;
    
    console.log(`⏱️ Initial load time: ${loadTime}ms`);
    
    // Take screenshot of current state
    await page.screenshot({ 
      path: 'performance-results/production-site-screenshot.png',
      fullPage: true 
    });
    
    // Wait for any optimization messages to appear
    await page.waitForTimeout(5000);
    
    // Analyze what we actually got
    const pageTitle = await page.title();
    const url = page.url();
    
    console.log(`📄 Page Title: ${pageTitle}`);
    console.log(`🔗 Final URL: ${url}`);
    console.log(`📝 Console Messages Found: ${consoleMessages.length}`);
    
    // Print all console messages for analysis
    console.log('\n📋 Console Messages:');
    consoleMessages.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg}`);
    });
    
    // Check for optimization indicators
    const optimizationMessages = consoleMessages.filter(msg => 
      msg.includes('🚀') || msg.includes('⚡') || msg.includes('📊')
    );
    
    console.log(`\n⚡ Optimization Messages: ${optimizationMessages.length}`);
    optimizationMessages.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg}`);
    });
    
    // Analyze current mode
    const performanceMode = consoleMessages.find(msg => 
      msg.includes('Performance Mode:') || msg.includes('🚀 Remotion Performance Mode:')
    );
    
    if (performanceMode) {
      console.log(`\n🎯 Current Mode: ${performanceMode}`);
      
      if (performanceMode.includes('development')) {
        console.log('❌ ISSUE: Site is running in development mode, not production!');
      } else if (performanceMode.includes('production')) {
        console.log('✅ Site is correctly running in production mode');
      }
    } else {
      console.log('❓ No performance mode information found');
    }
    
    // Check service worker
    const swStatus = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          return {
            supported: true,
            registered: !!registration,
            active: !!registration?.active,
            scope: registration?.scope,
            updatefound: !!registration?.updatefound
          };
        } catch (error) {
          return { supported: true, registered: false, error: error.message };
        }
      }
      return { supported: false };
    });
    
    console.log(`\n🔧 Service Worker Status:`);
    console.log(JSON.stringify(swStatus, null, 2));
    
    // Check for preconnect links
    const preconnectLinks = await page.$$eval('link[rel="preconnect"]', links => 
      links.map(link => (link as HTMLLinkElement).href)
    );
    
    console.log(`\n🔗 Preconnect Links: ${preconnectLinks.length}`);
    preconnectLinks.forEach((href, index) => {
      console.log(`${index + 1}. ${href}`);
    });
    
    // Check for prefetch links
    const prefetchLinks = await page.$$eval('link[rel="prefetch"]', links => 
      links.map(link => (link as HTMLLinkElement).href)
    );
    
    console.log(`\n📦 Prefetch Links: ${prefetchLinks.length}`);
    prefetchLinks.forEach((href, index) => {
      console.log(`${index + 1}. ${href}`);
    });
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      const resources = performance.getEntriesByType('resource');
      
      return {
        navigation: navigation ? {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          timeToInteractive: navigation.domInteractive - navigation.navigationStart,
          totalTime: navigation.loadEventEnd - navigation.navigationStart
        } : null,
        paint: {
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
        },
        resourceCount: resources.length,
        memoryUsage: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit
        } : 'Not available'
      };
    });
    
    console.log(`\n📊 Performance Metrics:`);
    console.log(JSON.stringify(metrics, null, 2));
    
    // Check for optimization flags
    const flags = await page.evaluate(() => {
      return {
        remotionFlags: (window as any).REMOTION_OPTIMIZATION_FLAGS,
        environmentVars: {
          nodeEnv: (window as any).process?.env?.NODE_ENV,
          remotionEnv: (window as any).process?.env?.REMOTION_ENV
        }
      };
    });
    
    console.log(`\n🚩 Optimization Flags:`);
    console.log(JSON.stringify(flags, null, 2));
    
    // Generate summary
    console.log('\n📋 ANALYSIS SUMMARY:');
    console.log('==================');
    
    if (performanceMode?.includes('development')) {
      console.log('❌ CRITICAL: Production site is running in DEVELOPMENT mode');
      console.log('   This explains why advanced optimizations are not active');
    }
    
    console.log(`⏱️ Load Performance: ${loadTime}ms`);
    console.log(`🔧 Service Worker: ${swStatus.registered ? '✅ Registered' : '❌ Not registered'}`);
    console.log(`🔗 Preconnect: ${preconnectLinks.length} links`);
    console.log(`📦 Prefetch: ${prefetchLinks.length} links`);
    console.log(`📊 Resources Loaded: ${metrics.resourceCount}`);
    console.log(`💾 Memory Usage: ${typeof metrics.memoryUsage === 'object' ? 
      `${Math.round(metrics.memoryUsage.used / 1024 / 1024)}MB used` : 'Not available'}`);
    
    // This test will pass but provide comprehensive analysis
    expect(loadTime).toBeLessThan(30000); // Very lenient - just ensure it loads
  });

  test('Network Analysis', async ({ page }) => {
    const requests: any[] = [];
    const responses: any[] = [];
    
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        headers: Object.fromEntries(Object.entries(request.headers())),
        timing: Date.now()
      });
    });
    
    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: Object.fromEntries(Object.entries(response.headers())),
        fromCache: response.fromCache(),
        timing: Date.now()
      });
    });
    
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });
    
    console.log(`\n🌐 Network Analysis:`);
    console.log(`Total Requests: ${requests.length}`);
    console.log(`Total Responses: ${responses.length}`);
    
    // Analyze resource types
    const resourceTypes = requests.reduce((acc, req) => {
      acc[req.resourceType] = (acc[req.resourceType] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`\n📊 Resource Types:`);
    Object.entries(resourceTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });
    
    // Check for cached responses
    const cachedResponses = responses.filter(res => res.fromCache);
    console.log(`\n💾 Cached Responses: ${cachedResponses.length}/${responses.length}`);
    
    // Check status codes
    const statusCodes = responses.reduce((acc: any, res) => {
      acc[res.status] = (acc[res.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log(`\n📈 Status Codes:`);
    Object.entries(statusCodes).forEach(([code, count]) => {
      console.log(`${code}: ${count}`);
    });
    
    // Look for optimization headers
    const optimizedResponses = responses.filter(res => 
      res.headers['cache-control'] || 
      res.headers['etag'] ||
      res.headers['last-modified'] ||
      res.url.includes('.webp')
    );
    
    console.log(`\n⚡ Responses with optimization headers: ${optimizedResponses.length}`);
    
    expect(requests.length).toBeGreaterThan(0);
  });

  test('Caching Investigation', async ({ page }) => {
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });
    
    // Check cache storage
    const cacheAnalysis = await page.evaluate(async () => {
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          const results = [];
          
          for (const name of cacheNames) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            results.push({
              name,
              entryCount: keys.length,
              entries: keys.slice(0, 10).map(req => ({
                url: req.url,
                method: req.method
              }))
            });
          }
          
          return { supported: true, caches: results };
        } catch (error) {
          return { supported: true, error: error.message };
        }
      }
      return { supported: false };
    });
    
    console.log(`\n💾 Cache Storage Analysis:`);
    console.log(JSON.stringify(cacheAnalysis, null, 2));
    
    expect(cacheAnalysis.supported).toBe(true);
  });

  test('Performance Baseline Measurement', async ({ page }) => {
    const measurements = [];
    
    for (let i = 0; i < 3; i++) {
      console.log(`\n📊 Measurement ${i + 1}/3`);
      
      const startTime = Date.now();
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });
      const totalLoadTime = Date.now() - startTime;
      
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        const resources = performance.getEntriesByType('resource');
        
        return {
          loadTime: navigation ? navigation.loadEventEnd - navigation.navigationStart : 0,
          domReady: navigation ? navigation.domContentLoadedEventEnd - navigation.navigationStart : 0,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          resourceCount: resources.length,
          transferSize: resources.reduce((total, resource) => total + (resource.transferSize || 0), 0)
        };
      });
      
      measurements.push({
        ...metrics,
        totalLoadTime,
        run: i + 1
      });
      
      console.log(`Run ${i + 1}: ${totalLoadTime}ms total, ${metrics.domReady}ms DOM ready`);
      
      // Clear cache between runs for consistency
      await page.evaluate(() => {
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
      });
      
      // Small delay between measurements
      await page.waitForTimeout(1000);
    }
    
    // Calculate averages
    const avg = {
      totalLoadTime: measurements.reduce((sum, m) => sum + m.totalLoadTime, 0) / measurements.length,
      loadTime: measurements.reduce((sum, m) => sum + m.loadTime, 0) / measurements.length,
      domReady: measurements.reduce((sum, m) => sum + m.domReady, 0) / measurements.length,
      firstPaint: measurements.reduce((sum, m) => sum + m.firstPaint, 0) / measurements.length,
      firstContentfulPaint: measurements.reduce((sum, m) => sum + m.firstContentfulPaint, 0) / measurements.length,
      resourceCount: Math.round(measurements.reduce((sum, m) => sum + m.resourceCount, 0) / measurements.length),
      transferSize: Math.round(measurements.reduce((sum, m) => sum + m.transferSize, 0) / measurements.length)
    };
    
    console.log(`\n📊 PERFORMANCE BASELINE:`);
    console.log('========================');
    console.log(`Average Total Load Time: ${Math.round(avg.totalLoadTime)}ms`);
    console.log(`Average Load Event: ${Math.round(avg.loadTime)}ms`);
    console.log(`Average DOM Ready: ${Math.round(avg.domReady)}ms`);
    console.log(`Average First Paint: ${Math.round(avg.firstPaint)}ms`);
    console.log(`Average First Contentful Paint: ${Math.round(avg.firstContentfulPaint)}ms`);
    console.log(`Average Resource Count: ${avg.resourceCount}`);
    console.log(`Average Transfer Size: ${Math.round(avg.transferSize / 1024)}KB`);
    
    console.log(`\n📈 Individual Measurements:`);
    measurements.forEach((m, index) => {
      console.log(`Run ${index + 1}: ${m.totalLoadTime}ms (DOM: ${m.domReady}ms, FCP: ${m.firstContentfulPaint}ms)`);
    });
    
    expect(avg.totalLoadTime).toBeLessThan(15000); // 15 second timeout
  });
});
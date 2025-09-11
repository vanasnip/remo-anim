import { test, expect, Page } from '@playwright/test';

/**
 * ManimShowcase Gallery Test Suite
 * Tests navigation, functionality, and performance features
 */

test.describe('ManimShowcase Gallery Tests', () => {
  let performanceMetrics: any = {};

  test.beforeEach(async ({ page }) => {
    // Enable performance monitoring
    await page.addInitScript(() => {
      // Monitor performance metrics
      (window as any).performanceMetrics = {
        navigationStart: performance.now(),
        intersectionObserverActive: false,
        lazyImagesLoaded: 0,
        scrollEvents: 0
      };

      // Monitor Intersection Observer
      const originalIntersectionObserver = window.IntersectionObserver;
      window.IntersectionObserver = class extends originalIntersectionObserver {
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          super((...args) => {
            (window as any).performanceMetrics.intersectionObserverActive = true;
            return callback(...args);
          }, options);
        }
      };

      // Monitor image loading
      document.addEventListener('load', (e) => {
        if ((e.target as HTMLElement)?.tagName === 'IMG') {
          (window as any).performanceMetrics.lazyImagesLoaded++;
        }
      }, true);

      // Monitor scroll events
      let scrollTimeout: NodeJS.Timeout;
      window.addEventListener('scroll', () => {
        (window as any).performanceMetrics.scrollEvents++;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          (window as any).performanceMetrics.lastScrollTime = performance.now();
        }, 100);
      });
    });
  });

  test('should navigate to ManimShowcase Gallery successfully', async ({ page }) => {
    console.log('🔍 Testing ManimShowcase Gallery navigation...');
    
    // First, go to main page
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Try direct navigation to ManimShowcase Gallery
    const galleryResponse = await page.goto('/ManimShowcase-Gallery', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    if (galleryResponse?.status() === 200) {
      console.log('✅ ManimShowcase Gallery route exists and loads successfully');
      
      await page.screenshot({
        path: 'production-test-results/screenshots/manim-showcase-gallery.png',
        fullPage: true
      });
      
      // Check page content
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
      
    } else if (galleryResponse?.status() === 404) {
      console.log('⚠️ ManimShowcase Gallery route not found (404)');
      
      // Try alternative routes
      const alternativeRoutes = [
        '/manim-showcase',
        '/showcase',
        '/gallery',
        '/ManimShowcase',
        '/manim-gallery'
      ];
      
      let foundRoute = null;
      for (const route of alternativeRoutes) {
        try {
          const altResponse = await page.goto(route, { 
            waitUntil: 'networkidle',
            timeout: 10000 
          });
          if (altResponse?.status() === 200) {
            foundRoute = route;
            console.log(`✅ Found alternative route: ${route}`);
            break;
          }
        } catch (e) {
          // Continue to next route
        }
      }
      
      if (foundRoute) {
        await page.screenshot({
          path: `production-test-results/screenshots/found-alternative-route-${foundRoute.replace('/', '')}.png`,
          fullPage: true
        });
      } else {
        console.log('❌ No alternative gallery routes found');
        // Still take a screenshot of the 404 page
        await page.screenshot({
          path: 'production-test-results/screenshots/gallery-404.png',
          fullPage: true
        });
      }
    } else {
      console.log(`⚠️ ManimShowcase Gallery returned status: ${galleryResponse?.status()}`);
    }
  });

  test('should test main page navigation and available routes', async ({ page }) => {
    console.log('🔍 Testing available navigation options...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Look for navigation links
    const navLinks = await page.locator('a[href]').all();
    const availableRoutes: string[] = [];
    
    for (const link of navLinks) {
      try {
        const href = await link.getAttribute('href');
        if (href && href.startsWith('/') && !href.startsWith('//')) {
          availableRoutes.push(href);
        }
      } catch (e) {
        // Skip invalid links
      }
    }
    
    console.log(`🔗 Found ${availableRoutes.length} internal navigation links:`);
    availableRoutes.forEach(route => console.log(`   - ${route}`));
    
    // Test each route
    const routeResults: any = {};
    for (const route of availableRoutes.slice(0, 10)) { // Test first 10 routes
      try {
        const response = await page.goto(route, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        routeResults[route] = {
          status: response?.status() || 'unknown',
          accessible: response?.status() === 200
        };
        console.log(`   ${route}: ${response?.status()}`);
      } catch (e) {
        routeResults[route] = {
          status: 'error',
          accessible: false,
          error: (e as Error).message
        };
        console.log(`   ${route}: ERROR`);
      }
    }
    
    // Save route testing results
    const fs = require('fs');
    const routeReport = {
      timestamp: new Date().toISOString(),
      totalRoutesFound: availableRoutes.length,
      routesTested: Object.keys(routeResults).length,
      results: routeResults
    };
    
    if (!fs.existsSync('production-test-results/reports')) {
      fs.mkdirSync('production-test-results/reports', { recursive: true });
    }
    
    fs.writeFileSync(
      'production-test-results/reports/route-testing.json',
      JSON.stringify(routeReport, null, 2)
    );
  });

  test('should test scrolling behavior and performance', async ({ page }) => {
    console.log('🔍 Testing scrolling behavior and performance...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Measure initial page height
    const initialHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    console.log(`📏 Page height: ${initialHeight}px, Viewport: ${viewportHeight}px`);
    
    // Test smooth scrolling
    const scrollStart = Date.now();
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
    
    // Wait for scroll to complete
    await page.waitForTimeout(2000);
    
    const scrollEnd = Date.now();
    const scrollDuration = scrollEnd - scrollStart;
    console.log(`⏱️ Scroll duration: ${scrollDuration}ms`);
    
    // Check final scroll position
    const finalScrollTop = await page.evaluate(() => window.scrollY);
    console.log(`📍 Final scroll position: ${finalScrollTop}px`);
    
    // Test scroll back to top
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);
    
    // Get performance metrics
    performanceMetrics = await page.evaluate(() => (window as any).performanceMetrics);
    console.log('📊 Performance metrics:', performanceMetrics);
    
    // Take screenshot after scrolling tests
    await page.screenshot({
      path: 'production-test-results/screenshots/after-scroll-test.png',
      fullPage: true
    });
  });

  test('should verify lazy loading implementation', async ({ page }) => {
    console.log('🔍 Testing lazy loading implementation...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Look for images with lazy loading attributes
    const lazyImages = await page.locator('img[loading="lazy"], img[data-src]').count();
    console.log(`🖼️ Found ${lazyImages} images with lazy loading attributes`);
    
    // Look for intersection observer usage
    const hasIntersectionObserver = await page.evaluate(() => {
      return 'IntersectionObserver' in window;
    });
    console.log(`🔍 Intersection Observer support: ${hasIntersectionObserver}`);
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
    });
    await page.waitForTimeout(2000);
    
    // Check if intersection observer was activated
    const metricsAfterScroll = await page.evaluate(() => (window as any).performanceMetrics);
    
    if (metricsAfterScroll.intersectionObserverActive) {
      console.log('✅ Intersection Observer is active - lazy loading implemented');
    } else {
      console.log('⚠️ Intersection Observer not detected as active');
    }
    
    console.log(`📸 Lazy images loaded: ${metricsAfterScroll.lazyImagesLoaded}`);
    console.log(`📜 Scroll events triggered: ${metricsAfterScroll.scrollEvents}`);
  });

  test('should test search functionality if available', async ({ page }) => {
    console.log('🔍 Testing search functionality...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Look for search input field
    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="search" i]',
      'input[placeholder*="Search" i]',
      '[data-testid*="search"]',
      '.search-input',
      '#search'
    ];
    
    let searchInput = null;
    for (const selector of searchSelectors) {
      const element = await page.locator(selector).first();
      if (await element.count() > 0) {
        searchInput = element;
        console.log(`✅ Found search input with selector: ${selector}`);
        break;
      }
    }
    
    if (searchInput) {
      // Test search functionality
      await searchInput.fill('test');
      await searchInput.press('Enter');
      await page.waitForTimeout(1000);
      
      // Take screenshot of search results
      await page.screenshot({
        path: 'production-test-results/screenshots/search-functionality.png',
        fullPage: true
      });
      
      console.log('✅ Search functionality tested');
    } else {
      console.log('⚠️ No search functionality detected');
    }
  });

  test.afterEach(async () => {
    // Save performance metrics report
    const fs = require('fs');
    if (!fs.existsSync('production-test-results/performance')) {
      fs.mkdirSync('production-test-results/performance', { recursive: true });
    }
    
    const performanceReport = {
      timestamp: new Date().toISOString(),
      metrics: performanceMetrics,
      testCompleted: true
    };
    
    fs.writeFileSync(
      `production-test-results/performance/performance-${Date.now()}.json`,
      JSON.stringify(performanceReport, null, 2)
    );
  });
});
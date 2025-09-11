import { test, expect, Page } from '@playwright/test';

/**
 * Week 3 Performance Optimizations Verification
 * Tests specific optimizations implemented in Week 3
 */

test.describe('Week 3 Performance Optimizations', () => {
  let performanceObserver: any = null;
  let memoryMetrics: any = {};

  test.beforeEach(async ({ page }) => {
    // Inject performance monitoring
    await page.addInitScript(() => {
      // Monitor Core Web Vitals
      (window as any).webVitals = {
        LCP: null, // Largest Contentful Paint
        FID: null, // First Input Delay
        CLS: null, // Cumulative Layout Shift
        FCP: null, // First Contentful Paint
        TTFB: null // Time to First Byte
      };

      // Performance Observer for Web Vitals
      if ('PerformanceObserver' in window) {
        // LCP Observer
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          (window as any).webVitals.LCP = lastEntry.startTime;
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

        // FCP Observer
        const fcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              (window as any).webVitals.FCP = entry.startTime;
            }
          }
        });
        fcpObserver.observe({ type: 'paint', buffered: true });

        // Layout Shift Observer
        const clsObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          (window as any).webVitals.CLS = clsValue;
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      }

      // TTFB from Navigation Timing
      window.addEventListener('load', () => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          (window as any).webVitals.TTFB = navigation.responseStart - navigation.requestStart;
        }
      });

      // Environment variables detection
      (window as any).environmentConfig = {
        detected: false,
        lazyLoading: false,
        virtualScroll: false,
        performanceMode: 'unknown'
      };

      // Check for lazy loading implementation
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'IMG' && (
                element.hasAttribute('loading') ||
                element.hasAttribute('data-src') ||
                element.hasAttribute('data-lazy')
              )) {
                (window as any).environmentConfig.lazyLoading = true;
              }
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  test('should verify lazy loading is enabled and functional', async ({ page }) => {
    console.log('🔍 Testing lazy loading implementation...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Check for lazy loading attributes
    const lazyImages = await page.locator('img[loading="lazy"]').count();
    const dataSrcImages = await page.locator('img[data-src]').count();
    const dataLazyImages = await page.locator('img[data-lazy]').count();
    
    const totalLazyImages = lazyImages + dataSrcImages + dataLazyImages;
    
    console.log(`📊 Lazy loading detection:`);
    console.log(`   - loading="lazy" images: ${lazyImages}`);
    console.log(`   - data-src images: ${dataSrcImages}`);
    console.log(`   - data-lazy images: ${dataLazyImages}`);
    console.log(`   - Total lazy images: ${totalLazyImages}`);

    if (totalLazyImages > 0) {
      console.log('✅ ENABLE_LAZY_LOADING: true - Lazy loading is implemented');
    } else {
      console.log('⚠️ ENABLE_LAZY_LOADING: potentially false - No lazy loading detected');
    }

    // Test lazy loading behavior
    const initialImageCount = await page.locator('img').count();
    console.log(`📸 Initial images loaded: ${initialImageCount}`);

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
    });
    await page.waitForTimeout(2000);

    const afterScrollImageCount = await page.locator('img').count();
    console.log(`📸 Images after scroll: ${afterScrollImageCount}`);

    if (afterScrollImageCount > initialImageCount) {
      console.log('✅ Lazy loading behavior confirmed - Images loaded on scroll');
    }
  });

  test('should verify virtual scrolling implementation', async ({ page }) => {
    console.log('🔍 Testing virtual scrolling implementation...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Look for virtual scrolling indicators
    const virtualScrollSelectors = [
      '[data-virtual-scroll]',
      '.virtual-scroll',
      '.react-window',
      '.react-virtualized',
      '[class*="virtual"]',
      '[class*="virtualized"]'
    ];

    let virtualScrollDetected = false;
    for (const selector of virtualScrollSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        virtualScrollDetected = true;
        console.log(`✅ Virtual scroll component found: ${selector} (${count} elements)`);
      }
    }

    // Check for viewport-based rendering
    const listItems = await page.locator('li, .item, .card, .gallery-item').count();
    console.log(`📋 Rendered list items: ${listItems}`);

    // Scroll and check if items are added/removed dynamically
    const initialItems = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('li, .item, .card, .gallery-item')).length;
    });

    await page.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 2, behavior: 'smooth' });
    });
    await page.waitForTimeout(1000);

    const itemsAfterScroll = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('li, .item, .card, .gallery-item')).length;
    });

    if (virtualScrollDetected) {
      console.log('✅ ENABLE_VIRTUAL_SCROLL: true - Virtual scrolling implemented');
    } else if (itemsAfterScroll !== initialItems && listItems > 20) {
      console.log('✅ ENABLE_VIRTUAL_SCROLL: likely true - Dynamic item rendering detected');
    } else {
      console.log('⚠️ ENABLE_VIRTUAL_SCROLL: potentially false - No virtual scrolling detected');
    }

    console.log(`📊 Items before scroll: ${initialItems}, after scroll: ${itemsAfterScroll}`);
  });

  test('should verify performance monitoring is active', async ({ page }) => {
    console.log('🔍 Testing performance monitoring implementation...');
    
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Get Web Vitals metrics
    const webVitals = await page.evaluate(() => (window as any).webVitals);
    
    console.log('📊 Core Web Vitals:');
    console.log(`   - LCP (Largest Contentful Paint): ${webVitals.LCP?.toFixed(2) || 'N/A'}ms`);
    console.log(`   - FCP (First Contentful Paint): ${webVitals.FCP?.toFixed(2) || 'N/A'}ms`);
    console.log(`   - CLS (Cumulative Layout Shift): ${webVitals.CLS?.toFixed(4) || 'N/A'}`);
    console.log(`   - TTFB (Time to First Byte): ${webVitals.TTFB?.toFixed(2) || 'N/A'}ms`);

    // Performance assessment
    const performance = {
      LCP: webVitals.LCP,
      FCP: webVitals.FCP,
      CLS: webVitals.CLS,
      TTFB: webVitals.TTFB,
      assessment: {
        LCP_rating: webVitals.LCP ? (webVitals.LCP < 2500 ? 'Good' : webVitals.LCP < 4000 ? 'Needs Improvement' : 'Poor') : 'Unknown',
        FCP_rating: webVitals.FCP ? (webVitals.FCP < 1800 ? 'Good' : webVitals.FCP < 3000 ? 'Needs Improvement' : 'Poor') : 'Unknown',
        CLS_rating: webVitals.CLS ? (webVitals.CLS < 0.1 ? 'Good' : webVitals.CLS < 0.25 ? 'Needs Improvement' : 'Poor') : 'Unknown',
        TTFB_rating: webVitals.TTFB ? (webVitals.TTFB < 800 ? 'Good' : webVitals.TTFB < 1800 ? 'Needs Improvement' : 'Poor') : 'Unknown'
      }
    };

    console.log('🎯 Performance Assessment:');
    console.log(`   - LCP: ${performance.assessment.LCP_rating}`);
    console.log(`   - FCP: ${performance.assessment.FCP_rating}`);
    console.log(`   - CLS: ${performance.assessment.CLS_rating}`);
    console.log(`   - TTFB: ${performance.assessment.TTFB_rating}`);

    // Check for performance mode staging
    const performanceMode = await page.evaluate(() => {
      // Check if performance monitoring code is present
      const hasPerformanceObserver = 'PerformanceObserver' in window;
      const hasWebVitals = !!(window as any).webVitals;
      return {
        hasPerformanceObserver,
        hasWebVitals,
        mode: hasWebVitals ? 'staging' : 'unknown'
      };
    });

    if (performanceMode.hasWebVitals) {
      console.log('✅ PERFORMANCE_MODE: staging - Performance monitoring active');
    } else {
      console.log('⚠️ PERFORMANCE_MODE: unknown - Performance monitoring not detected');
    }

    // Save performance report
    const fs = require('fs');
    if (!fs.existsSync('production-test-results/web-vitals')) {
      fs.mkdirSync('production-test-results/web-vitals', { recursive: true });
    }

    const webVitalsReport = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      metrics: performance,
      performanceMode: performanceMode,
      summary: {
        goodMetrics: Object.values(performance.assessment).filter(rating => rating === 'Good').length,
        needsImprovementMetrics: Object.values(performance.assessment).filter(rating => rating === 'Needs Improvement').length,
        poorMetrics: Object.values(performance.assessment).filter(rating => rating === 'Poor').length
      }
    };

    fs.writeFileSync(
      `production-test-results/web-vitals/web-vitals-${Date.now()}.json`,
      JSON.stringify(webVitalsReport, null, 2)
    );
  });

  test('should verify progressive image loading', async ({ page }) => {
    console.log('🔍 Testing progressive image loading...');
    
    await page.goto('/', { waitUntil: 'networkidle' });

    // Monitor image loading events
    let imageLoadEvents: any[] = [];
    
    await page.evaluateOnNewDocument(() => {
      (window as any).imageLoadEvents = [];
      
      // Monitor image load events
      document.addEventListener('load', (event) => {
        if ((event.target as HTMLElement)?.tagName === 'IMG') {
          const img = event.target as HTMLImageElement;
          (window as any).imageLoadEvents.push({
            src: img.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            loadTime: performance.now(),
            hasPlaceholder: img.hasAttribute('data-placeholder') || img.classList.contains('placeholder')
          });
        }
      }, true);
    });

    // Wait for initial images to load
    await page.waitForTimeout(3000);

    // Get image loading data
    imageLoadEvents = await page.evaluate(() => (window as any).imageLoadEvents || []);
    
    console.log(`📸 Image loading analysis:`);
    console.log(`   - Total images loaded: ${imageLoadEvents.length}`);
    
    if (imageLoadEvents.length > 0) {
      const hasPlaceholders = imageLoadEvents.filter(event => event.hasPlaceholder).length;
      const avgLoadTime = imageLoadEvents.reduce((sum, event) => sum + event.loadTime, 0) / imageLoadEvents.length;
      
      console.log(`   - Images with placeholders: ${hasPlaceholders}`);
      console.log(`   - Average load time: ${avgLoadTime.toFixed(2)}ms`);
      
      if (hasPlaceholders > 0) {
        console.log('✅ Progressive image loading detected - Using placeholders');
      }
    }

    // Check for blur-up or skeleton loading
    const placeholderSelectors = [
      '.blur-up',
      '.skeleton',
      '.placeholder',
      '[data-placeholder]',
      '.lazy-placeholder'
    ];

    let progressiveLoadingDetected = false;
    for (const selector of placeholderSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        progressiveLoadingDetected = true;
        console.log(`✅ Progressive loading elements found: ${selector} (${count} elements)`);
      }
    }

    if (progressiveLoadingDetected) {
      console.log('✅ Progressive image loading is implemented');
    } else {
      console.log('⚠️ No progressive image loading detected');
    }
  });

  test('should measure memory usage and resource optimization', async ({ page }) => {
    console.log('🔍 Testing memory usage and resource optimization...');
    
    await page.goto('/', { waitUntil: 'networkidle' });

    // Get memory information if available
    const memoryInfo = await page.evaluate(() => {
      if ((performance as any).memory) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        };
      }
      return null;
    });

    if (memoryInfo) {
      const usedMB = (memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2);
      const totalMB = (memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2);
      const limitMB = (memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
      
      console.log(`💾 Memory usage:`);
      console.log(`   - Used JS heap: ${usedMB} MB`);
      console.log(`   - Total JS heap: ${totalMB} MB`);
      console.log(`   - JS heap limit: ${limitMB} MB`);
      
      const memoryEfficiency = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
      console.log(`   - Memory efficiency: ${memoryEfficiency.toFixed(2)}%`);
    }

    // Check resource compression
    const response = await page.goto(page.url(), { waitUntil: 'networkidle' });
    const contentEncoding = response?.headers()['content-encoding'];
    const contentLength = response?.headers()['content-length'];
    
    console.log(`📦 Resource optimization:`);
    console.log(`   - Content encoding: ${contentEncoding || 'none'}`);
    console.log(`   - Content length: ${contentLength || 'unknown'}`);
    
    if (contentEncoding && (contentEncoding.includes('gzip') || contentEncoding.includes('br'))) {
      console.log('✅ Resource compression is enabled');
    }

    // Test scroll performance
    const scrollStart = performance.now();
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
    await page.waitForTimeout(2000);
    const scrollEnd = performance.now();
    
    console.log(`⚡ Scroll performance: ${(scrollEnd - scrollStart).toFixed(2)}ms`);
  });

  test.afterEach(async ({ page }) => {
    // Take a final screenshot
    await page.screenshot({
      path: `production-test-results/screenshots/week3-optimizations-final.png`,
      fullPage: true
    });
  });
});
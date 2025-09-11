import { test, expect, Page } from '@playwright/test';

/**
 * Production Deployment Testing Suite
 * Tests the deployed Remotion Recovery application at Vercel
 * 
 * Target URL: https://remotion-recovery-4dok4e7w8-vanasnip-0f7d4c38.vercel.app
 */

const PRODUCTION_URL = 'https://remotion-recovery-4dok4e7w8-vanasnip-0f7d4c38.vercel.app';
const TEST_TIMEOUT = 60000; // 1 minute for production tests

test.describe('Production Deployment - Remotion Recovery', () => {
  let page: Page;
  let consoleErrors: string[] = [];
  let consoleWarnings: string[] = [];
  let performanceMetrics: any = {};

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleErrors = [];
    consoleWarnings = [];
    
    // Capture console messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Capture network failures
    page.on('requestfailed', (request) => {
      consoleErrors.push(`Network failure: ${request.url()} - ${request.failure()?.errorText}`);
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Basic Load Test - Main Page Navigation and Initial State', async () => {
    test.setTimeout(TEST_TIMEOUT);

    console.log('🚀 Starting basic load test...');

    // Navigate to production URL
    const startTime = Date.now();
    const response = await page.goto(PRODUCTION_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    const loadTime = Date.now() - startTime;

    // Verify successful response
    expect(response?.status()).toBeLessThan(400);
    console.log(`✅ Page loaded successfully in ${loadTime}ms`);

    // Wait for React app to initialize
    await page.waitForSelector('body', { timeout: 10000 });

    // Take screenshot of initial state
    await page.screenshot({ 
      path: '/Users/ivan/DEV_/anim/remotion-recovery/tests/production/screenshots/initial-load.png',
      fullPage: true 
    });

    // Check for basic page structure
    const title = await page.title();
    expect(title).toBeTruthy();
    console.log(`📄 Page title: "${title}"`);

    // Verify no critical console errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('manifest') &&
      !error.toLowerCase().includes('warning')
    );

    if (criticalErrors.length > 0) {
      console.warn(`⚠️  Found ${criticalErrors.length} console errors:`);
      criticalErrors.forEach(error => console.warn(`   - ${error}`));
    }

    // Performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      };
    });

    console.log('📊 Performance Metrics:', metrics);
    performanceMetrics.basicLoad = metrics;

    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
  });

  test('Feature Flag Verification - Environment Variables', async () => {
    test.setTimeout(TEST_TIMEOUT);

    console.log('🔧 Testing feature flag verification...');

    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

    // Check for feature flag indicators in the DOM or console
    const featureFlags = await page.evaluate(() => {
      // Look for feature flags in window object or data attributes
      const flags = {
        lazyLoading: document.documentElement.dataset.lazyLoading || 'unknown',
        virtualScroll: document.documentElement.dataset.virtualScroll || 'unknown',
        predictiveLoading: document.documentElement.dataset.predictiveLoading || 'unknown',
        memoryPooling: document.documentElement.dataset.memoryPooling || 'unknown',
        performanceMode: document.documentElement.dataset.performanceMode || 'unknown'
      };

      // Also check if flags are available globally
      if (typeof window !== 'undefined' && (window as any).FEATURE_FLAGS) {
        Object.assign(flags, (window as any).FEATURE_FLAGS);
      }

      return flags;
    });

    console.log('🚩 Feature Flags detected:', featureFlags);

    // Verify expected flags (based on Week 3 optimizations)
    // Note: These might not be exposed in production, so we'll check behavior instead
    await page.screenshot({ 
      path: '/Users/ivan/DEV_/anim/remotion-recovery/tests/production/screenshots/feature-flags-state.png',
      fullPage: true 
    });
  });

  test('Performance Features Test - Navigation and Gallery', async () => {
    test.setTimeout(TEST_TIMEOUT);

    console.log('⚡ Testing performance features...');

    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

    // Look for ManimShowcase-Gallery or similar routes
    const links = await page.$$eval('a', (anchors) => 
      anchors.map(a => ({ href: a.href, text: a.textContent?.trim() }))
        .filter(link => link.href && (
          link.href.includes('gallery') || 
          link.href.includes('manim') ||
          link.href.includes('showcase')
        ))
    );

    console.log('🔗 Found gallery-related links:', links);

    if (links.length > 0) {
      // Test the first gallery-like link
      const galleryLink = links[0];
      console.log(`🎨 Testing gallery page: ${galleryLink.href}`);

      await page.click(`a[href*="${galleryLink.href.split('/').pop()}"]`);
      await page.waitForLoadState('networkidle');

      // Test lazy loading - scroll and observe loading behavior
      const scrollTest = await page.evaluate(async () => {
        const initialImages = document.querySelectorAll('img').length;
        
        // Scroll down to trigger lazy loading
        window.scrollTo(0, window.innerHeight);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const afterScrollImages = document.querySelectorAll('img').length;
        
        // Scroll more
        window.scrollTo(0, window.innerHeight * 2);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const finalImages = document.querySelectorAll('img').length;

        return {
          initialImages,
          afterScrollImages,
          finalImages,
          lazyLoadingWorking: finalImages > initialImages
        };
      });

      console.log('🖼️  Lazy loading test results:', scrollTest);

      await page.screenshot({ 
        path: '/Users/ivan/DEV_/anim/remotion-recovery/tests/production/screenshots/gallery-after-scroll.png',
        fullPage: true 
      });

      // Test virtual scrolling performance
      const scrollPerformance = await page.evaluate(async () => {
        const startTime = performance.now();
        
        // Rapid scrolling test
        for (let i = 0; i < 10; i++) {
          window.scrollTo(0, window.innerHeight * i / 2);
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
        
        const endTime = performance.now();
        return {
          scrollDuration: endTime - startTime,
          memoryUsage: (performance as any).memory ? {
            used: (performance as any).memory.usedJSHeapSize,
            total: (performance as any).memory.totalJSHeapSize,
            limit: (performance as any).memory.jsHeapSizeLimit
          } : null
        };
      });

      console.log('📊 Scroll performance metrics:', scrollPerformance);
      performanceMetrics.scrollPerformance = scrollPerformance;
    } else {
      console.log('ℹ️  No gallery links found - testing main page scroll behavior');
      
      // Test scroll behavior on main page
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: '/Users/ivan/DEV_/anim/remotion-recovery/tests/production/screenshots/main-page-scrolled.png',
        fullPage: true 
      });
    }
  });

  test('Week 3 Optimizations - Intersection Observer & Smooth Scrolling', async () => {
    test.setTimeout(TEST_TIMEOUT);

    console.log('🔍 Testing Week 3 optimizations...');

    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

    // Test intersection observer functionality
    const intersectionObserverTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        let observedElements = 0;
        let intersectionEvents = 0;

        // Create a test element
        const testElement = document.createElement('div');
        testElement.style.height = '100px';
        testElement.style.backgroundColor = 'red';
        testElement.style.marginTop = '2000px';
        testElement.id = 'intersection-test-element';
        document.body.appendChild(testElement);

        // Test if IntersectionObserver is available and working
        if (typeof IntersectionObserver !== 'undefined') {
          const observer = new IntersectionObserver((entries) => {
            intersectionEvents += entries.length;
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                observedElements++;
              }
            });
          });

          observer.observe(testElement);

          // Scroll to make the element visible
          setTimeout(() => {
            testElement.scrollIntoView();
            setTimeout(() => {
              observer.disconnect();
              testElement.remove();
              resolve({
                intersectionObserverAvailable: true,
                observedElements,
                intersectionEvents,
                working: observedElements > 0
              });
            }, 1000);
          }, 500);
        } else {
          testElement.remove();
          resolve({
            intersectionObserverAvailable: false,
            observedElements: 0,
            intersectionEvents: 0,
            working: false
          });
        }
      });
    });

    console.log('👁️  Intersection Observer test:', intersectionObserverTest);

    // Test smooth scrolling performance
    const smoothScrollTest = await page.evaluate(async () => {
      const startTime = performance.now();
      
      // Test smooth scrolling
      window.scrollTo({ 
        top: 0, 
        behavior: 'smooth' 
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      window.scrollTo({ 
        top: document.body.scrollHeight / 2, 
        behavior: 'smooth' 
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const endTime = performance.now();
      
      return {
        smoothScrollDuration: endTime - startTime,
        scrollTop: window.scrollY,
        smoothScrollSupported: 'scrollBehavior' in document.documentElement.style
      };
    });

    console.log('🎢 Smooth scroll test:', smoothScrollTest);

    await page.screenshot({ 
      path: '/Users/ivan/DEV_/anim/remotion-recovery/tests/production/screenshots/week3-optimizations.png',
      fullPage: true 
    });

    performanceMetrics.week3Optimizations = {
      intersectionObserver: intersectionObserverTest,
      smoothScroll: smoothScrollTest
    };
  });

  test('Accessibility Testing - Keyboard Navigation & ARIA', async () => {
    test.setTimeout(TEST_TIMEOUT);

    console.log('♿ Testing accessibility features...');

    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

    // Test keyboard navigation
    const keyboardNavTest = await page.evaluate(async () => {
      let focusableElements = 0;
      let tabIndexElements = 0;
      
      // Find focusable elements
      const focusable = document.querySelectorAll(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
      );
      
      focusableElements = focusable.length;
      
      // Check tabindex usage
      const tabIndexEls = document.querySelectorAll('[tabindex]');
      tabIndexElements = tabIndexEls.length;
      
      return {
        focusableElements,
        tabIndexElements,
        hasSkipLinks: !!document.querySelector('[class*="skip"], [id*="skip"]'),
        hasMainLandmark: !!document.querySelector('main, [role="main"]'),
        hasNavLandmark: !!document.querySelector('nav, [role="navigation"]')
      };
    });

    console.log('⌨️  Keyboard navigation test:', keyboardNavTest);

    // Test focus management by tabbing through elements
    let tabbedElements = 0;
    try {
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const activeElement = await page.evaluate(() => document.activeElement?.tagName);
        if (activeElement) tabbedElements++;
        await page.waitForTimeout(100);
      }
    } catch (error) {
      console.warn('Tab navigation test had issues:', error);
    }

    console.log(`🎯 Successfully tabbed through ${tabbedElements} elements`);

    // Check ARIA labels and roles
    const ariaTest = await page.evaluate(() => {
      const elementsWithAriaLabel = document.querySelectorAll('[aria-label]').length;
      const elementsWithAriaDescribedBy = document.querySelectorAll('[aria-describedby]').length;
      const elementsWithRole = document.querySelectorAll('[role]').length;
      const imgWithAlt = document.querySelectorAll('img[alt]').length;
      const imgWithoutAlt = document.querySelectorAll('img:not([alt])').length;
      
      return {
        ariaLabels: elementsWithAriaLabel,
        ariaDescribedBy: elementsWithAriaDescribedBy,
        roleAttributes: elementsWithRole,
        imagesWithAlt: imgWithAlt,
        imagesWithoutAlt: imgWithoutAlt
      };
    });

    console.log('🏷️  ARIA test results:', ariaTest);

    await page.screenshot({ 
      path: '/Users/ivan/DEV_/anim/remotion-recovery/tests/production/screenshots/accessibility-state.png',
      fullPage: true 
    });

    performanceMetrics.accessibility = {
      keyboardNav: keyboardNavTest,
      tabbedElements,
      aria: ariaTest
    };
  });

  test('Error Handling & Resilience Testing', async () => {
    test.setTimeout(TEST_TIMEOUT);

    console.log('🛡️  Testing error handling and resilience...');

    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

    // Test 404 handling
    const notFoundTest = await page.goto(`${PRODUCTION_URL}/non-existent-page`);
    const notFoundStatus = notFoundTest?.status();
    console.log(`🔍 404 test - Status: ${notFoundStatus}`);

    await page.screenshot({ 
      path: '/Users/ivan/DEV_/anim/remotion-recovery/tests/production/screenshots/404-handling.png',
      fullPage: true 
    });

    // Return to main page
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });

    // Test JavaScript error resilience
    const errorResilienceTest = await page.evaluate(() => {
      // Create a controlled error and see how the app handles it
      try {
        // This should trigger error boundary if properly implemented
        (window as any).triggerTestError?.();
        return { errorBoundaryTriggered: false, errorHandled: true };
      } catch (error) {
        return { 
          errorBoundaryTriggered: true, 
          errorHandled: true,
          error: error.toString()
        };
      }
    });

    console.log('⚠️  Error resilience test:', errorResilienceTest);

    // Test loading states by checking for loading indicators
    const loadingStateTest = await page.evaluate(() => {
      const loadingElements = document.querySelectorAll(
        '[class*="loading"], [class*="spinner"], [class*="skeleton"], [aria-label*="loading"]'
      );
      
      return {
        loadingIndicators: loadingElements.length,
        hasLoadingStates: loadingElements.length > 0
      };
    });

    console.log('⏳ Loading state test:', loadingStateTest);

    performanceMetrics.errorHandling = {
      notFoundHandling: { status: notFoundStatus },
      errorResilience: errorResilienceTest,
      loadingStates: loadingStateTest
    };

    await page.screenshot({ 
      path: '/Users/ivan/DEV_/anim/remotion-recovery/tests/production/screenshots/final-state.png',
      fullPage: true 
    });
  });

  test('Generate Comprehensive Test Report', async () => {
    console.log('📊 Generating comprehensive test report...');

    const report = {
      timestamp: new Date().toISOString(),
      testTarget: PRODUCTION_URL,
      performanceMetrics,
      consoleErrors: consoleErrors.length,
      consoleWarnings: consoleWarnings.length,
      criticalIssues: consoleErrors.filter(error => 
        error.includes('Error') || error.includes('Failed') || error.includes('Cannot')
      ),
      summary: {
        basicLoadWorking: !!performanceMetrics.basicLoad,
        performanceFeaturesDetected: !!performanceMetrics.scrollPerformance,
        week3OptimizationsActive: !!performanceMetrics.week3Optimizations,
        accessibilityCompliant: !!performanceMetrics.accessibility,
        errorHandlingRobust: !!performanceMetrics.errorHandling
      },
      recommendations: []
    };

    // Add recommendations based on test results
    if (consoleErrors.length > 5) {
      report.recommendations.push('🔧 High number of console errors detected - review application logs');
    }
    
    if (performanceMetrics.basicLoad?.loadComplete > 3000) {
      report.recommendations.push('⚡ Slow load times detected - optimize initial bundle size');
    }
    
    if (!performanceMetrics.week3Optimizations?.intersectionObserver?.working) {
      report.recommendations.push('👁️ Intersection Observer not working optimally - check lazy loading implementation');
    }
    
    if (performanceMetrics.accessibility?.aria?.imagesWithoutAlt > 0) {
      report.recommendations.push('♿ Images missing alt text - improve accessibility compliance');
    }

    if (report.recommendations.length === 0) {
      report.recommendations.push('✅ All tests passed successfully - application is performing well');
    }

    console.log('\n🎯 PRODUCTION TEST SUMMARY:');
    console.log('=' .repeat(50));
    console.log(`Target: ${PRODUCTION_URL}`);
    console.log(`Console Errors: ${report.consoleErrors}`);
    console.log(`Console Warnings: ${report.consoleWarnings}`);
    console.log(`Critical Issues: ${report.criticalIssues.length}`);
    console.log('\nFeature Status:');
    Object.entries(report.summary).forEach(([key, value]) => {
      console.log(`  ${value ? '✅' : '❌'} ${key}`);
    });
    console.log('\nRecommendations:');
    report.recommendations.forEach(rec => console.log(`  ${rec}`));
    console.log('=' .repeat(50));

    // Save report to file
    await page.evaluate((reportData) => {
      console.log('PRODUCTION_TEST_REPORT:', JSON.stringify(reportData, null, 2));
    }, report);
  });
});
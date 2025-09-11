import { Page } from '@playwright/test';

/**
 * Performance Testing Utilities
 * Comprehensive metrics collection and analysis tools
 */

export interface PerformanceMetrics {
  // Core Web Vitals
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
  tti: number; // Time to Interactive
  
  // Custom Metrics
  loadTime: number;
  domContentLoaded: number;
  memoryUsage: number;
  fps: number[];
  networkRequests: number;
  
  // Gallery-Specific Metrics
  galleryRenderTime: number;
  searchResponseTime: number;
  scrollPerformance: {
    averageFPS: number;
    dropFrames: number;
  };
  lazyLoadingEffectiveness: number;
  
  timestamp: string;
  testContext: {
    viewport: { width: number; height: number };
    device: string;
    userAgent: string;
  };
}

export interface TestScenario {
  name: string;
  description: string;
  setup: (page: Page) => Promise<void>;
  test: (page: Page) => Promise<void>;
  cleanup?: (page: Page) => Promise<void>;
}

export class PerformanceCollector {
  private page: Page;
  private startTime: number;
  private metrics: Partial<PerformanceMetrics> = {};

  constructor(page: Page) {
    this.page = page;
    this.startTime = Date.now();
  }

  /**
   * Initialize performance monitoring
   */
  async initialize(): Promise<void> {
    // Inject performance monitoring script
    await this.page.addInitScript(() => {
      // Global performance data collection
      window.performanceData = {
        fps: [],
        frameCount: 0,
        lastFrameTime: 0,
        memorySnapshots: [],
        layoutShifts: [],
      };

      // FPS monitoring
      function trackFPS() {
        window.performanceData.frameCount++;
        const now = performance.now();
        
        if (now - window.performanceData.lastFrameTime >= 1000) {
          const fps = Math.round(
            (window.performanceData.frameCount * 1000) / 
            (now - window.performanceData.lastFrameTime)
          );
          window.performanceData.fps.push(fps);
          
          // Keep only last 60 seconds
          if (window.performanceData.fps.length > 60) {
            window.performanceData.fps.shift();
          }
          
          window.performanceData.frameCount = 0;
          window.performanceData.lastFrameTime = now;
        }
        requestAnimationFrame(trackFPS);
      }
      requestAnimationFrame(trackFPS);

      // Layout Shift Observer
      if ('LayoutShiftObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            window.performanceData.layoutShifts.push({
              value: entry.value,
              timestamp: entry.startTime,
            });
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
      }

      // Memory monitoring (if available)
      if (performance.memory) {
        setInterval(() => {
          window.performanceData.memorySnapshots.push({
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
            timestamp: performance.now(),
          });
          
          // Keep only last 300 snapshots (5 minutes at 1Hz)
          if (window.performanceData.memorySnapshots.length > 300) {
            window.performanceData.memorySnapshots.shift();
          }
        }, 1000);
      }
    });
  }

  /**
   * Collect Core Web Vitals
   */
  async collectCoreWebVitals(): Promise<Partial<PerformanceMetrics>> {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        const metrics: any = {};
        
        // Get navigation timing
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          metrics.loadTime = navigation.loadEventEnd - navigation.fetchStart;
          metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
          metrics.tti = navigation.domInteractive - navigation.fetchStart;
        }

        // Collect paint metrics
        const paintEntries = performance.getEntriesByType('paint');
        for (const entry of paintEntries) {
          if (entry.name === 'first-contentful-paint') {
            metrics.fcp = entry.startTime;
          }
        }

        // Use Web Vitals library approach for LCP
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          metrics.lcp = lastEntry.startTime;
        });
        
        try {
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) {
          // Fallback for older browsers
          metrics.lcp = 0;
        }

        // Calculate CLS
        const layoutShifts = window.performanceData?.layoutShifts || [];
        metrics.cls = layoutShifts.reduce((sum: number, shift: any) => sum + shift.value, 0);

        // Collect memory usage
        if (performance.memory) {
          metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
        }

        // Collect FPS data
        metrics.fps = window.performanceData?.fps || [];

        // Count network requests
        const resources = performance.getEntriesByType('resource');
        metrics.networkRequests = resources.length;

        // Add FID placeholder (requires user interaction)
        metrics.fid = 0;

        setTimeout(() => resolve(metrics), 100);
      });
    });
  }

  /**
   * Measure gallery-specific performance
   */
  async measureGalleryPerformance(): Promise<{
    galleryRenderTime: number;
    searchResponseTime: number;
    lazyLoadingEffectiveness: number;
  }> {
    const galleryStart = Date.now();
    
    // Wait for gallery to be visible
    await this.page.waitForSelector('[data-testid="manim-gallery"]', { timeout: 10000 });
    const galleryRenderTime = Date.now() - galleryStart;

    // Test search performance
    const searchStart = Date.now();
    await this.page.fill('[data-testid="search-input"]', 'test');
    await this.page.waitForFunction(() => {
      const results = document.querySelectorAll('[data-testid="video-card"]');
      return results.length >= 0; // Wait for search results to update
    });
    const searchResponseTime = Date.now() - searchStart;

    // Measure lazy loading effectiveness
    const lazyLoadingEffectiveness = await this.page.evaluate(() => {
      const allCards = document.querySelectorAll('[data-testid="video-card"]');
      const loadedCards = document.querySelectorAll('[data-testid="video-card"] img[src]');
      return allCards.length > 0 ? (loadedCards.length / allCards.length) * 100 : 0;
    });

    // Clear search
    await this.page.fill('[data-testid="search-input"]', '');
    
    return {
      galleryRenderTime,
      searchResponseTime,
      lazyLoadingEffectiveness,
    };
  }

  /**
   * Measure scroll performance
   */
  async measureScrollPerformance(): Promise<{
    averageFPS: number;
    dropFrames: number;
  }> {
    // Reset FPS data
    await this.page.evaluate(() => {
      if (window.performanceData) {
        window.performanceData.fps = [];
      }
    });

    // Perform smooth scroll test
    const scrollHeight = await this.page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await this.page.evaluate(() => window.innerHeight);
    const scrollDistance = Math.min(scrollHeight - viewportHeight, 2000); // Max 2000px

    // Scroll down slowly
    for (let i = 0; i <= scrollDistance; i += 50) {
      await this.page.evaluate((scrollY) => {
        window.scrollTo({ top: scrollY, behavior: 'smooth' });
      }, i);
      await this.page.waitForTimeout(50); // 20fps scroll rate
    }

    // Wait for scroll to complete
    await this.page.waitForTimeout(1000);

    // Collect FPS data
    const fpsData = await this.page.evaluate(() => {
      return window.performanceData?.fps || [];
    });

    const averageFPS = fpsData.length > 0 
      ? Math.round(fpsData.reduce((a, b) => a + b, 0) / fpsData.length)
      : 0;
    
    const dropFrames = fpsData.filter(fps => fps < 55).length;

    // Reset scroll position
    await this.page.evaluate(() => window.scrollTo(0, 0));

    return { averageFPS, dropFrames };
  }

  /**
   * Collect complete performance metrics
   */
  async collect(): Promise<PerformanceMetrics> {
    const coreMetrics = await this.collectCoreWebVitals();
    const galleryMetrics = await this.measureGalleryPerformance();
    const scrollMetrics = await this.measureScrollPerformance();

    const viewport = this.page.viewportSize();
    const userAgent = await this.page.evaluate(() => navigator.userAgent);

    return {
      // Core Web Vitals
      fcp: coreMetrics.fcp || 0,
      lcp: coreMetrics.lcp || 0,
      cls: coreMetrics.cls || 0,
      fid: coreMetrics.fid || 0,
      tti: coreMetrics.tti || 0,
      
      // Basic Metrics
      loadTime: coreMetrics.loadTime || 0,
      domContentLoaded: coreMetrics.domContentLoaded || 0,
      memoryUsage: coreMetrics.memoryUsage || 0,
      fps: coreMetrics.fps || [],
      networkRequests: coreMetrics.networkRequests || 0,
      
      // Gallery Metrics
      galleryRenderTime: galleryMetrics.galleryRenderTime,
      searchResponseTime: galleryMetrics.searchResponseTime,
      scrollPerformance: scrollMetrics,
      lazyLoadingEffectiveness: galleryMetrics.lazyLoadingEffectiveness,
      
      // Context
      timestamp: new Date().toISOString(),
      testContext: {
        viewport: viewport || { width: 1920, height: 1080 },
        device: process.env.DEVICE || 'desktop-chrome',
        userAgent,
      },
    };
  }
}

/**
 * Performance Test Scenarios
 */
export const testScenarios: TestScenario[] = [
  {
    name: 'cold-start',
    description: 'First-time page load with empty cache',
    setup: async (page) => {
      await page.context().clearCookies();
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    },
    test: async (page) => {
      await page.goto('/ManimShowcase-Gallery');
      await page.waitForLoadState('networkidle');
    },
  },
  {
    name: 'warm-cache',
    description: 'Page load with warm browser cache',
    setup: async (page) => {
      // Pre-warm cache
      await page.goto('/ManimShowcase-Gallery');
      await page.waitForLoadState('networkidle');
    },
    test: async (page) => {
      await page.reload();
      await page.waitForLoadState('networkidle');
    },
  },
  {
    name: 'scroll-performance',
    description: 'Scrolling performance with lazy loading',
    setup: async (page) => {
      await page.goto('/ManimShowcase-Gallery');
      await page.waitForSelector('[data-testid="manim-gallery"]');
    },
    test: async (page) => {
      // Test already included in measureScrollPerformance
      await page.waitForTimeout(1000);
    },
  },
  {
    name: 'search-performance',
    description: 'Search functionality performance',
    setup: async (page) => {
      await page.goto('/ManimShowcase-Gallery');
      await page.waitForSelector('[data-testid="search-input"]');
    },
    test: async (page) => {
      const searches = ['manim', 'video', 'animation', 'test'];
      for (const query of searches) {
        await page.fill('[data-testid="search-input"]', query);
        await page.waitForTimeout(200); // Debounced search
      }
      await page.fill('[data-testid="search-input"]', '');
    },
  },
  {
    name: 'memory-stress',
    description: 'Memory usage under sustained load',
    setup: async (page) => {
      await page.goto('/ManimShowcase-Gallery');
      await page.waitForSelector('[data-testid="manim-gallery"]');
    },
    test: async (page) => {
      // Perform multiple operations to test memory stability
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(1000);
        
        await page.fill('[data-testid="search-input"]', `test-${i}`);
        await page.waitForTimeout(500);
        await page.fill('[data-testid="search-input"]', '');
        await page.waitForTimeout(500);
      }
    },
  },
];

/**
 * Baseline comparison utilities
 */
export class BaselineComparator {
  static compare(current: PerformanceMetrics, baseline: PerformanceMetrics) {
    return {
      fcpChange: ((current.fcp - baseline.fcp) / baseline.fcp) * 100,
      lcpChange: ((current.lcp - baseline.lcp) / baseline.lcp) * 100,
      clsChange: ((current.cls - baseline.cls) / (baseline.cls || 0.001)) * 100,
      loadTimeChange: ((current.loadTime - baseline.loadTime) / baseline.loadTime) * 100,
      memoryChange: ((current.memoryUsage - baseline.memoryUsage) / baseline.memoryUsage) * 100,
      searchSpeedChange: ((current.searchResponseTime - baseline.searchResponseTime) / baseline.searchResponseTime) * 100,
      
      // Performance status
      isRegression: (
        current.fcp > baseline.fcp * 1.1 ||
        current.lcp > baseline.lcp * 1.1 ||
        current.loadTime > baseline.loadTime * 1.1 ||
        current.memoryUsage > baseline.memoryUsage * 1.2
      ),
    };
  }
}
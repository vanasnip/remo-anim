import { test, expect } from '@playwright/test';
import { PerformanceCollector, testScenarios, BaselineComparator, PerformanceMetrics } from './performance-utils';
import fs from 'fs';
import path from 'path';

/**
 * ManimShowcase Performance Test Suite
 * Comprehensive automated performance testing for gallery optimizations
 */

// Test configuration
const PERFORMANCE_THRESHOLDS = {
  fcp: 2000, // 2s
  lcp: 3000, // 3s
  cls: 0.1,
  tti: 4000, // 4s
  memoryUsage: 50, // 50MB
  searchResponseTime: 100, // 100ms
  galleryRenderTime: 200, // 200ms
  minFPS: 55, // Minimum acceptable FPS
  maxFrameDrops: 3, // Maximum dropped frames during scroll
};

const BASELINE_FILE = 'performance-baselines/current.json';
const RESULTS_DIR = 'performance-results';

// Ensure results directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  if (!fs.existsSync('performance-baselines')) {
    fs.mkdirSync('performance-baselines', { recursive: true });
  }
});

test.describe('ManimShowcase Performance Tests', () => {
  let performanceResults: PerformanceMetrics[] = [];

  test.afterAll(async () => {
    // Save all performance results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(RESULTS_DIR, `performance-${timestamp}.json`);
    
    fs.writeFileSync(resultsFile, JSON.stringify({
      testRun: {
        timestamp,
        device: process.env.DEVICE || 'desktop-chrome',
        thresholds: PERFORMANCE_THRESHOLDS,
      },
      results: performanceResults,
      summary: generateSummary(performanceResults),
    }, null, 2));

    console.log(`Performance results saved to: ${resultsFile}`);
  });

  // Core Performance Tests
  for (const scenario of testScenarios) {
    test(`Performance Test: ${scenario.name}`, async ({ page }) => {
      console.log(`\n🧪 Testing scenario: ${scenario.description}`);

      // Initialize performance collection
      const collector = new PerformanceCollector(page);
      await collector.initialize();

      // Setup scenario
      if (scenario.setup) {
        await scenario.setup(page);
      }

      // Run test scenario
      const testStart = Date.now();
      await scenario.test(page);
      const testDuration = Date.now() - testStart;

      // Collect metrics
      const metrics = await collector.collect();
      metrics.testScenario = scenario.name;
      metrics.testDuration = testDuration;

      performanceResults.push(metrics);

      // Validate against thresholds
      await validatePerformanceThresholds(metrics, scenario.name);

      // Cleanup
      if (scenario.cleanup) {
        await scenario.cleanup(page);
      }

      console.log(`✅ Completed ${scenario.name} in ${testDuration}ms`);
    });
  }

  // Regression Detection Test
  test('Performance Regression Detection', async ({ page }) => {
    if (performanceResults.length === 0) {
      test.skip('No performance results available for regression testing');
      return;
    }

    // Load baseline if exists
    let baseline: PerformanceMetrics | null = null;
    if (fs.existsSync(BASELINE_FILE)) {
      try {
        const baselineData = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
        baseline = baselineData.metrics;
      } catch (error) {
        console.warn('Could not load baseline metrics:', error);
      }
    }

    if (!baseline) {
      console.log('📊 No baseline found, establishing new baseline...');
      const coldStartMetrics = performanceResults.find(m => m.testScenario === 'cold-start');
      if (coldStartMetrics) {
        baseline = coldStartMetrics;
        fs.writeFileSync(BASELINE_FILE, JSON.stringify({
          established: new Date().toISOString(),
          metrics: baseline,
        }, null, 2));
        console.log('✅ Baseline established');
      }
      return;
    }

    // Compare with baseline
    const currentMetrics = performanceResults.find(m => m.testScenario === 'cold-start') || performanceResults[0];
    const comparison = BaselineComparator.compare(currentMetrics, baseline);

    console.log('\n📈 Performance Comparison with Baseline:');
    console.log(`  FCP: ${comparison.fcpChange.toFixed(1)}% ${comparison.fcpChange > 0 ? '⬆️' : '⬇️'}`);
    console.log(`  LCP: ${comparison.lcpChange.toFixed(1)}% ${comparison.lcpChange > 0 ? '⬆️' : '⬇️'}`);
    console.log(`  Load Time: ${comparison.loadTimeChange.toFixed(1)}% ${comparison.loadTimeChange > 0 ? '⬆️' : '⬇️'}`);
    console.log(`  Memory: ${comparison.memoryChange.toFixed(1)}% ${comparison.memoryChange > 0 ? '⬆️' : '⬇️'}`);
    console.log(`  Search Speed: ${comparison.searchSpeedChange.toFixed(1)}% ${comparison.searchSpeedChange > 0 ? '⬆️' : '⬇️'}`);

    // Check for regressions
    if (comparison.isRegression) {
      console.error('🚨 Performance regression detected!');
      
      // Create detailed regression report
      const regressionReport = {
        timestamp: new Date().toISOString(),
        regression: true,
        baseline: baseline,
        current: currentMetrics,
        comparison: comparison,
        thresholds: PERFORMANCE_THRESHOLDS,
      };
      
      const regressionFile = path.join(RESULTS_DIR, `regression-${Date.now()}.json`);
      fs.writeFileSync(regressionFile, JSON.stringify(regressionReport, null, 2));
      
      // Soft fail in development, hard fail in CI
      if (process.env.CI) {
        throw new Error('Performance regression detected in CI environment');
      } else {
        console.warn('Performance regression detected in development - check regression report');
      }
    } else {
      console.log('✅ No performance regression detected');
    }
  });

  // Long-term Stability Test
  test('Memory Leak Detection', async ({ page }) => {
    console.log('\n🧪 Testing memory stability over extended usage...');

    const collector = new PerformanceCollector(page);
    await collector.initialize();

    await page.goto('/ManimShowcase-Gallery');
    await page.waitForSelector('[data-testid="manim-gallery"]');

    const initialMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0;
    });

    // Simulate 5 minutes of heavy usage
    for (let cycle = 0; cycle < 10; cycle++) {
      console.log(`  Memory test cycle ${cycle + 1}/10`);
      
      // Scroll operations
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);
      
      // Search operations
      await page.fill('[data-testid="search-input"]', `test-query-${cycle}`);
      await page.waitForTimeout(500);
      await page.fill('[data-testid="search-input"]', '');
      await page.waitForTimeout(500);

      // Force garbage collection (if available)
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
      
      await page.waitForTimeout(1000);
    }

    const finalMemory = await page.evaluate(() => {
      return performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0;
    });

    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;

    console.log(`📊 Memory Usage Analysis:`);
    console.log(`  Initial: ${initialMemory.toFixed(1)} MB`);
    console.log(`  Final: ${finalMemory.toFixed(1)} MB`);
    console.log(`  Increase: ${memoryIncrease.toFixed(1)} MB (${memoryIncreasePercent.toFixed(1)}%)`);

    // Memory leak detection (more than 50% increase suggests a leak)
    if (memoryIncreasePercent > 50) {
      console.error('🚨 Potential memory leak detected!');
      const leakReport = {
        timestamp: new Date().toISOString(),
        initialMemory,
        finalMemory,
        memoryIncrease,
        memoryIncreasePercent,
        testCycles: 10,
      };
      
      const leakFile = path.join(RESULTS_DIR, `memory-leak-${Date.now()}.json`);
      fs.writeFileSync(leakFile, JSON.stringify(leakReport, null, 2));
      
      if (process.env.CI) {
        throw new Error('Memory leak detected in CI environment');
      }
    } else {
      console.log('✅ No significant memory leaks detected');
    }
  });
});

/**
 * Validate performance metrics against thresholds
 */
async function validatePerformanceThresholds(metrics: PerformanceMetrics, scenarioName: string) {
  const failures: string[] = [];

  if (metrics.fcp > PERFORMANCE_THRESHOLDS.fcp) {
    failures.push(`FCP: ${metrics.fcp}ms > ${PERFORMANCE_THRESHOLDS.fcp}ms`);
  }
  
  if (metrics.lcp > PERFORMANCE_THRESHOLDS.lcp) {
    failures.push(`LCP: ${metrics.lcp}ms > ${PERFORMANCE_THRESHOLDS.lcp}ms`);
  }
  
  if (metrics.cls > PERFORMANCE_THRESHOLDS.cls) {
    failures.push(`CLS: ${metrics.cls} > ${PERFORMANCE_THRESHOLDS.cls}`);
  }
  
  if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.memoryUsage) {
    failures.push(`Memory: ${metrics.memoryUsage}MB > ${PERFORMANCE_THRESHOLDS.memoryUsage}MB`);
  }
  
  if (metrics.searchResponseTime > PERFORMANCE_THRESHOLDS.searchResponseTime) {
    failures.push(`Search: ${metrics.searchResponseTime}ms > ${PERFORMANCE_THRESHOLDS.searchResponseTime}ms`);
  }
  
  if (metrics.galleryRenderTime > PERFORMANCE_THRESHOLDS.galleryRenderTime) {
    failures.push(`Gallery Render: ${metrics.galleryRenderTime}ms > ${PERFORMANCE_THRESHOLDS.galleryRenderTime}ms`);
  }
  
  if (metrics.scrollPerformance.averageFPS < PERFORMANCE_THRESHOLDS.minFPS) {
    failures.push(`FPS: ${metrics.scrollPerformance.averageFPS} < ${PERFORMANCE_THRESHOLDS.minFPS}`);
  }
  
  if (metrics.scrollPerformance.dropFrames > PERFORMANCE_THRESHOLDS.maxFrameDrops) {
    failures.push(`Dropped Frames: ${metrics.scrollPerformance.dropFrames} > ${PERFORMANCE_THRESHOLDS.maxFrameDrops}`);
  }

  if (failures.length > 0) {
    console.warn(`⚠️ Performance thresholds exceeded in ${scenarioName}:`);
    failures.forEach(failure => console.warn(`    ${failure}`));
    
    if (process.env.CI) {
      throw new Error(`Performance thresholds exceeded: ${failures.join(', ')}`);
    }
  } else {
    console.log(`✅ All performance thresholds met for ${scenarioName}`);
  }
}

/**
 * Generate performance summary
 */
function generateSummary(results: PerformanceMetrics[]) {
  if (results.length === 0) return null;

  const summary = {
    totalTests: results.length,
    averageMetrics: {
      fcp: Math.round(results.reduce((sum, r) => sum + r.fcp, 0) / results.length),
      lcp: Math.round(results.reduce((sum, r) => sum + r.lcp, 0) / results.length),
      cls: Math.round((results.reduce((sum, r) => sum + r.cls, 0) / results.length) * 1000) / 1000,
      memoryUsage: Math.round(results.reduce((sum, r) => sum + r.memoryUsage, 0) / results.length),
      searchResponseTime: Math.round(results.reduce((sum, r) => sum + r.searchResponseTime, 0) / results.length),
      galleryRenderTime: Math.round(results.reduce((sum, r) => sum + r.galleryRenderTime, 0) / results.length),
    },
    bestPerformance: {
      scenario: results.reduce((best, current) => 
        current.loadTime < best.loadTime ? current : best
      ).testScenario,
      loadTime: Math.min(...results.map(r => r.loadTime)),
    },
    worstPerformance: {
      scenario: results.reduce((worst, current) => 
        current.loadTime > worst.loadTime ? current : worst
      ).testScenario,
      loadTime: Math.max(...results.map(r => r.loadTime)),
    },
  };

  return summary;
}
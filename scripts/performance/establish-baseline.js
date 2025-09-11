#!/usr/bin/env node

/**
 * Baseline Establishment Script
 * Creates initial performance baselines for regression detection
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎯 Establishing Performance Baseline\n');

// Configuration
const BASELINE_DIR = 'performance-baselines';
const RESULTS_DIR = 'performance-results';
const BASELINE_FILE = path.join(BASELINE_DIR, 'current.json');
const RETRY_COUNT = 3;

// Ensure directories exist
if (!fs.existsSync(BASELINE_DIR)) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
}

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * Run performance tests and establish baseline
 */
async function establishBaseline() {
  console.log('🔄 Running performance tests to establish baseline...\n');
  
  let bestResults = null;
  let attempts = 0;
  
  // Run tests multiple times and use the best result as baseline
  while (attempts < RETRY_COUNT) {
    attempts++;
    console.log(`📊 Baseline attempt ${attempts}/${RETRY_COUNT}`);
    
    try {
      // Run performance tests
      const result = execSync('npm run test:performance:ci', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Find the latest results file
      const resultsFiles = fs.readdirSync(RESULTS_DIR)
        .filter(file => file.startsWith('performance-') && file.endsWith('.json'))
        .sort()
        .reverse();
      
      if (resultsFiles.length === 0) {
        throw new Error('No performance results found');
      }
      
      const latestResultsFile = path.join(RESULTS_DIR, resultsFiles[0]);
      const results = JSON.parse(fs.readFileSync(latestResultsFile, 'utf8'));
      
      // Extract cold-start metrics for baseline
      const coldStartResult = results.results.find(r => r.testScenario === 'cold-start');
      if (!coldStartResult) {
        throw new Error('Cold-start metrics not found in results');
      }
      
      // Use the best result (lowest load time)
      if (!bestResults || coldStartResult.loadTime < bestResults.loadTime) {
        bestResults = coldStartResult;
        console.log(`✅ New best result: ${coldStartResult.loadTime}ms load time`);
      } else {
        console.log(`📊 Current result: ${coldStartResult.loadTime}ms (baseline: ${bestResults.loadTime}ms)`);
      }
      
      // Wait between attempts
      if (attempts < RETRY_COUNT) {
        console.log('⏳ Waiting 5 seconds before next attempt...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
    } catch (error) {
      console.error(`❌ Attempt ${attempts} failed:`, error.message);
      
      if (attempts === RETRY_COUNT) {
        console.error('🚨 All baseline attempts failed!');
        process.exit(1);
      }
      
      // Wait before retry
      console.log('⏳ Waiting 10 seconds before retry...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  if (!bestResults) {
    console.error('🚨 Failed to establish baseline after all attempts');
    process.exit(1);
  }
  
  // Save baseline
  const baselineData = {
    established: new Date().toISOString(),
    attempts: RETRY_COUNT,
    metrics: bestResults,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      ci: !!process.env.CI,
    },
    thresholds: {
      fcp: 2000,
      lcp: 3000,
      cls: 0.1,
      tti: 4000,
      memoryUsage: 50,
      searchResponseTime: 100,
      galleryRenderTime: 200,
    }
  };
  
  // Backup existing baseline
  if (fs.existsSync(BASELINE_FILE)) {
    const backup = path.join(BASELINE_DIR, `baseline-backup-${Date.now()}.json`);
    fs.copyFileSync(BASELINE_FILE, backup);
    console.log(`📁 Previous baseline backed up to: ${backup}`);
  }
  
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baselineData, null, 2));
  
  console.log(`\n✅ Baseline established successfully!`);
  console.log(`📄 Baseline file: ${BASELINE_FILE}`);
  console.log(`\n📊 Baseline Metrics:`);
  console.log(`  🎯 Load Time: ${bestResults.loadTime}ms`);
  console.log(`  🎨 First Contentful Paint: ${bestResults.fcp}ms`);
  console.log(`  🖼️  Largest Contentful Paint: ${bestResults.lcp}ms`);
  console.log(`  📏 Cumulative Layout Shift: ${bestResults.cls}`);
  console.log(`  💾 Memory Usage: ${bestResults.memoryUsage}MB`);
  console.log(`  🔍 Search Response Time: ${bestResults.searchResponseTime}ms`);
  console.log(`  🎬 Gallery Render Time: ${bestResults.galleryRenderTime}ms`);
  console.log(`  📈 Average FPS: ${bestResults.scrollPerformance.averageFPS}`);
  console.log(`  ⬇️  Lazy Loading Effectiveness: ${bestResults.lazyLoadingEffectiveness}%`);
  
  return baselineData;
}

/**
 * Validate baseline quality
 */
function validateBaseline(baselineData) {
  console.log('\n🔍 Validating baseline quality...');
  
  const metrics = baselineData.metrics;
  const thresholds = baselineData.thresholds;
  const issues = [];
  
  // Check if metrics meet quality standards
  if (metrics.fcp > thresholds.fcp) {
    issues.push(`FCP too slow: ${metrics.fcp}ms > ${thresholds.fcp}ms`);
  }
  
  if (metrics.lcp > thresholds.lcp) {
    issues.push(`LCP too slow: ${metrics.lcp}ms > ${thresholds.lcp}ms`);
  }
  
  if (metrics.cls > thresholds.cls) {
    issues.push(`CLS too high: ${metrics.cls} > ${thresholds.cls}`);
  }
  
  if (metrics.memoryUsage > thresholds.memoryUsage) {
    issues.push(`Memory usage too high: ${metrics.memoryUsage}MB > ${thresholds.memoryUsage}MB`);
  }
  
  if (metrics.scrollPerformance.averageFPS < 55) {
    issues.push(`FPS too low: ${metrics.scrollPerformance.averageFPS} < 55`);
  }
  
  if (issues.length > 0) {
    console.warn('⚠️  Baseline quality issues detected:');
    issues.forEach(issue => console.warn(`  - ${issue}`));
    console.warn('\nConsider investigating performance issues before using this baseline.');
    
    if (process.env.CI) {
      console.error('🚨 Poor baseline quality in CI environment');
      process.exit(1);
    }
  } else {
    console.log('✅ Baseline quality validation passed');
  }
  
  return issues.length === 0;
}

/**
 * Generate baseline report
 */
function generateReport(baselineData) {
  const reportFile = path.join(BASELINE_DIR, 'baseline-report.md');
  const timestamp = new Date().toLocaleString();
  
  const report = `# Performance Baseline Report

## Establishment Details
- **Date**: ${timestamp}
- **Environment**: ${process.platform} ${process.arch}
- **Node Version**: ${process.version}
- **CI Environment**: ${process.env.CI ? 'Yes' : 'No'}
- **Attempts**: ${baselineData.attempts}

## Performance Metrics

### Core Web Vitals
- **First Contentful Paint (FCP)**: ${baselineData.metrics.fcp}ms
- **Largest Contentful Paint (LCP)**: ${baselineData.metrics.lcp}ms
- **Cumulative Layout Shift (CLS)**: ${baselineData.metrics.cls}
- **Time to Interactive (TTI)**: ${baselineData.metrics.tti}ms

### Application Performance
- **Load Time**: ${baselineData.metrics.loadTime}ms
- **DOM Content Loaded**: ${baselineData.metrics.domContentLoaded}ms
- **Memory Usage**: ${baselineData.metrics.memoryUsage}MB
- **Network Requests**: ${baselineData.metrics.networkRequests}

### Gallery-Specific Metrics
- **Gallery Render Time**: ${baselineData.metrics.galleryRenderTime}ms
- **Search Response Time**: ${baselineData.metrics.searchResponseTime}ms
- **Lazy Loading Effectiveness**: ${baselineData.metrics.lazyLoadingEffectiveness}%

### Scroll Performance
- **Average FPS**: ${baselineData.metrics.scrollPerformance.averageFPS}
- **Dropped Frames**: ${baselineData.metrics.scrollPerformance.dropFrames}

## Thresholds
- **FCP Threshold**: ${baselineData.thresholds.fcp}ms
- **LCP Threshold**: ${baselineData.thresholds.lcp}ms
- **CLS Threshold**: ${baselineData.thresholds.cls}
- **Memory Threshold**: ${baselineData.thresholds.memoryUsage}MB
- **Search Threshold**: ${baselineData.thresholds.searchResponseTime}ms

## Next Steps
1. Use this baseline for regression detection
2. Run \`npm run test:regression\` to compare against this baseline
3. Update baseline when making intentional performance improvements
4. Monitor CI/CD pipeline for performance regressions

---
Generated on ${timestamp} by establish-baseline.js
`;
  
  fs.writeFileSync(reportFile, report);
  console.log(`📄 Baseline report generated: ${reportFile}`);
}

// Main execution
async function main() {
  try {
    const baselineData = await establishBaseline();
    const isValid = validateBaseline(baselineData);
    generateReport(baselineData);
    
    console.log('\n🎉 Baseline establishment complete!');
    console.log('\n📋 Next steps:');
    console.log('  1. Review the baseline report for quality');
    console.log('  2. Run performance tests: npm run test:performance');
    console.log('  3. Check for regressions: npm run test:regression');
    console.log('  4. Integrate into CI/CD pipeline');
    
    process.exit(isValid ? 0 : 1);
    
  } catch (error) {
    console.error('🚨 Failed to establish baseline:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { establishBaseline, validateBaseline };
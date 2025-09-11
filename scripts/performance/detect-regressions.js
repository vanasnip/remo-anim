#!/usr/bin/env node

/**
 * Performance Regression Detection Script
 * Compares current performance against established baseline
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Performance Regression Detection\n');

// Configuration
const BASELINE_DIR = 'performance-baselines';
const RESULTS_DIR = 'performance-results';
const BASELINE_FILE = path.join(BASELINE_DIR, 'current.json');
const REGRESSION_THRESHOLD = 10; // 10% regression threshold

/**
 * Load baseline metrics
 */
function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error('❌ No baseline found. Run `npm run test:baseline` first.');
    process.exit(1);
  }
  
  try {
    const baselineData = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    console.log(`📊 Loaded baseline from: ${baselineData.established}`);
    return baselineData;
  } catch (error) {
    console.error('❌ Failed to load baseline:', error.message);
    process.exit(1);
  }
}

/**
 * Run current performance tests
 */
function runCurrentTests() {
  console.log('🧪 Running current performance tests...\n');
  
  try {
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
    
    // Extract cold-start metrics for comparison
    const coldStartResult = results.results.find(r => r.testScenario === 'cold-start');
    if (!coldStartResult) {
      throw new Error('Cold-start metrics not found in current results');
    }
    
    console.log(`✅ Current test results loaded from: ${latestResultsFile}`);
    return { fullResults: results, metrics: coldStartResult };
    
  } catch (error) {
    console.error('❌ Failed to run current tests:', error.message);
    process.exit(1);
  }
}

/**
 * Compare metrics and detect regressions
 */
function detectRegressions(baseline, current) {
  console.log('\n📈 Performance Comparison Analysis\n');
  
  const regressions = [];
  const improvements = [];
  const stable = [];
  
  // Define comparison metrics with their acceptable degradation thresholds
  const comparisons = [
    { key: 'fcp', name: 'First Contentful Paint', unit: 'ms', threshold: REGRESSION_THRESHOLD },
    { key: 'lcp', name: 'Largest Contentful Paint', unit: 'ms', threshold: REGRESSION_THRESHOLD },
    { key: 'cls', name: 'Cumulative Layout Shift', unit: '', threshold: 20 }, // 20% for CLS
    { key: 'loadTime', name: 'Load Time', unit: 'ms', threshold: REGRESSION_THRESHOLD },
    { key: 'memoryUsage', name: 'Memory Usage', unit: 'MB', threshold: 20 },
    { key: 'searchResponseTime', name: 'Search Response Time', unit: 'ms', threshold: 15 },
    { key: 'galleryRenderTime', name: 'Gallery Render Time', unit: 'ms', threshold: 15 },
  ];
  
  // Special handling for nested metrics
  const scrollPerformanceComparison = {
    key: 'scrollPerformance.averageFPS',
    name: 'Average FPS',
    unit: 'fps',
    threshold: -5, // 5 FPS drop is significant
    getValue: (metrics) => metrics.scrollPerformance?.averageFPS || 0
  };
  
  console.log('Metric'.padEnd(25) + '| Baseline'.padEnd(12) + '| Current'.padEnd(12) + '| Change'.padEnd(12) + '| Status');
  console.log('-'.repeat(80));
  
  // Compare standard metrics
  comparisons.forEach(comp => {
    const baselineValue = baseline.metrics[comp.key] || 0;
    const currentValue = current.metrics[comp.key] || 0;
    const percentChange = baselineValue > 0 ? ((currentValue - baselineValue) / baselineValue) * 100 : 0;
    
    let status = '✅ STABLE';
    let category = stable;
    
    if (Math.abs(percentChange) > comp.threshold) {
      if (percentChange > 0) {
        // Regression (worse performance)
        status = '🚨 REGRESSION';
        category = regressions;
      } else {
        // Improvement
        status = '🎉 IMPROVEMENT';
        category = improvements;
      }
    }
    
    category.push({
      name: comp.name,
      baseline: baselineValue,
      current: currentValue,
      change: percentChange,
      threshold: comp.threshold
    });
    
    const baselineStr = `${baselineValue.toFixed(comp.key === 'cls' ? 3 : 0)}${comp.unit}`;
    const currentStr = `${currentValue.toFixed(comp.key === 'cls' ? 3 : 0)}${comp.unit}`;
    const changeStr = `${percentChange >= 0 ? '+' : ''}${percentChange.toFixed(1)}%`;
    
    console.log(
      comp.name.padEnd(25) + '| ' +
      baselineStr.padEnd(11) + '| ' +
      currentStr.padEnd(11) + '| ' +
      changeStr.padEnd(11) + '| ' +
      status
    );
  });
  
  // Compare FPS (special case - lower is worse)
  const baselineFPS = scrollPerformanceComparison.getValue(baseline.metrics);
  const currentFPS = scrollPerformanceComparison.getValue(current.metrics);
  const fpsChange = currentFPS - baselineFPS;
  const fpsPercentChange = baselineFPS > 0 ? (fpsChange / baselineFPS) * 100 : 0;
  
  let fpsStatus = '✅ STABLE';
  let fpsCategory = stable;
  
  if (fpsChange < scrollPerformanceComparison.threshold) {
    fpsStatus = '🚨 REGRESSION';
    fpsCategory = regressions;
  } else if (fpsChange > 2) {
    fpsStatus = '🎉 IMPROVEMENT';
    fpsCategory = improvements;
  }
  
  fpsCategory.push({
    name: scrollPerformanceComparison.name,
    baseline: baselineFPS,
    current: currentFPS,
    change: fpsPercentChange,
    threshold: scrollPerformanceComparison.threshold
  });
  
  const baselineFPSStr = `${baselineFPS.toFixed(0)}fps`;
  const currentFPSStr = `${currentFPS.toFixed(0)}fps`;
  const fpsChangeStr = `${fpsChange >= 0 ? '+' : ''}${fpsChange.toFixed(1)}fps`;
  
  console.log(
    scrollPerformanceComparison.name.padEnd(25) + '| ' +
    baselineFPSStr.padEnd(11) + '| ' +
    currentFPSStr.padEnd(11) + '| ' +
    fpsChangeStr.padEnd(11) + '| ' +
    fpsStatus
  );
  
  return { regressions, improvements, stable };
}

/**
 * Generate regression report
 */
function generateRegressionReport(baseline, current, analysis) {
  const timestamp = new Date().toISOString();
  const reportData = {
    timestamp,
    baseline: {
      established: baseline.established,
      metrics: baseline.metrics
    },
    current: {
      metrics: current.metrics,
      testContext: current.metrics.testContext
    },
    analysis,
    summary: {
      totalMetrics: analysis.regressions.length + analysis.improvements.length + analysis.stable.length,
      regressions: analysis.regressions.length,
      improvements: analysis.improvements.length,
      stable: analysis.stable.length,
      hasRegressions: analysis.regressions.length > 0,
      overallStatus: analysis.regressions.length > 0 ? 'REGRESSION' : 
                     analysis.improvements.length > analysis.stable.length ? 'IMPROVEMENT' : 'STABLE'
    }
  };
  
  // Save detailed JSON report
  const jsonReportFile = path.join(RESULTS_DIR, `regression-${Date.now()}.json`);
  fs.writeFileSync(jsonReportFile, JSON.stringify(reportData, null, 2));
  
  // Generate markdown report
  const mdReportFile = path.join(RESULTS_DIR, `regression-${Date.now()}.md`);
  const mdReport = generateMarkdownReport(reportData);
  fs.writeFileSync(mdReportFile, mdReport);
  
  console.log(`\n📄 Regression reports generated:`);
  console.log(`  📊 JSON: ${jsonReportFile}`);
  console.log(`  📝 Markdown: ${mdReportFile}`);
  
  return reportData;
}

/**
 * Generate markdown regression report
 */
function generateMarkdownReport(reportData) {
  const { baseline, current, analysis, summary } = reportData;
  
  return `# Performance Regression Report

## Test Summary
- **Test Date**: ${new Date(reportData.timestamp).toLocaleString()}
- **Baseline Date**: ${new Date(baseline.established).toLocaleString()}
- **Overall Status**: ${summary.overallStatus === 'REGRESSION' ? '🚨' : summary.overallStatus === 'IMPROVEMENT' ? '🎉' : '✅'} ${summary.overallStatus}

## Results Overview
- **Total Metrics Compared**: ${summary.totalMetrics}
- **Regressions Detected**: ${summary.regressions}
- **Improvements Found**: ${summary.improvements}
- **Stable Metrics**: ${summary.stable}

${analysis.regressions.length > 0 ? `## 🚨 Regressions Detected

${analysis.regressions.map(reg => 
  `### ${reg.name}
- **Baseline**: ${reg.baseline.toFixed(2)}
- **Current**: ${reg.current.toFixed(2)}
- **Change**: ${reg.change >= 0 ? '+' : ''}${reg.change.toFixed(1)}%
- **Threshold**: ${reg.threshold}%`
).join('\n\n')}` : ''}

${analysis.improvements.length > 0 ? `## 🎉 Improvements Found

${analysis.improvements.map(imp => 
  `### ${imp.name}
- **Baseline**: ${imp.baseline.toFixed(2)}
- **Current**: ${imp.current.toFixed(2)}
- **Change**: ${imp.change >= 0 ? '+' : ''}${imp.change.toFixed(1)}%`
).join('\n\n')}` : ''}

## Detailed Metrics

| Metric | Baseline | Current | Change | Status |
|--------|----------|---------|---------|---------|
${[...analysis.regressions, ...analysis.improvements, ...analysis.stable]
  .map(item => `| ${item.name} | ${item.baseline.toFixed(2)} | ${item.current.toFixed(2)} | ${item.change >= 0 ? '+' : ''}${item.change.toFixed(1)}% | ${analysis.regressions.includes(item) ? '🚨 REGRESSION' : analysis.improvements.includes(item) ? '🎉 IMPROVEMENT' : '✅ STABLE'} |`)
  .join('\n')}

## Environment Details
- **Device**: ${current.metrics.testContext?.device || 'Unknown'}
- **Viewport**: ${current.metrics.testContext?.viewport?.width || 'Unknown'}x${current.metrics.testContext?.viewport?.height || 'Unknown'}
- **User Agent**: ${current.metrics.testContext?.userAgent || 'Unknown'}

## Recommendations

${analysis.regressions.length > 0 ? 
  `### Immediate Actions Required
- Review recent changes that may have caused performance degradation
- Run additional tests to confirm regression
- Consider reverting recent changes if regression is severe
- Profile the application to identify performance bottlenecks

` : ''}${analysis.improvements.length > 0 ? 
  `### Performance Improvements Noted
- Document the changes that led to improvements
- Consider updating the baseline if improvements are intentional and stable
- Share improvements with the team for knowledge sharing

` : ''}### General Recommendations
- Continue monitoring performance in CI/CD pipeline
- Update baseline after confirmed intentional changes
- Run full performance test suite before major releases

---
*Generated by detect-regressions.js on ${new Date(reportData.timestamp).toLocaleString()}*
`;
}

/**
 * Main execution
 */
async function main() {
  try {
    // Load baseline
    const baseline = loadBaseline();
    
    // Run current tests
    const current = runCurrentTests();
    
    // Detect regressions
    const analysis = detectRegressions(baseline, current);
    
    // Generate report
    const report = generateRegressionReport(baseline, current, analysis);
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('🎯 REGRESSION DETECTION SUMMARY');
    console.log('='.repeat(60));
    
    if (analysis.regressions.length > 0) {
      console.log(`🚨 ${analysis.regressions.length} REGRESSION(S) DETECTED:`);
      analysis.regressions.forEach(reg => {
        console.log(`  - ${reg.name}: ${reg.change >= 0 ? '+' : ''}${reg.change.toFixed(1)}% (${reg.baseline.toFixed(1)} → ${reg.current.toFixed(1)})`);
      });
    }
    
    if (analysis.improvements.length > 0) {
      console.log(`🎉 ${analysis.improvements.length} IMPROVEMENT(S) FOUND:`);
      analysis.improvements.forEach(imp => {
        console.log(`  - ${imp.name}: ${imp.change >= 0 ? '+' : ''}${imp.change.toFixed(1)}% (${imp.baseline.toFixed(1)} → ${imp.current.toFixed(1)})`);
      });
    }
    
    console.log(`✅ ${analysis.stable.length} metrics remained stable`);
    
    console.log('\n📋 Next Steps:');
    if (analysis.regressions.length > 0) {
      console.log('  1. 🔍 Investigate performance regressions immediately');
      console.log('  2. 🔄 Consider reverting recent changes if severe');
      console.log('  3. 📊 Run additional profiling to identify bottlenecks');
      console.log('  4. 🧪 Re-test after fixes are applied');
    } else {
      console.log('  1. ✅ No action required - performance is stable/improved');
      console.log('  2. 📊 Continue monitoring in future runs');
      console.log('  3. 🎯 Consider updating baseline if improvements are intentional');
    }
    
    // Exit with appropriate code
    const hasRegressions = analysis.regressions.length > 0;
    console.log(`\n${hasRegressions ? '🚨' : '✅'} Regression detection complete!`);
    
    if (hasRegressions && process.env.CI) {
      console.log('❌ Failing CI build due to performance regressions');
      process.exit(1);
    } else {
      process.exit(0);
    }
    
  } catch (error) {
    console.error('🚨 Regression detection failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { detectRegressions, loadBaseline };
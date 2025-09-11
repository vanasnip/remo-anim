#!/usr/bin/env node

/**
 * Performance Report Generator
 * Creates comprehensive HTML and JSON reports from performance test results
 */

const fs = require('fs');
const path = require('path');

console.log('📊 Performance Report Generator\n');

// Configuration
const RESULTS_DIR = 'performance-results';
const BASELINE_DIR = 'performance-baselines';
const REPORTS_DIR = 'performance-results/reports';

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Load all performance results
 */
function loadPerformanceResults() {
  if (!fs.existsSync(RESULTS_DIR)) {
    console.error('❌ No performance results directory found');
    process.exit(1);
  }
  
  const resultFiles = fs.readdirSync(RESULTS_DIR)
    .filter(file => file.startsWith('performance-') && file.endsWith('.json'))
    .sort()
    .reverse(); // Most recent first
  
  if (resultFiles.length === 0) {
    console.error('❌ No performance results found. Run performance tests first.');
    process.exit(1);
  }
  
  console.log(`📁 Found ${resultFiles.length} performance result files`);
  
  const results = resultFiles.slice(0, 10).map(file => { // Load last 10 results
    const filePath = path.join(RESULTS_DIR, file);
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.warn(`⚠️  Could not load ${file}:`, error.message);
      return null;
    }
  }).filter(Boolean);
  
  console.log(`✅ Loaded ${results.length} performance result sets\n`);
  return results;
}

/**
 * Load baseline data
 */
function loadBaseline() {
  const baselineFile = path.join(BASELINE_DIR, 'current.json');
  if (!fs.existsSync(baselineFile)) {
    console.warn('⚠️  No baseline found');
    return null;
  }
  
  try {
    return JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  } catch (error) {
    console.warn('⚠️  Could not load baseline:', error.message);
    return null;
  }
}

/**
 * Calculate performance trends
 */
function calculateTrends(results) {
  if (results.length < 2) {
    return { trends: {}, hasData: false };
  }
  
  const metrics = ['fcp', 'lcp', 'cls', 'loadTime', 'memoryUsage', 'searchResponseTime', 'galleryRenderTime'];
  const trends = {};
  
  metrics.forEach(metric => {
    const values = results
      .map(r => r.results?.find(res => res.testScenario === 'cold-start')?.[metric])
      .filter(v => v !== undefined && v !== null)
      .slice(0, 5); // Last 5 results
    
    if (values.length >= 2) {
      const recent = values[0];
      const older = values[values.length - 1];
      const change = older > 0 ? ((recent - older) / older) * 100 : 0;
      const average = values.reduce((a, b) => a + b, 0) / values.length;
      
      trends[metric] = {
        recent,
        older,
        change,
        average,
        direction: change > 5 ? 'worse' : change < -5 ? 'better' : 'stable',
        values
      };
    }
  });
  
  return { trends, hasData: Object.keys(trends).length > 0 };
}

/**
 * Generate comprehensive performance summary
 */
function generateSummary(results, baseline, trends) {
  const latestResult = results[0];
  const latestMetrics = latestResult.results?.find(r => r.testScenario === 'cold-start');
  
  if (!latestMetrics) {
    return { error: 'No cold-start metrics found in latest results' };
  }
  
  const summary = {
    timestamp: new Date().toISOString(),
    testRun: latestResult.testRun,
    performance: {
      coreWebVitals: {
        fcp: latestMetrics.fcp,
        lcp: latestMetrics.lcp,
        cls: latestMetrics.cls,
        tti: latestMetrics.tti,
      },
      applicationMetrics: {
        loadTime: latestMetrics.loadTime,
        memoryUsage: latestMetrics.memoryUsage,
        networkRequests: latestMetrics.networkRequests,
      },
      galleryMetrics: {
        galleryRenderTime: latestMetrics.galleryRenderTime,
        searchResponseTime: latestMetrics.searchResponseTime,
        lazyLoadingEffectiveness: latestMetrics.lazyLoadingEffectiveness,
        scrollPerformance: latestMetrics.scrollPerformance,
      }
    },
    comparison: baseline ? compareWithBaseline(latestMetrics, baseline.metrics) : null,
    trends: trends.hasData ? trends.trends : null,
    quality: assessPerformanceQuality(latestMetrics),
  };
  
  return summary;
}

/**
 * Compare with baseline
 */
function compareWithBaseline(current, baseline) {
  return {
    fcpChange: ((current.fcp - baseline.fcp) / baseline.fcp) * 100,
    lcpChange: ((current.lcp - baseline.lcp) / baseline.lcp) * 100,
    clsChange: ((current.cls - baseline.cls) / (baseline.cls || 0.001)) * 100,
    loadTimeChange: ((current.loadTime - baseline.loadTime) / baseline.loadTime) * 100,
    memoryChange: ((current.memoryUsage - baseline.memoryUsage) / baseline.memoryUsage) * 100,
    searchSpeedChange: ((current.searchResponseTime - baseline.searchResponseTime) / baseline.searchResponseTime) * 100,
  };
}

/**
 * Assess performance quality
 */
function assessPerformanceQuality(metrics) {
  const scores = {
    fcp: metrics.fcp <= 1800 ? 100 : metrics.fcp <= 3000 ? 75 : 50,
    lcp: metrics.lcp <= 2500 ? 100 : metrics.lcp <= 4000 ? 75 : 50,
    cls: metrics.cls <= 0.1 ? 100 : metrics.cls <= 0.25 ? 75 : 50,
    memory: metrics.memoryUsage <= 30 ? 100 : metrics.memoryUsage <= 50 ? 75 : 50,
    search: metrics.searchResponseTime <= 50 ? 100 : metrics.searchResponseTime <= 100 ? 75 : 50,
    fps: metrics.scrollPerformance?.averageFPS >= 58 ? 100 : 
         metrics.scrollPerformance?.averageFPS >= 55 ? 75 : 50,
  };
  
  const overallScore = Math.round(Object.values(scores).reduce((a, b) => a + b) / Object.keys(scores).length);
  
  return {
    scores,
    overall: overallScore,
    grade: overallScore >= 90 ? 'A' : overallScore >= 80 ? 'B' : overallScore >= 70 ? 'C' : 'D',
    status: overallScore >= 80 ? 'excellent' : overallScore >= 60 ? 'good' : 'needs-improvement'
  };
}

/**
 * Generate HTML report
 */
function generateHTMLReport(summary, results) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ManimShowcase Performance Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header .subtitle { font-size: 1.2em; opacity: 0.9; }
        .card { background: white; border-radius: 10px; padding: 25px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .metric { text-align: center; padding: 20px; border-radius: 8px; }
        .metric-excellent { background: linear-gradient(135deg, #4CAF50, #45a049); color: white; }
        .metric-good { background: linear-gradient(135deg, #2196F3, #1976D2); color: white; }
        .metric-warning { background: linear-gradient(135deg, #FF9800, #F57C00); color: white; }
        .metric-poor { background: linear-gradient(135deg, #F44336, #D32F2F); color: white; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { font-size: 0.9em; opacity: 0.9; }
        .grade { font-size: 3em; font-weight: bold; text-align: center; padding: 20px; border-radius: 50%; width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .grade-A { background: #4CAF50; color: white; }
        .grade-B { background: #2196F3; color: white; }
        .grade-C { background: #FF9800; color: white; }
        .grade-D { background: #F44336; color: white; }
        .trend-up { color: #F44336; }
        .trend-down { color: #4CAF50; }
        .trend-stable { color: #757575; }
        .comparison-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .comparison-table th, .comparison-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .comparison-table th { background-color: #f8f9fa; font-weight: 600; }
        .chart-container { height: 300px; margin: 20px 0; }
        .timestamp { color: #666; font-size: 0.9em; margin-top: 20px; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎬 ManimShowcase Performance Report</h1>
            <div class="subtitle">Comprehensive performance analysis and monitoring</div>
            <div class="timestamp">Generated on ${new Date(summary.timestamp).toLocaleString()}</div>
        </div>

        <!-- Performance Grade -->
        <div class="card">
            <h2>📊 Overall Performance Grade</h2>
            <div class="grade grade-${summary.quality.grade}">${summary.quality.grade}</div>
            <p style="text-align: center; font-size: 1.2em; margin-bottom: 20px;">
                Performance Score: <strong>${summary.quality.overall}/100</strong> (${summary.quality.status})
            </p>
        </div>

        <!-- Core Web Vitals -->
        <div class="card">
            <h2>🎯 Core Web Vitals</h2>
            <div class="metrics-grid">
                <div class="metric ${getMetricClass(summary.performance.coreWebVitals.fcp, 1800, 3000)}">
                    <div class="metric-value">${summary.performance.coreWebVitals.fcp}ms</div>
                    <div class="metric-label">First Contentful Paint</div>
                </div>
                <div class="metric ${getMetricClass(summary.performance.coreWebVitals.lcp, 2500, 4000)}">
                    <div class="metric-value">${summary.performance.coreWebVitals.lcp}ms</div>
                    <div class="metric-label">Largest Contentful Paint</div>
                </div>
                <div class="metric ${getMetricClass(summary.performance.coreWebVitals.cls * 1000, 100, 250)}">
                    <div class="metric-value">${summary.performance.coreWebVitals.cls.toFixed(3)}</div>
                    <div class="metric-label">Cumulative Layout Shift</div>
                </div>
                <div class="metric ${getMetricClass(summary.performance.coreWebVitals.tti, 4000, 6000)}">
                    <div class="metric-value">${summary.performance.coreWebVitals.tti}ms</div>
                    <div class="metric-label">Time to Interactive</div>
                </div>
            </div>
        </div>

        <!-- Gallery-Specific Metrics -->
        <div class="card">
            <h2>🎬 Gallery Performance</h2>
            <div class="metrics-grid">
                <div class="metric ${getMetricClass(summary.performance.galleryMetrics.galleryRenderTime, 200, 400)}">
                    <div class="metric-value">${summary.performance.galleryMetrics.galleryRenderTime}ms</div>
                    <div class="metric-label">Gallery Render Time</div>
                </div>
                <div class="metric ${getMetricClass(summary.performance.galleryMetrics.searchResponseTime, 100, 200)}">
                    <div class="metric-value">${summary.performance.galleryMetrics.searchResponseTime}ms</div>
                    <div class="metric-label">Search Response Time</div>
                </div>
                <div class="metric ${getMetricClass(100 - summary.performance.galleryMetrics.lazyLoadingEffectiveness, 20, 40)}">
                    <div class="metric-value">${summary.performance.galleryMetrics.lazyLoadingEffectiveness.toFixed(1)}%</div>
                    <div class="metric-label">Lazy Loading Effectiveness</div>
                </div>
                <div class="metric ${getMetricClass(60 - summary.performance.galleryMetrics.scrollPerformance.averageFPS, 2, 5)}">
                    <div class="metric-value">${summary.performance.galleryMetrics.scrollPerformance.averageFPS}</div>
                    <div class="metric-label">Average FPS</div>
                </div>
            </div>
        </div>

        <!-- Application Metrics -->
        <div class="card">
            <h2>💻 Application Performance</h2>
            <div class="metrics-grid">
                <div class="metric ${getMetricClass(summary.performance.applicationMetrics.loadTime, 2000, 4000)}">
                    <div class="metric-value">${summary.performance.applicationMetrics.loadTime}ms</div>
                    <div class="metric-label">Load Time</div>
                </div>
                <div class="metric ${getMetricClass(summary.performance.applicationMetrics.memoryUsage, 30, 50)}">
                    <div class="metric-value">${summary.performance.applicationMetrics.memoryUsage}MB</div>
                    <div class="metric-label">Memory Usage</div>
                </div>
                <div class="metric ${getMetricClass(summary.performance.applicationMetrics.networkRequests, 20, 40)}">
                    <div class="metric-value">${summary.performance.applicationMetrics.networkRequests}</div>
                    <div class="metric-label">Network Requests</div>
                </div>
            </div>
        </div>

        ${summary.comparison ? `
        <!-- Baseline Comparison -->
        <div class="card">
            <h2>📈 Baseline Comparison</h2>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Current</th>
                        <th>Baseline</th>
                        <th>Change</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>First Contentful Paint</td>
                        <td>${summary.performance.coreWebVitals.fcp}ms</td>
                        <td>Baseline</td>
                        <td class="${summary.comparison.fcpChange > 0 ? 'trend-up' : 'trend-down'}">${summary.comparison.fcpChange >= 0 ? '+' : ''}${summary.comparison.fcpChange.toFixed(1)}%</td>
                        <td>${Math.abs(summary.comparison.fcpChange) > 10 ? (summary.comparison.fcpChange > 0 ? '🚨' : '🎉') : '✅'}</td>
                    </tr>
                    <tr>
                        <td>Largest Contentful Paint</td>
                        <td>${summary.performance.coreWebVitals.lcp}ms</td>
                        <td>Baseline</td>
                        <td class="${summary.comparison.lcpChange > 0 ? 'trend-up' : 'trend-down'}">${summary.comparison.lcpChange >= 0 ? '+' : ''}${summary.comparison.lcpChange.toFixed(1)}%</td>
                        <td>${Math.abs(summary.comparison.lcpChange) > 10 ? (summary.comparison.lcpChange > 0 ? '🚨' : '🎉') : '✅'}</td>
                    </tr>
                    <tr>
                        <td>Load Time</td>
                        <td>${summary.performance.applicationMetrics.loadTime}ms</td>
                        <td>Baseline</td>
                        <td class="${summary.comparison.loadTimeChange > 0 ? 'trend-up' : 'trend-down'}">${summary.comparison.loadTimeChange >= 0 ? '+' : ''}${summary.comparison.loadTimeChange.toFixed(1)}%</td>
                        <td>${Math.abs(summary.comparison.loadTimeChange) > 10 ? (summary.comparison.loadTimeChange > 0 ? '🚨' : '🎉') : '✅'}</td>
                    </tr>
                    <tr>
                        <td>Memory Usage</td>
                        <td>${summary.performance.applicationMetrics.memoryUsage}MB</td>
                        <td>Baseline</td>
                        <td class="${summary.comparison.memoryChange > 0 ? 'trend-up' : 'trend-down'}">${summary.comparison.memoryChange >= 0 ? '+' : ''}${summary.comparison.memoryChange.toFixed(1)}%</td>
                        <td>${Math.abs(summary.comparison.memoryChange) > 20 ? (summary.comparison.memoryChange > 0 ? '🚨' : '🎉') : '✅'}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        ` : ''}

        <!-- Test Environment -->
        <div class="card">
            <h2>🔧 Test Environment</h2>
            <table class="comparison-table">
                <tbody>
                    <tr>
                        <td><strong>Device</strong></td>
                        <td>${summary.testRun?.device || 'Unknown'}</td>
                    </tr>
                    <tr>
                        <td><strong>Test Date</strong></td>
                        <td>${new Date(summary.testRun?.timestamp || summary.timestamp).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td><strong>Total Tests</strong></td>
                        <td>${results[0].results?.length || 0} scenarios</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="timestamp">
            Report generated by generate-report.js on ${new Date().toLocaleString()}
        </div>
    </div>

    <script>
        function getMetricClass(value, good, warning) {
            if (value <= good) return 'metric-excellent';
            if (value <= warning) return 'metric-good';
            if (value <= warning * 1.5) return 'metric-warning';
            return 'metric-poor';
        }
    </script>
</body>
</html>`;

  return html;
}

function getMetricClass(value, good, warning) {
  if (value <= good) return 'metric-excellent';
  if (value <= warning) return 'metric-good';
  if (value <= warning * 1.5) return 'metric-warning';
  return 'metric-poor';
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('📁 Loading performance data...');
    
    // Load data
    const results = loadPerformanceResults();
    const baseline = loadBaseline();
    
    // Calculate trends
    console.log('📈 Calculating performance trends...');
    const trends = calculateTrends(results);
    
    // Generate summary
    console.log('📊 Generating performance summary...');
    const summary = generateSummary(results, baseline, trends);
    
    if (summary.error) {
      console.error('❌', summary.error);
      process.exit(1);
    }
    
    // Generate reports
    console.log('📄 Generating reports...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // JSON Report
    const jsonReport = {
      summary,
      results: results.slice(0, 5), // Last 5 results
      baseline,
      generatedAt: new Date().toISOString()
    };
    
    const jsonReportFile = path.join(REPORTS_DIR, `performance-report-${timestamp}.json`);
    fs.writeFileSync(jsonReportFile, JSON.stringify(jsonReport, null, 2));
    
    // HTML Report
    const htmlReport = generateHTMLReport(summary, results);
    const htmlReportFile = path.join(REPORTS_DIR, `performance-report-${timestamp}.html`);
    fs.writeFileSync(htmlReportFile, htmlReport);
    
    // Create latest symlinks
    const latestJsonFile = path.join(REPORTS_DIR, 'latest-report.json');
    const latestHtmlFile = path.join(REPORTS_DIR, 'latest-report.html');
    
    if (fs.existsSync(latestJsonFile)) fs.unlinkSync(latestJsonFile);
    if (fs.existsSync(latestHtmlFile)) fs.unlinkSync(latestHtmlFile);
    
    fs.copyFileSync(jsonReportFile, latestJsonFile);
    fs.copyFileSync(htmlReportFile, latestHtmlFile);
    
    console.log('\n✅ Performance reports generated successfully!');
    console.log(`📊 JSON Report: ${jsonReportFile}`);
    console.log(`🌐 HTML Report: ${htmlReportFile}`);
    console.log(`🔗 Latest JSON: ${latestJsonFile}`);
    console.log(`🔗 Latest HTML: ${latestHtmlFile}`);
    
    // Performance summary
    console.log('\n🎯 Performance Summary:');
    console.log(`  Overall Grade: ${summary.quality.grade} (${summary.quality.overall}/100)`);
    console.log(`  FCP: ${summary.performance.coreWebVitals.fcp}ms`);
    console.log(`  LCP: ${summary.performance.coreWebVitals.lcp}ms`);
    console.log(`  Memory: ${summary.performance.applicationMetrics.memoryUsage}MB`);
    console.log(`  Search: ${summary.performance.galleryMetrics.searchResponseTime}ms`);
    console.log(`  FPS: ${summary.performance.galleryMetrics.scrollPerformance.averageFPS}`);
    
    if (summary.comparison) {
      console.log('\n📈 Baseline Comparison:');
      const improvements = [];
      const regressions = [];
      
      Object.entries(summary.comparison).forEach(([key, change]) => {
        if (Math.abs(change) > 5) {
          if (change < 0) improvements.push(`${key}: ${change.toFixed(1)}%`);
          else regressions.push(`${key}: +${change.toFixed(1)}%`);
        }
      });
      
      if (improvements.length > 0) {
        console.log(`  🎉 Improvements: ${improvements.join(', ')}`);
      }
      if (regressions.length > 0) {
        console.log(`  🚨 Regressions: ${regressions.join(', ')}`);
      }
      if (improvements.length === 0 && regressions.length === 0) {
        console.log(`  ✅ Performance stable compared to baseline`);
      }
    }
    
    console.log('\n📋 Next Steps:');
    console.log('  1. Open the HTML report in your browser for detailed analysis');
    console.log('  2. Share the report with your team');
    console.log('  3. Address any performance regressions');
    console.log('  4. Update baseline if improvements are intentional');
    
    process.exit(0);
    
  } catch (error) {
    console.error('🚨 Report generation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateSummary, generateHTMLReport };
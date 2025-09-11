# 🎬 ManimShowcase Performance Testing Guide

## Overview

This comprehensive guide covers the automated performance testing suite created for monitoring ManimShowcase gallery optimizations. The system provides continuous performance monitoring, regression detection, and detailed reporting to ensure optimal user experience.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Test Scenarios](#test-scenarios)
4. [Performance Metrics](#performance-metrics)
5. [Running Tests](#running-tests)
6. [Baseline Management](#baseline-management)
7. [Regression Detection](#regression-detection)
8. [Reporting](#reporting)
9. [CI/CD Integration](#cicd-integration)
10. [Continuous Monitoring](#continuous-monitoring)
11. [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Basic Usage

```bash
# Run full performance test suite
npm run test:performance

# Run tests for CI/CD (JSON output)
npm run test:performance:ci

# Establish performance baseline
npm run test:baseline

# Check for regressions
npm run test:regression

# Generate performance reports
node scripts/performance/generate-report.js

# View latest HTML report
open performance-results/reports/latest-report.html
```

## Architecture

### Components

```
performance-testing/
├── playwright.config.ts           # Playwright configuration
├── tests/
│   └── performance/
│       ├── manim-showcase.spec.ts  # Main test suite
│       └── performance-utils.ts    # Utilities and metrics
├── scripts/performance/
│   ├── establish-baseline.js       # Baseline creation
│   ├── detect-regressions.js      # Regression detection
│   ├── generate-report.js         # Report generation
│   └── monitor-performance.js     # Continuous monitoring
├── .github/workflows/
│   └── performance.yml            # CI/CD workflow
├── performance-baselines/          # Baseline storage
├── performance-results/            # Test results
│   └── reports/                   # Generated reports
```

### Key Features

- **🎯 Comprehensive Metrics**: Core Web Vitals + gallery-specific metrics
- **📊 Baseline Comparison**: Automated regression detection
- **📈 Trend Analysis**: Performance trends over time
- **🔄 CI/CD Integration**: Automated testing in pull requests
- **📱 Multi-Device Testing**: Desktop, mobile, and constrained environments
- **🚨 Real-time Alerts**: Performance regression notifications
- **📄 Rich Reporting**: HTML and JSON reports with visualizations

## Test Scenarios

### 1. Cold Start Performance
Tests first-time page load with empty cache:
- Measures initial load time
- Tracks Core Web Vitals (FCP, LCP, CLS)
- Monitors memory usage and network requests

### 2. Warm Cache Performance
Tests page load with browser cache:
- Compares cached vs uncached performance
- Validates caching effectiveness
- Measures cache hit ratios

### 3. Scroll Performance
Tests scrolling behavior and lazy loading:
- Monitors FPS during scroll operations
- Validates smooth scrolling at 60fps
- Tests lazy loading effectiveness

### 4. Search Performance
Tests search functionality:
- Measures search response time
- Tests debounced search behavior
- Validates results rendering performance

### 5. Memory Stress Testing
Tests memory usage under sustained load:
- Detects memory leaks
- Tests garbage collection effectiveness
- Validates long-session stability

## Performance Metrics

### Core Web Vitals
- **FCP (First Contentful Paint)**: ≤ 1.8s (good), ≤ 3.0s (acceptable)
- **LCP (Largest Contentful Paint)**: ≤ 2.5s (good), ≤ 4.0s (acceptable)
- **CLS (Cumulative Layout Shift)**: ≤ 0.1 (good), ≤ 0.25 (acceptable)
- **FID (First Input Delay)**: ≤ 100ms (good), ≤ 300ms (acceptable)
- **TTI (Time to Interactive)**: ≤ 4.0s target

### Application Metrics
- **Load Time**: Complete page load duration
- **DOM Content Loaded**: DOM parsing completion time
- **Memory Usage**: JavaScript heap size
- **Network Requests**: Total HTTP requests count

### Gallery-Specific Metrics
- **Gallery Render Time**: Time to render video grid (≤ 200ms target)
- **Search Response Time**: Search result display time (≤ 100ms target)
- **Lazy Loading Effectiveness**: Percentage of content lazy-loaded
- **Scroll Performance**: Average FPS during scrolling (≥ 55 FPS target)
- **Frame Drops**: Number of dropped frames during scroll

## Running Tests

### Local Development

```bash
# Run all performance tests
npm run test:performance

# Run specific browser
npx playwright test --project=desktop-chrome

# Run with custom timeout
npx playwright test --timeout=180000

# Run tests and show report
npm run test:performance && npm run test:performance:report
```

### Test Configuration

Customize tests via environment variables:

```bash
# Set custom thresholds
PERFORMANCE_FCP_THRESHOLD=2000 npm run test:performance

# Test with slow network
SLOW_NETWORK=true npm run test:performance

# Test with memory constraints
MEMORY_LIMIT=512 npm run test:performance
```

### Debug Mode

```bash
# Run tests in headed mode
npx playwright test --headed

# Generate trace files
npx playwright test --trace=on

# Open trace viewer
npx playwright show-trace trace.zip
```

## Baseline Management

### Establishing Baselines

```bash
# Create new baseline (runs multiple attempts, uses best result)
npm run test:baseline

# Force baseline update
FORCE_BASELINE_UPDATE=true npm run test:baseline
```

### Baseline Structure

```json
{
  "established": "2024-01-15T10:30:00.000Z",
  "attempts": 3,
  "metrics": {
    "fcp": 1250,
    "lcp": 2100,
    "cls": 0.05,
    "loadTime": 1800,
    "memoryUsage": 28,
    "searchResponseTime": 45,
    "galleryRenderTime": 150
  },
  "environment": {
    "nodeVersion": "v20.0.0",
    "platform": "darwin",
    "ci": false
  },
  "thresholds": { ... }
}
```

### Best Practices

1. **Establish baselines on stable, optimized code**
2. **Run multiple baseline attempts for consistency**
3. **Update baselines after intentional performance improvements**
4. **Use consistent test environment (same hardware, network)**
5. **Document baseline changes in commit messages**

## Regression Detection

### Automatic Detection

```bash
# Check for regressions against baseline
npm run test:regression

# Generate regression report
node scripts/performance/detect-regressions.js
```

### Regression Thresholds

- **Core Web Vitals**: 10% degradation triggers warning
- **Memory Usage**: 20% increase triggers warning
- **Search Performance**: 15% degradation triggers warning
- **FPS**: 5 FPS drop triggers warning

### Regression Reports

Generated reports include:
- Detailed metric comparisons
- Percentage changes from baseline
- Visual indicators (🚨 regression, 🎉 improvement, ✅ stable)
- Recommendations for addressing issues
- Environment and test context

## Reporting

### HTML Reports

Rich, interactive reports with:
- Performance grade (A-D) based on metrics
- Visual metric cards with color coding
- Baseline comparison tables
- Trend charts and historical data
- Environment details and test context

```bash
# Generate and open HTML report
node scripts/performance/generate-report.js
open performance-results/reports/latest-report.html
```

### JSON Reports

Machine-readable reports for CI/CD integration:
- Complete performance metrics
- Baseline comparison data
- Trend analysis
- Test environment metadata

### Report Customization

Modify `scripts/performance/generate-report.js` to:
- Add custom metrics
- Change threshold values
- Customize report styling
- Add additional visualizations

## CI/CD Integration

### GitHub Actions Workflow

The performance testing workflow (`/.github/workflows/performance.yml`) provides:

- **Automated Testing**: Runs on push, PR, and scheduled intervals
- **Multi-Environment**: Tests across Node.js versions and browsers
- **Regression Prevention**: Fails builds on significant regressions  
- **PR Comments**: Adds performance reports to pull requests
- **Baseline Management**: Automated baseline updates on main branch

### Workflow Triggers

```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:     # Manual trigger
```

### Manual Workflow Execution

```bash
# Trigger via GitHub CLI
gh workflow run performance.yml

# Trigger with specific test type
gh workflow run performance.yml -f test_type=baseline
```

### CI Environment Variables

```yaml
env:
  CI: true
  DEVICE: chrome-20
  PERFORMANCE_THRESHOLD_STRICT: true
```

## Continuous Monitoring

### Real-time Performance Monitoring

```bash
# Start continuous monitoring (5-minute intervals)
node scripts/performance/monitor-performance.js start

# Check monitoring status
node scripts/performance/monitor-performance.js status

# Perform health check
node scripts/performance/monitor-performance.js health

# Stop monitoring
node scripts/performance/monitor-performance.js stop
```

### Monitoring Configuration

```bash
# Custom interval (1 minute)
MONITOR_INTERVAL=60000 node scripts/performance/monitor-performance.js start

# Custom alert threshold (15% regression)
ALERT_THRESHOLD=15 node scripts/performance/monitor-performance.js start

# Webhook alerts
WEBHOOK_URL=https://hooks.slack.com/... node scripts/performance/monitor-performance.js start
```

### Alert System

Monitoring system sends alerts for:
- Performance regressions above threshold
- Consecutive monitoring failures
- Memory leak detection
- System health issues

### Alert Formats

Alerts include:
- Timestamp and severity level
- Affected metrics and regression percentages
- Environment and host information
- Links to detailed reports

## Troubleshooting

### Common Issues

#### Tests Failing to Start
```bash
# Check if dev server is running
curl http://localhost:3000

# Install browser dependencies
npx playwright install-deps

# Clear npm cache
npm cache clean --force && npm install
```

#### Inconsistent Results
```bash
# Ensure consistent test environment
export NODE_ENV=test
export CI=true

# Disable animations
export REDUCED_MOTION=true

# Run with single worker
npx playwright test --workers=1
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Use memory-constrained test profile
npx playwright test --project=memory-constrained
```

### Debug Performance Issues

#### Slow Tests
1. Check network connectivity
2. Verify browser performance
3. Review test timeouts
4. Analyze trace files

#### Failed Baselines
1. Review baseline quality validation
2. Check for environmental changes
3. Verify application stability
4. Run multiple baseline attempts

#### False Regressions
1. Check for external factors (network, system load)
2. Verify baseline currency
3. Review threshold settings
4. Run additional test cycles

### Performance Analysis

#### Profiling Application
```bash
# Generate performance profile
npx playwright test --trace=on
npx playwright show-trace trace.zip
```

#### Memory Analysis
```bash
# Enable memory monitoring
MEMORY_ANALYSIS=true npm run test:performance

# Check for memory leaks
node --expose-gc scripts/performance/memory-analysis.js
```

### Support and Maintenance

#### Regular Maintenance Tasks

1. **Weekly**: Review performance trends and reports
2. **Bi-weekly**: Update baselines after major optimizations
3. **Monthly**: Review and update performance thresholds
4. **Quarterly**: Audit test scenarios and add new ones

#### Monitoring Health

```bash
# Check monitor logs
tail -f performance-results/monitor.log

# Review health status
cat performance-results/monitor-health.json

# Analyze alert patterns
ls -la performance-results/alert-*.json
```

#### Getting Help

- Check the [Playwright documentation](https://playwright.dev/docs/intro) for testing issues
- Review performance optimization guides for improvement strategies
- Monitor system resources during tests for bottleneck identification
- Use browser developer tools for detailed performance analysis

## Advanced Configuration

### Custom Test Scenarios

Add new test scenarios in `tests/performance/performance-utils.ts`:

```typescript
export const customScenarios: TestScenario[] = [
  {
    name: 'video-playback',
    description: 'Video playback performance test',
    setup: async (page) => {
      await page.goto('/ManimShowcase-Gallery');
    },
    test: async (page) => {
      // Custom test implementation
    }
  }
];
```

### Custom Metrics

Extend performance metrics in `PerformanceCollector`:

```typescript
interface CustomMetrics extends PerformanceMetrics {
  customMetric: number;
  additionalTiming: number;
}
```

### Environment-Specific Configurations

Create environment-specific configurations:

```typescript
// playwright.config.production.ts
export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: 'https://production.example.com',
  },
});
```

---

## Summary

This performance testing suite provides comprehensive monitoring capabilities for the ManimShowcase gallery, including:

✅ **Complete Test Coverage**: All major performance scenarios covered  
✅ **Automated Baseline Management**: Intelligent baseline establishment and updates  
✅ **Regression Detection**: Real-time performance regression alerts  
✅ **Rich Reporting**: Interactive HTML reports and machine-readable JSON  
✅ **CI/CD Integration**: Seamless integration with GitHub Actions  
✅ **Continuous Monitoring**: 24/7 performance monitoring with alerts  
✅ **Multi-Environment Testing**: Desktop, mobile, and constrained environments  

The system ensures that performance optimizations are maintained over time and provides early warning for any regressions, helping maintain optimal user experience for the ManimShowcase gallery.

---
*Generated by the ManimShowcase Performance Testing Suite*
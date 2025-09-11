#!/usr/bin/env node

/**
 * Continuous Performance Monitor
 * Real-time performance monitoring and alerting system
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📊 Continuous Performance Monitor\n');

// Configuration
const MONITOR_INTERVAL = parseInt(process.env.MONITOR_INTERVAL) || 300000; // 5 minutes
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD) || 20; // 20% regression
const MAX_RETRIES = 3;
const RESULTS_DIR = 'performance-results';
const MONITOR_LOG = path.join(RESULTS_DIR, 'monitor.log');

// Monitoring state
let isMonitoring = false;
let monitoringInterval;
let consecutiveFailures = 0;

/**
 * Log monitoring events
 */
function log(level, message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  console.log(`${timestamp} [${level.toUpperCase()}] ${message}`);
  
  // Ensure results directory exists
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  
  fs.appendFileSync(MONITOR_LOG, logEntry);
}

/**
 * Run performance test and analyze results
 */
async function runPerformanceCheck() {
  log('info', 'Starting performance check...');
  
  try {
    // Run performance tests
    const result = execSync('npm run test:performance:ci', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Find latest results
    const resultsFiles = fs.readdirSync(RESULTS_DIR)
      .filter(file => file.startsWith('performance-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (resultsFiles.length === 0) {
      throw new Error('No performance results found');
    }
    
    const latestResultsFile = path.join(RESULTS_DIR, resultsFiles[0]);
    const results = JSON.parse(fs.readFileSync(latestResultsFile, 'utf8'));
    
    const coldStartMetrics = results.results?.find(r => r.testScenario === 'cold-start');
    if (!coldStartMetrics) {
      throw new Error('Cold-start metrics not found');
    }
    
    log('info', `Performance check completed - Load time: ${coldStartMetrics.loadTime}ms, Memory: ${coldStartMetrics.memoryUsage}MB`);
    
    consecutiveFailures = 0;
    return { success: true, metrics: coldStartMetrics, results };
    
  } catch (error) {
    consecutiveFailures++;
    log('error', `Performance check failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Check for performance alerts
 */
async function checkForAlerts(metrics) {
  log('info', 'Checking for performance alerts...');
  
  try {
    // Run regression detection
    const regressionResult = execSync('npm run test:regression', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    log('info', '✅ No performance regression detected');
    return { hasRegression: false };
    
  } catch (error) {
    // Regression detected
    log('warn', '🚨 Performance regression detected!');
    
    // Parse regression details
    try {
      const regressionFiles = fs.readdirSync(RESULTS_DIR)
        .filter(file => file.startsWith('regression-') && file.endsWith('.json'))
        .sort()
        .reverse();
      
      if (regressionFiles.length > 0) {
        const latestRegressionFile = path.join(RESULTS_DIR, regressionFiles[0]);
        const regressionData = JSON.parse(fs.readFileSync(latestRegressionFile, 'utf8'));
        
        return {
          hasRegression: true,
          regressionData,
          regressions: regressionData.analysis?.regressions || []
        };
      }
    } catch (parseError) {
      log('error', `Could not parse regression data: ${parseError.message}`);
    }
    
    return { hasRegression: true };
  }
}

/**
 * Send performance alert
 */
function sendAlert(alertData) {
  log('warn', '🔔 Sending performance alert...');
  
  const alertMessage = {
    timestamp: new Date().toISOString(),
    type: 'performance_regression',
    severity: alertData.regressions?.length > 2 ? 'high' : 'medium',
    message: `Performance regression detected in ManimShowcase gallery`,
    details: {
      regressions: alertData.regressions?.map(reg => ({
        metric: reg.name,
        change: `${reg.change >= 0 ? '+' : ''}${reg.change.toFixed(1)}%`,
        baseline: reg.baseline,
        current: reg.current
      })) || [],
      environment: process.env.NODE_ENV || 'development',
      monitoringHost: require('os').hostname()
    }
  };
  
  // Save alert to file
  const alertFile = path.join(RESULTS_DIR, `alert-${Date.now()}.json`);
  fs.writeFileSync(alertFile, JSON.stringify(alertMessage, null, 2));
  
  // Log alert details
  log('warn', `Alert saved to: ${alertFile}`);
  if (alertData.regressions) {
    alertData.regressions.forEach(reg => {
      log('warn', `  - ${reg.name}: ${reg.change >= 0 ? '+' : ''}${reg.change.toFixed(1)}% (${reg.baseline} → ${reg.current})`);
    });
  }
  
  // Additional alert mechanisms can be added here:
  // - Send email
  // - Post to Slack/Discord
  // - Create GitHub issue
  // - Send webhook notification
  
  if (process.env.WEBHOOK_URL) {
    try {
      const webhook = require('child_process').execSync(`curl -X POST -H "Content-Type: application/json" -d '${JSON.stringify(alertMessage)}' "${process.env.WEBHOOK_URL}"`, { encoding: 'utf8' });
      log('info', 'Webhook notification sent');
    } catch (webhookError) {
      log('error', `Webhook notification failed: ${webhookError.message}`);
    }
  }
  
  return alertMessage;
}

/**
 * Health check for monitoring system
 */
function performHealthCheck() {
  const healthStatus = {
    timestamp: new Date().toISOString(),
    monitoring: isMonitoring,
    consecutiveFailures,
    lastCheck: null,
    diskSpace: null,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  };
  
  // Check disk space
  try {
    const diskUsage = execSync('df -h .', { encoding: 'utf8' });
    const lines = diskUsage.split('\n');
    if (lines.length > 1) {
      const diskInfo = lines[1].split(/\s+/);
      healthStatus.diskSpace = {
        total: diskInfo[1],
        used: diskInfo[2],
        available: diskInfo[3],
        usePercent: diskInfo[4]
      };
    }
  } catch (error) {
    log('warn', `Could not check disk space: ${error.message}`);
  }
  
  // Check last performance check
  try {
    const logContent = fs.readFileSync(MONITOR_LOG, 'utf8');
    const lines = logContent.split('\n').filter(line => line.includes('Performance check completed'));
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const timestampMatch = lastLine.match(/\[(.*?)\]/);
      if (timestampMatch) {
        healthStatus.lastCheck = timestampMatch[1];
      }
    }
  } catch (error) {
    // Log file might not exist yet
  }
  
  const healthFile = path.join(RESULTS_DIR, 'monitor-health.json');
  fs.writeFileSync(healthFile, JSON.stringify(healthStatus, null, 2));
  
  log('info', `Health check completed - Memory: ${Math.round(healthStatus.memoryUsage.rss / 1024 / 1024)}MB, Uptime: ${Math.round(healthStatus.uptime / 60)}min`);
  
  return healthStatus;
}

/**
 * Main monitoring loop
 */
async function monitoringLoop() {
  log('info', '🔄 Starting monitoring cycle...');
  
  // Health check
  performHealthCheck();
  
  // Performance check
  const checkResult = await runPerformanceCheck();
  
  if (!checkResult.success) {
    if (consecutiveFailures >= MAX_RETRIES) {
      log('error', `🚨 Monitoring failed ${consecutiveFailures} times consecutively. Consider investigating.`);
      
      // Send failure alert
      sendAlert({
        type: 'monitoring_failure',
        consecutiveFailures,
        lastError: checkResult.error
      });
    }
    return;
  }
  
  // Check for alerts
  const alertResult = await checkForAlerts(checkResult.metrics);
  
  if (alertResult.hasRegression) {
    sendAlert(alertResult);
  }
  
  // Generate quick report
  try {
    execSync('node scripts/performance/generate-report.js', { stdio: 'pipe' });
    log('info', 'Performance report generated');
  } catch (error) {
    log('warn', `Report generation failed: ${error.message}`);
  }
  
  log('info', '✅ Monitoring cycle completed');
}

/**
 * Start monitoring
 */
function startMonitoring() {
  if (isMonitoring) {
    log('warn', 'Monitoring is already running');
    return;
  }
  
  isMonitoring = true;
  consecutiveFailures = 0;
  
  log('info', `🚀 Starting continuous performance monitoring (interval: ${MONITOR_INTERVAL / 1000}s)`);
  
  // Run initial check
  monitoringLoop().catch(error => {
    log('error', `Initial monitoring loop failed: ${error.message}`);
  });
  
  // Schedule regular checks
  monitoringInterval = setInterval(() => {
    monitoringLoop().catch(error => {
      log('error', `Monitoring loop failed: ${error.message}`);
    });
  }, MONITOR_INTERVAL);
  
  // Graceful shutdown handlers
  process.on('SIGINT', () => {
    log('info', 'Received SIGINT, shutting down gracefully...');
    stopMonitoring();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    log('info', 'Received SIGTERM, shutting down gracefully...');
    stopMonitoring();
    process.exit(0);
  });
}

/**
 * Stop monitoring
 */
function stopMonitoring() {
  if (!isMonitoring) {
    log('warn', 'Monitoring is not running');
    return;
  }
  
  isMonitoring = false;
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  log('info', '🛑 Performance monitoring stopped');
}

/**
 * Get monitoring status
 */
function getStatus() {
  const status = {
    isMonitoring,
    interval: MONITOR_INTERVAL,
    consecutiveFailures,
    alertThreshold: ALERT_THRESHOLD,
    maxRetries: MAX_RETRIES,
    uptime: isMonitoring ? process.uptime() : 0
  };
  
  console.log('📊 Performance Monitor Status:');
  console.log(`  Running: ${status.isMonitoring ? '✅' : '❌'}`);
  console.log(`  Interval: ${status.interval / 1000}s`);
  console.log(`  Consecutive Failures: ${status.consecutiveFailures}`);
  console.log(`  Alert Threshold: ${status.alertThreshold}%`);
  console.log(`  Max Retries: ${status.maxRetries}`);
  console.log(`  Uptime: ${Math.round(status.uptime / 60)}min`);
  
  return status;
}

/**
 * CLI interface
 */
function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      startMonitoring();
      break;
      
    case 'stop':
      stopMonitoring();
      break;
      
    case 'status':
      getStatus();
      break;
      
    case 'health':
      performHealthCheck();
      break;
      
    case 'check':
      monitoringLoop().then(() => {
        log('info', 'Manual performance check completed');
        process.exit(0);
      }).catch(error => {
        log('error', `Manual performance check failed: ${error.message}`);
        process.exit(1);
      });
      break;
      
    default:
      console.log(`
🔍 Performance Monitor CLI

Usage: node monitor-performance.js [command]

Commands:
  start    Start continuous monitoring
  stop     Stop monitoring
  status   Show monitoring status  
  health   Perform health check
  check    Run single performance check

Environment Variables:
  MONITOR_INTERVAL    Monitoring interval in ms (default: 300000 = 5min)
  ALERT_THRESHOLD     Regression threshold % (default: 20)
  WEBHOOK_URL         Webhook URL for alerts
  NODE_ENV           Environment (development/production)

Examples:
  MONITOR_INTERVAL=60000 node monitor-performance.js start
  WEBHOOK_URL=https://hooks.slack.com/... node monitor-performance.js start
      `);
      process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  getStatus,
  monitoringLoop,
  performHealthCheck
};
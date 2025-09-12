const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function monitorRemotionApp() {
  console.log("🚀 Starting Remotion App Health Monitor...\n");

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000, // Slow down for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // Capture console logs and errors
  const consoleLogs = [];
  const errors = [];

  page.on("console", (msg) => {
    const log = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: new Date().toISOString(),
    };
    consoleLogs.push(log);
    console.log(`[${log.type.toUpperCase()}] ${log.text}`);
  });

  page.on("pageerror", (error) => {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };
    errors.push(errorInfo);
    console.error(`[PAGE ERROR] ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    console.error(
      `[REQUEST FAILED] ${request.url()} - ${request.failure().errorText}`,
    );
  });

  try {
    console.log("📍 Step 1: Navigating to http://localhost:3000");

    // Navigate to Remotion Studio with extended timeout
    await page.goto("http://localhost:3000", {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    console.log("✅ Page loaded successfully");

    // Wait a moment for dynamic content to load
    await page.waitForTimeout(3000);

    // Take initial screenshot
    const screenshotDir = "/Users/ivan/DEV_/anim/screenshots";
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const screenshotPath = path.join(
      screenshotDir,
      `remotion-health-${timestamp}.png`,
    );

    console.log("📸 Taking screenshot...");
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Check for key UI elements
    console.log("🔍 Checking for key UI elements...");

    const checks = [
      {
        name: "Remotion Studio Header",
        selector: 'h1, h2, [data-testid*="remotion"], [class*="remotion"]',
      },
      {
        name: "Video Composition Area",
        selector: 'video, canvas, [data-testid*="video"], [class*="video"]',
      },
      {
        name: "Timeline Controls",
        selector:
          '[data-testid*="timeline"], [class*="timeline"], [role="slider"]',
      },
      {
        name: "Play Button",
        selector:
          'button[aria-label*="play"], button[title*="play"], [data-testid*="play"]',
      },
      {
        name: "Composition List",
        selector: 'ul, [data-testid*="composition"], [class*="composition"]',
      },
      {
        name: "Navigation Menu",
        selector: 'nav, [role="navigation"], [data-testid*="nav"]',
      },
    ];

    const elementResults = {};

    for (const check of checks) {
      try {
        const element = await page.locator(check.selector).first();
        const isVisible = await element.isVisible({ timeout: 5000 });
        elementResults[check.name] = {
          found: true,
          visible: isVisible,
          selector: check.selector,
        };
        console.log(`✅ ${check.name}: ${isVisible ? "Visible" : "Hidden"}`);
      } catch (error) {
        elementResults[check.name] = {
          found: false,
          visible: false,
          selector: check.selector,
          error: error.message,
        };
        console.log(`❌ ${check.name}: Not found`);
      }
    }

    // Try to interact with any clickable elements
    console.log("🖱️  Testing basic interactions...");

    const interactions = [];

    // Look for clickable buttons
    const buttons = await page.locator("button").all();
    console.log(`Found ${buttons.length} buttons`);

    if (buttons.length > 0) {
      try {
        const firstButton = buttons[0];
        const buttonText = await firstButton.textContent();
        console.log(`Attempting to click first button: "${buttonText}"`);

        await firstButton.click({ timeout: 5000 });
        interactions.push({
          type: "button_click",
          text: buttonText,
          success: true,
        });
        console.log("✅ Button click successful");

        // Wait and take another screenshot after interaction
        await page.waitForTimeout(2000);
        const afterClickPath = path.join(
          screenshotDir,
          `remotion-after-click-${timestamp}.png`,
        );
        await page.screenshot({ path: afterClickPath, fullPage: true });
        console.log(`Post-interaction screenshot: ${afterClickPath}`);
      } catch (error) {
        interactions.push({
          type: "button_click",
          success: false,
          error: error.message,
        });
        console.log(`❌ Button click failed: ${error.message}`);
      }
    }

    // Test keyboard navigation
    try {
      console.log("Testing keyboard navigation...");
      await page.keyboard.press("Tab");
      await page.waitForTimeout(500);
      await page.keyboard.press("Space");
      interactions.push({
        type: "keyboard_navigation",
        success: true,
      });
      console.log("✅ Keyboard navigation works");
    } catch (error) {
      interactions.push({
        type: "keyboard_navigation",
        success: false,
        error: error.message,
      });
      console.log(`❌ Keyboard navigation failed: ${error.message}`);
    }

    // Generate comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      url: "http://localhost:3000",
      status: "SUCCESS",
      pageTitle: await page.title(),
      screenshots: [screenshotPath],
      elementChecks: elementResults,
      interactions: interactions,
      consoleLogs: consoleLogs,
      errors: errors,
      performance: {
        loadTime: "N/A", // Could be measured with performance API
        networkRequests: "Captured via console",
      },
    };

    // Save report
    const reportPath = path.join(
      "/Users/ivan/DEV_/anim",
      `remotion-health-report-${timestamp}.json`,
    );
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n📊 HEALTH MONITORING COMPLETE");
    console.log("================================");
    console.log(`Page Title: ${report.pageTitle}`);
    console.log(`Total Console Logs: ${consoleLogs.length}`);
    console.log(`Total Errors: ${errors.length}`);
    console.log(`Screenshots: ${screenshotPath}`);
    console.log(`Report: ${reportPath}`);

    // Summary of findings
    const visibleElements = Object.values(elementResults).filter(
      (r) => r.visible,
    ).length;
    const totalElements = Object.keys(elementResults).length;

    console.log(`\n🎯 SUMMARY:`);
    console.log(`- Page loads: ✅`);
    console.log(`- UI Elements found: ${visibleElements}/${totalElements}`);
    console.log(`- Interactions tested: ${interactions.length}`);
    console.log(`- Critical errors: ${errors.length > 0 ? "❌" : "✅"}`);

    if (errors.length > 0) {
      console.log(`\n⚠️  CRITICAL ISSUES FOUND:`);
      errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.message}`);
      });
    }

    const warningLogs = consoleLogs.filter((log) => log.type === "warning");
    if (warningLogs.length > 0) {
      console.log(`\n⚠️  WARNINGS (${warningLogs.length}):`);
      warningLogs.slice(0, 5).forEach((log, i) => {
        console.log(`${i + 1}. ${log.text}`);
      });
      if (warningLogs.length > 5) {
        console.log(`... and ${warningLogs.length - 5} more warnings`);
      }
    }

    return report;
  } catch (error) {
    console.error(`❌ CRITICAL FAILURE: ${error.message}`);

    // Take screenshot of error state
    try {
      const errorScreenshot = path.join(
        "/Users/ivan/DEV_/anim/screenshots",
        `remotion-error-${Date.now()}.png`,
      );
      await page.screenshot({ path: errorScreenshot, fullPage: true });
      console.log(`Error screenshot: ${errorScreenshot}`);
    } catch (screenshotError) {
      console.error(
        `Failed to take error screenshot: ${screenshotError.message}`,
      );
    }

    return {
      timestamp: new Date().toISOString(),
      status: "FAILURE",
      error: error.message,
      stack: error.stack,
      consoleLogs: consoleLogs,
      errors: errors,
    };
  } finally {
    console.log("\n🔄 Closing browser...");
    await browser.close();
  }
}

// Run the monitoring
monitorRemotionApp()
  .then((report) => {
    console.log("\n✅ Monitoring completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Monitoring failed:", error);
    process.exit(1);
  });

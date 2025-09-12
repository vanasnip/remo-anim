const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function testRemotionApp() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000,
    devtools: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // Listen for console messages
  const consoleMessages = [];
  page.on("console", (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString(),
    });
    console.log(`Console ${msg.type()}: ${msg.text()}`);
  });

  // Listen for errors
  const errors = [];
  page.on("pageerror", (error) => {
    errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    console.log(`Page Error: ${error.message}`);
  });

  try {
    console.log("🚀 Starting comprehensive Remotion app test...");

    // Navigate to the application
    console.log("📍 Navigating to http://localhost:3000...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    // Take initial screenshot
    await page.screenshot({
      path: "/Users/ivan/DEV_/anim/screenshots/01-initial-load.png",
      fullPage: true,
    });
    console.log("📸 Initial screenshot taken");

    // Wait a bit for the app to fully load
    await page.waitForTimeout(3000);

    // Check if this is Remotion Studio
    console.log("🔍 Checking if Remotion Studio UI is visible...");

    // Look for typical Remotion Studio elements
    const remotionElements = {
      studio: await page.locator('[data-testid="remotion-studio"]').count(),
      sidebar: await page
        .locator('[class*="sidebar"], [class*="composition-sidebar"]')
        .count(),
      player: await page
        .locator('[class*="player"], [class*="preview"]')
        .count(),
      timeline: await page.locator('[class*="timeline"]').count(),
      compositions: await page
        .locator('[class*="composition"], [data-testid*="composition"]')
        .count(),
    };

    console.log("🎯 Remotion UI Elements Found:", remotionElements);

    // Try to find compositions in different ways
    console.log("🎬 Looking for compositions...");

    // Method 1: Look for text content of expected compositions
    const expectedCompositions = [
      "TransitionShowcase",
      "VideoEffects",
      "RhythmVisualization",
      "AudioTriggeredContent",
      "EmojiRhythm",
    ];

    const foundCompositions = [];
    for (const comp of expectedCompositions) {
      const count = await page.locator(`text=${comp}`).count();
      if (count > 0) {
        foundCompositions.push(comp);
        console.log(`✅ Found composition: ${comp}`);
      } else {
        console.log(`❌ Missing composition: ${comp}`);
      }
    }

    // Take screenshot after checking compositions
    await page.screenshot({
      path: "/Users/ivan/DEV_/anim/screenshots/02-compositions-check.png",
      fullPage: true,
    });

    // Method 2: Look for any clickable items that might be compositions
    console.log("🔍 Looking for clickable composition items...");
    const clickableItems = await page
      .locator(
        'a, button, [role="button"], [class*="clickable"], [class*="item"]',
      )
      .all();
    console.log(`Found ${clickableItems.length} clickable items`);

    // Try to click on compositions if found
    if (foundCompositions.length > 0) {
      console.log("🖱️ Attempting to interact with compositions...");

      for (const comp of foundCompositions.slice(0, 2)) {
        // Test first 2 found
        try {
          console.log(`Clicking on ${comp}...`);
          await page.locator(`text=${comp}`).first().click();
          await page.waitForTimeout(2000);

          // Take screenshot after clicking
          await page.screenshot({
            path: `/Users/ivan/DEV_/anim/screenshots/03-${comp.toLowerCase()}-clicked.png`,
            fullPage: true,
          });

          console.log(`✅ Successfully clicked ${comp}`);
        } catch (error) {
          console.log(`❌ Failed to click ${comp}: ${error.message}`);
        }
      }
    }

    // Look for video/player controls
    console.log("🎮 Checking for player controls...");
    const playerControls = {
      playButton: await page
        .locator('[aria-label*="play"], [title*="play"], button[class*="play"]')
        .count(),
      timeline: await page
        .locator('[class*="timeline"], [role="slider"]')
        .count(),
      scrubber: await page.locator('[class*="scrub"], [class*="seek"]').count(),
    };
    console.log("🎮 Player controls found:", playerControls);

    // Try to interact with player if available
    if (playerControls.playButton > 0) {
      try {
        console.log("▶️ Attempting to click play button...");
        await page
          .locator(
            '[aria-label*="play"], [title*="play"], button[class*="play"]',
          )
          .first()
          .click();
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: "/Users/ivan/DEV_/anim/screenshots/04-player-interaction.png",
          fullPage: true,
        });

        console.log("✅ Successfully interacted with player");
      } catch (error) {
        console.log(`❌ Failed to interact with player: ${error.message}`);
      }
    }

    // Check the page title and URL
    const title = await page.title();
    const url = page.url();
    console.log(`📄 Page title: ${title}`);
    console.log(`🔗 Current URL: ${url}`);

    // Get all visible text for analysis
    const allText = await page.locator("body").textContent();
    const textPreview = allText
      ? allText.substring(0, 500) + "..."
      : "No text found";
    console.log(`📝 Page text preview: ${textPreview}`);

    // Final comprehensive screenshot
    await page.screenshot({
      path: "/Users/ivan/DEV_/anim/screenshots/05-final-state.png",
      fullPage: true,
    });

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      appWorking:
        errors.length === 0 &&
        (foundCompositions.length > 0 || remotionElements.sidebar > 0),
      url: url,
      title: title,
      foundCompositions: foundCompositions,
      missingCompositions: expectedCompositions.filter(
        (comp) => !foundCompositions.includes(comp),
      ),
      remotionElements: remotionElements,
      playerControls: playerControls,
      consoleMessages: consoleMessages,
      errors: errors,
      screenshots: [
        "01-initial-load.png",
        "02-compositions-check.png",
        "03-transitionshowcase-clicked.png",
        "03-videoeffects-clicked.png",
        "04-player-interaction.png",
        "05-final-state.png",
      ].filter((file) => {
        try {
          return fs.existsSync(`/Users/ivan/DEV_/anim/screenshots/${file}`);
        } catch {
          return false;
        }
      }),
    };

    // Save report
    fs.writeFileSync(
      "/Users/ivan/DEV_/anim/test-report.json",
      JSON.stringify(report, null, 2),
    );

    console.log("\n📊 TEST REPORT:");
    console.log("================");
    console.log(`App Working: ${report.appWorking ? "✅ YES" : "❌ NO"}`);
    console.log(`Title: ${report.title}`);
    console.log(`URL: ${report.url}`);
    console.log(
      `Found Compositions: ${report.foundCompositions.join(", ") || "None"}`,
    );
    console.log(
      `Missing Compositions: ${report.missingCompositions.join(", ") || "None"}`,
    );
    console.log(
      `Console Errors: ${errors.filter((e) => e.message.includes("Error")).length}`,
    );
    console.log(`Screenshots Taken: ${report.screenshots.length}`);
    console.log("================");

    return report;
  } catch (error) {
    console.error("❌ Test failed:", error);

    // Take error screenshot
    await page.screenshot({
      path: "/Users/ivan/DEV_/anim/screenshots/error-state.png",
      fullPage: true,
    });

    return {
      error: true,
      message: error.message,
      consoleMessages: consoleMessages,
      errors: errors,
    };
  } finally {
    console.log("🏁 Test completed, keeping browser open for review...");
    // Keep browser open for manual inspection
    // await browser.close();
  }
}

// Create screenshots directory
const screenshotDir = "/Users/ivan/DEV_/anim/screenshots";
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

// Run the test
testRemotionApp().catch(console.error);
